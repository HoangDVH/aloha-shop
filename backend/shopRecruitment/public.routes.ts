import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import type { GetShopDb } from "../shopOrders/routes.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  APPLICATIONS_COL,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  JOBS_COL,
  JOBS_PAGE_SIZE,
  LIMITS,
  MAX_DOC_BYTES,
  type JobLocation,
  type RecruitmentApplicationDoc,
  type RecruitmentJobDoc,
} from "./types.js";
import {
  CV_ACCEPT_EXTS,
  CV_MAX_BYTES,
  recruitmentApplyEnabled,
  recruitmentConfiguredLocations,
  recruitmentCvEnabled,
  recruitmentMailEnabled,
  recruitmentNoticeVersion,
  recruitmentRetentionDays,
} from "./config.js";
import {
  PUBLIC_JOB_LIST_PROJECTION,
  ensureRecruitmentIndexes,
  historyEvent,
  isDuplicateKeyError,
  newPublicCode,
  parseId,
  toPublicJobDetail,
  toPublicJobListItem,
} from "./helpers.js";
import {
  applicationInputSchema,
  applicationRequestHash,
  escapeRegex,
  isJobAcceptingApplications,
  isValidIdempotencyKey,
  zodFirstError,
  type ApplicationInput,
} from "./validation.js";
import { deleteCv, saveCv } from "./cvStorage.js";
import { CV_FORMAT_META, decodeCvDataUrl } from "./cvFormat.js";
import { readApplicantAccountId } from "./applicant.js";
import type { CvFormat } from "./types.js";

function openJobsFilter(now = new Date()) {
  return { status: "open", publishedAt: { $exists: true }, deadlineAt: { $gte: now } };
}

async function formLocations(db: Db): Promise<JobLocation[]> {
  const out = new Map<string, JobLocation>();
  for (const l of recruitmentConfiguredLocations()) out.set(l.key, l);
  const jobs = await db
    .collection<RecruitmentJobDoc>(JOBS_COL)
    .find(openJobsFilter() as any, { projection: { locations: 1 } })
    .limit(200)
    .toArray();
  for (const j of jobs) for (const l of j.locations || []) if (!out.has(l.key)) out.set(l.key, l);
  return [...out.values()];
}

function fieldError(res: Response, status: number, field: string, message: string) {
  res.status(status).json({ error: "invalid_field", field, message });
}

