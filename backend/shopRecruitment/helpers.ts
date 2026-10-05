import crypto from "crypto";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { AuthRequest } from "../auth/middleware.js";
import {
  APPLICATIONS_COL,
  JOBS_COL,
  type HistoryEvent,
  type RecruitmentApplicationDoc,
  type RecruitmentJobDoc,
} from "./types.js";
import { deadlineToLocalDate, isJobAcceptingApplications } from "./validation.js";

export function parseId(raw: unknown): ObjectId | null {
  const s = String(raw || "").trim();
  if (!ObjectId.isValid(s) || String(new ObjectId(s)) !== s) return null;
  return new ObjectId(s);
}

export function actorId(req: AuthRequest): string {
  return String(req.auth?.username || req.auth?.userId || "admin");
}

export function newEventId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function historyEvent(
  actor: string,
  action: string,
  extra: Partial<Omit<HistoryEvent, "id" | "actorId" | "action" | "at">> = {}
): HistoryEvent {
  return { id: newEventId(), actorId: actor, action, at: new Date(), ...extra };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mã biên nhận ngẫu nhiên — chỉ để đối chiếu, không cấp quyền xem hồ sơ. */
export function newPublicCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `TD-${out}`;
}

export function isDuplicateKeyError(e: unknown): boolean {
  return (e as { code?: unknown })?.code === 11000 || String((e as { code?: unknown })?.code) === "11000";
}

let indexesReady = false;

export async function ensureRecruitmentIndexes(db: Db) {
  if (indexesReady) return;
  const jobs = db.collection(JOBS_COL);
  const apps = db.collection(APPLICATIONS_COL);
  await Promise.all([
    jobs.createIndex({ slug: 1 }, { unique: true }),
    jobs.createIndex({ status: 1, publishedAt: -1, _id: -1 }),
    apps.createIndex({ publicCode: 1 }, { unique: true }),
    apps.createIndex({ idempotencyKey: 1 }, { unique: true }),
    apps.createIndex({ jobId: 1, status: 1, createdAt: -1, _id: -1 }),
    apps.createIndex({ createdAt: -1, _id: -1 }),
    apps.createIndex({ retentionUntil: 1 }),
    apps.createIndex(
      { "confirmation.nextAttemptAt": 1 },
      {
        name: "confirmation_due",
        partialFilterExpression: { "confirmation.status": { $in: ["pending", "retry"] } },
      }
    ),
  ]);
  indexesReady = true;
}

// —— DTO tin tuyển dụng ——

export function toPublicJobListItem(doc: RecruitmentJobDoc) {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    locations: doc.locations || [],
    deadlineAt: doc.deadlineAt ? new Date(doc.deadlineAt).toISOString() : null,
    cvRequired: doc.cvRequired === true,
  };
}

export const PUBLIC_JOB_LIST_PROJECTION = {
  slug: 1,
  title: 1,
  locations: 1,
  deadlineAt: 1,
  cvRequired: 1,
  publishedAt: 1,
} as const;

export function toPublicJobDetail(doc: RecruitmentJobDoc, now = new Date()) {
  return {
    ...toPublicJobListItem(doc),
    department: doc.department || null,
    jobCategory: doc.jobCategory || null,
    level: doc.level || null,
    employmentType: doc.employmentType,
    experienceRequirement: doc.experienceRequirement || { mode: "none" },
    educationRequirement: doc.educationRequirement || null,
    vacancies: doc.vacancies ?? null,
    salary: doc.salary || { mode: "negotiated" },
    shiftDescription: doc.shiftDescription || null,
    description: doc.description || "",
    requirements: doc.requirements || "",
    benefits: doc.benefits || "",
    cvRequired: doc.cvRequired === true,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    status: doc.status === "open" ? ("open" as const) : ("closed" as const),
    acceptingApplications: isJobAcceptingApplications(doc, now),
  };
}

export function toAdminJob(doc: RecruitmentJobDoc, applicationCount = 0) {
  return {
    ...toPublicJobDetail(doc),
    status: doc.status,
    deadlineDate: deadlineToLocalDate(doc.deadlineAt),
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    version: doc.version,
    applicationCount,
  };
}

export async function countApplicationsByJob(db: Db, jobIds: ObjectId[]) {
  const map = new Map<string, number>();
  if (!jobIds.length) return map;
  const rows = await db
    .collection(APPLICATIONS_COL)
    .aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", n: { $sum: 1 } } },
    ])
    .toArray();
  for (const r of rows) map.set(String(r._id), Number(r.n) || 0);
  return map;
}

// —— DTO hồ sơ (chỉ admin) ——

export const ADMIN_APPLICATION_LIST_PROJECTION = {
  jobId: 1,
  submissionType: 1,
  interestedPosition: 1,
  experienceLevel: 1,
  publicCode: 1,
  contact: 1,
  status: 1,
  assignedTo: 1,
  appointment: 1,
  possibleDuplicate: 1,
  "cv.originalName": 1,
  "cv.format": 1,
  accountId: 1,
  source: 1,
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  "jobSummary.title": 1,
} as const;

function iso(d: Date | undefined | null) {
  return d ? new Date(d).toISOString() : null;
}

export function toAdminApplicationListItem(doc: Partial<RecruitmentApplicationDoc>) {
  return {
    id: String(doc._id),
    jobId: doc.jobId ? String(doc.jobId) : null,
    jobTitle: doc.jobSummary?.title || null,
    submissionType: doc.submissionType,
    interestedPosition: doc.interestedPosition || "",
    experienceLevel: doc.experienceLevel,
    publicCode: doc.publicCode,
    contact: doc.contact,
    status: doc.status,
    assignedTo: doc.assignedTo || null,
    appointmentAt: iso(doc.appointment?.startsAt),
    possibleDuplicate: doc.possibleDuplicate === true,
    hasCv: Boolean(doc.cv?.originalName),
    cvFormat: doc.cv ? doc.cv.format || "pdf" : null,
    hasAccount: Boolean(doc.accountId),
    source: doc.source || null,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    version: doc.version,
  };
}

export type AdminAccountSummary = { id: string; email: string; fullName: string; active: boolean } | null;

export function toAdminApplicationDetail(doc: RecruitmentApplicationDoc, account: AdminAccountSummary = null) {
  return {
    ...toAdminApplicationListItem(doc),
    account,
    jobSummary: doc.jobSummary || null,
    locationPreference: doc.locationPreference,
    experienceSummary: doc.experienceSummary || "",
    cv: doc.cv
      ? {
          originalName: doc.cv.originalName,
          format: doc.cv.format || "pdf",
          mimeType: doc.cv.mimeType,
          sizeBytes: doc.cv.sizeBytes,
          scanStatus: doc.cv.scanStatus,
        }
      : null,
    appointment: doc.appointment
      ? { ...doc.appointment, startsAt: iso(doc.appointment.startsAt) }
      : null,
    notes: (doc.notes || []).map((n) => ({ ...n, createdAt: iso(n.createdAt) })),
    history: (doc.history || []).map((h) => ({ ...h, at: iso(h.at) })),
    confirmation: doc.confirmation
      ? {
          status: doc.confirmation.status,
          attempts: doc.confirmation.attempts,
          sentAt: iso(doc.confirmation.sentAt),
          lastErrorCode: doc.confirmation.lastErrorCode || null,
        }
      : null,
    consent: { ...doc.consent, acceptedAt: iso(doc.consent?.acceptedAt) },
    retentionUntil: iso(doc.retentionUntil),
    updatedBy: doc.updatedBy || null,
  };
}
