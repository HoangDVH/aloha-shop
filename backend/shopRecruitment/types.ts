/** Tuyển dụng nhân viên Aloha — đúng 2 collection (docs/KE_HOACH_TUYEN_DUNG.md). */
import type { ObjectId } from "mongodb";

export const JOBS_COL = "recruitment_jobs";
export const APPLICATIONS_COL = "recruitment_applications";

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "intern", "temporary"] as const;
export const JOB_LEVELS = ["intern", "staff", "specialist", "team_lead", "manager"] as const;
export const EDUCATION_LEVELS = [
  "not_required",
  "high_school",
  "vocational",
  "college",
  "university",
] as const;
export const SALARY_MODES = ["negotiated", "range", "from", "up_to"] as const;
export const SALARY_PERIODS = ["month", "hour"] as const;
export const JOB_STATUSES = ["draft", "open", "closed"] as const;
export const EXPERIENCE_LEVELS = [
  "experienced",
  "new_graduate",
  "intern",
  "no_experience",
] as const;
export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "interviewing",
  "offered",
  "hired",
  "rejected",
  "withdrawn",
] as const;
export const SUBMISSION_TYPES = ["job_application", "general_interest"] as const;
export const APPLICATION_SOURCES = ["hero", "job_card", "job_detail", "connect_section"] as const;
export const CV_FORMATS = ["pdf", "doc", "docx"] as const;
export const APPOINTMENT_MODES = ["onsite", "phone", "online"] as const;
export const CONFIRMATION_STATUSES = ["pending", "retry", "processing", "sent", "failed"] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type JobLevel = (typeof JOB_LEVELS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type SalaryMode = (typeof SALARY_MODES)[number];
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];
export type CvFormat = (typeof CV_FORMATS)[number];
export type AppointmentMode = (typeof APPOINTMENT_MODES)[number];
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];

export const MAX_JOB_LOCATIONS = 5;
export const MAX_NOTES = 50;
export const MAX_HISTORY = 200;
export const MAX_DOC_BYTES = 256 * 1024;
export const JOBS_PAGE_SIZE = 10;

export const LIMITS = {
  fullName: 150,
  email: 254,
  phone: 30,
  experienceSummary: 5000,
  note: 2000,
  interestedPosition: 150,
  title: 150,
  shortLabel: 100,
  shiftDescription: 500,
  jdText: 8000,
  reason: 500,
  search: 80,
  city: 80,
  address: 250,
} as const;

export type JobLocation = { key: string; city: string; address: string };

export type ExperienceRequirement = {
  mode: "none" | "required";
  minMonths?: number;
  maxMonths?: number;
};

export type Salary = {
  mode: SalaryMode;
  min?: number;
  max?: number;
  period?: SalaryPeriod;
};

export type RecruitmentJobDoc = {
  _id?: ObjectId;
  slug: string;
  title: string;
  department?: string;
  jobCategory?: string;
  level?: JobLevel;
  locations: JobLocation[];
  experienceRequirement: ExperienceRequirement;
  educationRequirement?: EducationLevel;
  vacancies?: number;
  employmentType: EmploymentType;
  shiftDescription?: string;
  description: string;
  requirements: string;
  benefits: string;
  salary: Salary;
  cvRequired: boolean;
  status: JobStatus;
  publishedAt?: Date;
  deadlineAt?: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type LocationPreference = {
  mode: "selected" | "any";
  locations?: JobLocation[];
};

export type CvMeta = {
  storageKey: string;
  originalName: string;
  /** Hồ sơ cũ (trước khi nhận Word) không có trường này → pdf. */
  format?: CvFormat;
  mimeType: string;
  sizeBytes: number;
  scanStatus: "not_scanned" | "clean" | "infected";
};

export type Appointment = {
  startsAt: Date;
  mode: AppointmentMode;
  locationOrLink: string;
  note?: string;
};

export type ApplicationNote = {
  id: string;
  authorId: string;
  text: string;
  createdAt: Date;
};

export type HistoryEvent = {
  id: string;
  actorId: string;
  action: string;
  fromStatus?: ApplicationStatus;
  toStatus?: ApplicationStatus;
  at: Date;
  reason?: string;
};

export type Confirmation = {
  status: ConfirmationStatus;
  attempts: number;
  nextAttemptAt?: Date;
  leaseUntil?: Date;
  lastErrorCode?: string;
  sentAt?: Date;
  messageKey: string;
};

export type Consent = {
  noticeVersion: string;
  acceptedAt: Date;
  purpose: "specific_job" | "recruitment_contact";
};

export type RecruitmentApplicationDoc = {
  _id?: ObjectId;
  jobId?: ObjectId;
  submissionType: SubmissionType;
  interestedPosition: string;
  locationPreference: LocationPreference;
  experienceLevel: ExperienceLevel;
  publicCode: string;
  idempotencyKey: string;
  requestHash: string;
  jobSummary?: { title: string; locations: JobLocation[]; employmentType: EmploymentType };
  contact: { fullName: string; email: string; phone: string };
  /** _id tài khoản shop lấy từ phiên đăng nhập lúc nộp — không bao giờ nhận từ client. */
  accountId?: string;
  source?: ApplicationSource;
  experienceSummary?: string;
  cv?: CvMeta;
  possibleDuplicate?: boolean;
  status: ApplicationStatus;
  assignedTo?: string;
  appointment?: Appointment;
  notes: ApplicationNote[];
  history: HistoryEvent[];
  confirmation?: Confirmation;
  consent: Consent;
  retentionUntil: Date;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
  version: number;
};