export function registerRecruitmentPublicRoutes(app: Express, getShopDb: GetShopDb) {
  app.get("/api/shop/recruitment/jobs", async (req: Request, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureRecruitmentIndexes(db);
      const page = Math.min(500, Math.max(1, Number(req.query.page) || 1));
      const q = String(req.query.q || "").trim().slice(0, LIMITS.search);
      const employmentType = String(req.query.employmentType || "");
      const city = String(req.query.city || "").trim().slice(0, LIMITS.city);
      const filter: Record<string, unknown> = openJobsFilter();
      if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
      if ((EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
        filter.employmentType = employmentType;
      }
      if (city) filter["locations.city"] = city;
      const col = db.collection<RecruitmentJobDoc>(JOBS_COL);
      const [total, rows] = await Promise.all([
        col.countDocuments(filter as any),
        col
          .find(filter as any, { projection: PUBLIC_JOB_LIST_PROJECTION })
          .sort({ publishedAt: -1, _id: -1 })
          .skip((page - 1) * JOBS_PAGE_SIZE)
          .limit(JOBS_PAGE_SIZE)
          .maxTimeMS(3000)
          .toArray(),
      ]);
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({
        items: rows.map((d) => toPublicJobListItem(d as RecruitmentJobDoc)),
        total,
        page,
        limit: JOBS_PAGE_SIZE,
        pages: Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE)),
      });
    } catch (e: any) {
      res.status(500).json({ error: "recruitment_jobs_failed", message: e?.message });
    }
  });

  app.get("/api/shop/recruitment/form-options", async (_req: Request, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureRecruitmentIndexes(db);
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({
        applyEnabled: recruitmentApplyEnabled(),
        cvEnabled: recruitmentCvEnabled(),
        cvMaxBytes: CV_MAX_BYTES,
        cvAcceptExts: CV_ACCEPT_EXTS,
        cvAcceptMimes: Object.values(CV_FORMAT_META).map((m) => m.mime),
        noticeVersion: recruitmentNoticeVersion(),
        retentionDays: recruitmentRetentionDays(),
        locations: await formLocations(db),
        experienceLevels: EXPERIENCE_LEVELS,
      });
    } catch (e: any) {
      res.status(500).json({ error: "recruitment_options_failed", message: e?.message });
    }
  });

  app.get("/api/shop/recruitment/jobs/:slug", async (req: Request, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureRecruitmentIndexes(db);
      const slug = String(req.params.slug || "").trim().slice(0, 120);
      const doc = await db
        .collection<RecruitmentJobDoc>(JOBS_COL)
        .findOne({ slug, status: { $in: ["open", "closed"] }, publishedAt: { $exists: true } } as any);
      if (!doc) {
        res.status(404).json({ error: "not_found", message: "Không tìm thấy tin tuyển dụng." });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({ item: toPublicJobDetail(doc) });
    } catch (e: any) {
      res.status(500).json({ error: "recruitment_job_failed", message: e?.message });
    }
  });

  app.post("/api/shop/recruitment/applications", async (req: Request, res: Response) => {
    let savedCvKey: string | null = null;
    try {
      if (!recruitmentApplyEnabled()) {
        res.status(503).json({ error: "apply_disabled", message: "Aloha chưa mở nhận hồ sơ trực tuyến." });
        return;
      }
      if (!(await shopRateLimitOrReject(req as any, res, "recruit-apply", 5, 10 * 60_000))) return;

      const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();
      if (!isValidIdempotencyKey(idempotencyKey)) {
        res.status(400).json({ error: "missing_idempotency_key", message: "Thiếu mã lần gửi. Tải lại trang." });
        return;
      }
      const parsed = applicationInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const { field, message } = zodFirstError(parsed.error);
        fieldError(res, 400, field, message);
        return;
      }
      const input: ApplicationInput = parsed.data;
      if (input.consent.noticeVersion !== recruitmentNoticeVersion()) {
        res.status(409).json({
          error: "notice_outdated",
          field: "consent",
          message: "Thông báo xử lý dữ liệu vừa cập nhật. Tải lại trang và đọc lại trước khi gửi.",
        });
        return;
      }

      let cvBuffer: Buffer | null = null;
      let cvFormat: CvFormat | null = null;
      if (input.cv) {
        if (!recruitmentCvEnabled()) {
          fieldError(res, 400, "cv", "Hiện chưa nhận CV trực tuyến — vui lòng mô tả kinh nghiệm.");
          return;
        }
        const decoded = decodeCvDataUrl(input.cv.data, CV_MAX_BYTES);
        if (decoded.ok === false) {
          fieldError(res, 400, "cv", decoded.message);
          return;
        }
        cvBuffer = decoded.buffer;
        cvFormat = decoded.format;
      }
      const cvSha = cvBuffer ? crypto.createHash("sha256").update(cvBuffer).digest("hex") : null;
      const requestHash = applicationRequestHash(input, cvSha);

      const db = await getShopDb();
      await ensureRecruitmentIndexes(db);
      const col = db.collection<RecruitmentApplicationDoc>(APPLICATIONS_COL);

      const replay = async (): Promise<boolean> => {
        const prev = await col.findOne(
          { idempotencyKey },
          { projection: { requestHash: 1, publicCode: 1, submissionType: 1 } }
        );
        if (!prev) return false;
        if (prev.requestHash !== requestHash) {
          res.status(409).json({
            error: "idempotency_conflict",
            message: "Nội dung khác lần gửi trước. Tải lại trang rồi gửi lại.",
          });
        } else {
          res.json({ ok: true, replay: true, publicCode: prev.publicCode, submissionType: prev.submissionType });
        }
        return true;
      };
      if (await replay()) return;

      const now = new Date();
      let jobId: RecruitmentApplicationDoc["jobId"];
      let jobSummary: RecruitmentApplicationDoc["jobSummary"];
      let interestedPosition = input.interestedPosition || "";
      let allowedLocations: JobLocation[];
      let cvRequired = false;

      if (input.submissionType === "job_application") {
        const oid = parseId(input.jobId);
        const job = oid
          ? await db.collection<RecruitmentJobDoc>(JOBS_COL).findOne({ _id: oid })
          : null;
        if (!job || !isJobAcceptingApplications(job, now)) {
          fieldError(res, 409, "jobId", "Tin đã đóng hoặc hết hạn nhận hồ sơ.");
          return;
        }
        jobId = job._id;
        interestedPosition = job.title;
        jobSummary = { title: job.title, locations: job.locations, employmentType: job.employmentType };
        allowedLocations = job.locations || [];
        cvRequired = job.cvRequired === true;
      } else {
        allowedLocations = await formLocations(db);
      }

      let locationPreference: RecruitmentApplicationDoc["locationPreference"];
      if (input.locationPreference.mode === "any") {
        locationPreference = { mode: "any" };
      } else {
        const byKey = new Map(allowedLocations.map((l) => [l.key, l]));
        const picked: JobLocation[] = [];
        for (const k of new Set(input.locationPreference.keys)) {
          const l = byKey.get(k);
          if (!l) {
            fieldError(res, 400, "locationPreference", "Nơi làm việc không hợp lệ. Tải lại trang.");
            return;
          }
          picked.push(l);
        }
        locationPreference = { mode: "selected", locations: picked };
      }

      if (cvRequired && recruitmentCvEnabled() && !cvBuffer) {
        fieldError(res, 400, "cv", "Vị trí này yêu cầu đính kèm CV.");
        return;
      }
      if (cvRequired && !cvBuffer && !input.experienceSummary) {
        fieldError(res, 400, "experienceSummary", "Vị trí này cần mô tả kinh nghiệm.");
        return;
      }

      let cv: RecruitmentApplicationDoc["cv"];
      if (cvBuffer && cvFormat && input.cv) {
        const saved = await saveCv(cvBuffer, cvFormat);
        savedCvKey = saved.storageKey;
        cv = {
          storageKey: saved.storageKey,
          originalName: input.cv.name.replace(/[\r\n"\\/]/g, "_").slice(0, 200),
          format: cvFormat,
          mimeType: CV_FORMAT_META[cvFormat].mime,
          sizeBytes: cvBuffer.length,
          scanStatus: "not_scanned",
        };
      }

      const dupFilter: Record<string, unknown> = {
        "contact.email": input.email,
        status: { $nin: ["rejected", "withdrawn"] },
      };
      if (jobId) dupFilter.jobId = jobId;
      else dupFilter.submissionType = "general_interest";
      const possibleDuplicate = Boolean(await col.findOne(dupFilter as any, { projection: { _id: 1 } }));
      const accountId = await readApplicantAccountId(db, req);

      const retentionDays = recruitmentRetentionDays()!;
      const publicCodeSeed = newPublicCode();
      const doc: RecruitmentApplicationDoc = {
        ...(jobId ? { jobId, jobSummary } : {}),
        submissionType: input.submissionType,
        interestedPosition,
        locationPreference,
        experienceLevel: input.experienceLevel,
        publicCode: publicCodeSeed,
        idempotencyKey,
        requestHash,
        contact: { fullName: input.fullName, email: input.email, phone: input.phone },
        ...(accountId ? { accountId } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.experienceSummary ? { experienceSummary: input.experienceSummary } : {}),
        ...(cv ? { cv } : {}),
        ...(possibleDuplicate ? { possibleDuplicate: true } : {}),
        status: "new",
        notes: [],
        history: [historyEvent("applicant", "created", { toStatus: "new" })],
        ...(recruitmentMailEnabled()
          ? {
              confirmation: {
                status: "pending" as const,
                attempts: 0,
                nextAttemptAt: now,
                messageKey: `recruit-confirm-${publicCodeSeed}`,
              },
            }
          : {}),
        consent: {
          noticeVersion: input.consent.noticeVersion,
          acceptedAt: now,
          purpose: input.consent.purpose,
        },
        retentionUntil: new Date(now.getTime() + retentionDays * 86_400_000),
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      if (Buffer.byteLength(JSON.stringify(doc)) > MAX_DOC_BYTES) {
        fieldError(res, 413, "experienceSummary", "Hồ sơ quá dài.");
        return;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await col.insertOne(doc);
          savedCvKey = null;
          res.status(201).json({ ok: true, publicCode: doc.publicCode, submissionType: doc.submissionType });
          return;
        } catch (e) {
          if (!isDuplicateKeyError(e)) throw e;
          if (await replay()) return;
          doc.publicCode = newPublicCode();
          if (doc.confirmation) doc.confirmation.messageKey = `recruit-confirm-${doc.publicCode}`;
          delete (doc as { _id?: unknown })._id;
        }
      }
      throw new Error("public_code_allocation_failed");
    } catch (e: any) {
      res.status(500).json({ error: "apply_failed", message: "Không gửi được hồ sơ. Vui lòng thử lại." });
      console.warn("[recruitment] apply failed", e?.message);
    } finally {
      if (savedCvKey) await deleteCv(savedCvKey).catch(() => undefined);
    }
  });
}
