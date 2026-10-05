import type {
  ApplicationSource,
  ApplicationStatus,
  CvFormat,
  EducationLevel,
  EmploymentType,
  ExperienceLevel,
  JobLevel,
  JobLocation,
  PublicJobDetail,
  SalaryMode,
  SalaryPeriod,
} from "@/lib/recruitment";

export type JobStatus = "draft" | "open" | "closed";

export type AdminJob = Omit<PublicJobDetail, "status"> & {
  status: JobStatus;
  deadlineDate: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  applicationCount: number;
};

export type AdminApplicationListItem = {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  submissionType: "job_application" | "general_interest";
  interestedPosition: string;
  experienceLevel: ExperienceLevel;
  publicCode: string;
  contact: { fullName: string; email: string; phone: string };
  status: ApplicationStatus;
  assignedTo: string | null;
  appointmentAt: string | null;
  possibleDuplicate: boolean;
  hasCv: boolean;
  cvFormat: CvFormat | null;
  hasAccount: boolean;
  source: ApplicationSource | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AdminApplicationDetail = AdminApplicationListItem & {
  account: { id: string; email: string; fullName: string; active: boolean } | null;
  jobSummary: { title: string; locations: JobLocation[]; employmentType: EmploymentType } | null;
  locationPreference: { mode: "selected" | "any"; locations?: JobLocation[] };
  experienceSummary: string;
  cv: { originalName: string; format: CvFormat; mimeType: string; sizeBytes: number; scanStatus: string } | null;
  appointment: { startsAt: string; mode: "onsite" | "phone" | "online"; locationOrLink: string; note?: string } | null;
  notes: { id: string; authorId: string; text: string; createdAt: string }[];
  history: {
    id: string;
    actorId: string;
    action: string;
    fromStatus?: ApplicationStatus;
    toStatus?: ApplicationStatus;
    at: string;
    reason?: string;
  }[];
  confirmation: { status: string; attempts: number; sentAt: string | null; lastErrorCode: string | null } | null;
  consent: { noticeVersion: string; acceptedAt: string; purpose: string };
  retentionUntil: string;
  updatedBy: string | null;
};

export type JobFormState = {
  id?: string;
  version?: number;
  status: JobStatus;
  published: boolean;
  publishedAt: string | null;
  title: string;
  slug: string;
  department: string;
  jobCategory: string;
  level: JobLevel | "";
  employmentType: EmploymentType;
  locations: { city: string; address: string; key?: string }[];
  expMode: "none" | "required";
  expMin: string;
  expMax: string;
  educationRequirement: EducationLevel | "";
  vacancies: string;
  salaryMode: SalaryMode;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: SalaryPeriod;
  shiftDescription: string;
  description: string;
  requirements: string;
  benefits: string;
  deadlineDate: string;
  cvRequired: boolean;
};

export function emptyJobForm(): JobFormState {
  return {
    status: "draft",
    published: false,
    publishedAt: null,
    title: "",
    slug: "",
    department: "",
    jobCategory: "",
    level: "",
    employmentType: "full_time",
    locations: [],
    expMode: "none",
    expMin: "",
    expMax: "",
    educationRequirement: "",
    vacancies: "",
    salaryMode: "negotiated",
    salaryMin: "",
    salaryMax: "",
    salaryPeriod: "month",
    shiftDescription: "",
    description: "",
    requirements: "",
    benefits: "",
    deadlineDate: "",
    cvRequired: false,
  };
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export function jobToForm(j: AdminJob): JobFormState {
  return {
    id: j.id,
    version: j.version,
    status: j.status,
    published: Boolean(j.publishedAt),
    publishedAt: j.publishedAt,
    title: j.title,
    slug: j.slug,
    department: j.department || "",
    jobCategory: j.jobCategory || "",
    level: j.level || "",
    employmentType: j.employmentType,
    locations: j.locations.map((l) => ({ ...l })),
    expMode: j.experienceRequirement.mode,
    expMin: str(j.experienceRequirement.minMonths),
    expMax: str(j.experienceRequirement.maxMonths),
    educationRequirement: j.educationRequirement || "",
    vacancies: str(j.vacancies),
    salaryMode: j.salary.mode,
    salaryMin: str(j.salary.min),
    salaryMax: str(j.salary.max),
    salaryPeriod: j.salary.period || "month",
    shiftDescription: j.shiftDescription || "",
    description: j.description,
    requirements: j.requirements,
    benefits: j.benefits,
    deadlineDate: j.deadlineDate,
    cvRequired: j.cvRequired,
  };
}

const num = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) : undefined);

export function formToPayload(f: JobFormState) {
  return {
    title: f.title.trim(),
    slug: f.published ? f.slug : f.slug.trim(),
    department: f.department,
    jobCategory: f.jobCategory,
    level: f.level,
    employmentType: f.employmentType,
    locations: f.locations.filter((l) => l.city.trim()),
    experienceRequirement:
      f.expMode === "none" ? { mode: "none" } : { mode: "required", minMonths: num(f.expMin), maxMonths: num(f.expMax) },
    educationRequirement: f.educationRequirement,
    vacancies: num(f.vacancies),
    salary: { mode: f.salaryMode, min: num(f.salaryMin), max: num(f.salaryMax), period: f.salaryPeriod },
    shiftDescription: f.shiftDescription,
    description: f.description,
    requirements: f.requirements,
    benefits: f.benefits,
    deadlineDate: f.deadlineDate,
    cvRequired: f.cvRequired,
  };
}

/** Bản xem trước dựng từ form — render bằng đúng JobDetailView của shop. */
export function formToPreview(f: JobFormState): PublicJobDetail {
  const p = formToPayload(f);
  const deadlineAt = f.deadlineDate ? new Date(`${f.deadlineDate}T23:59:59+07:00`).toISOString() : null;
  return {
    id: f.id || "preview",
    slug: f.slug || "xem-truoc",
    title: p.title || "(Chưa có tên vị trí)",
    locations: p.locations.map((l, i) => ({ key: l.key || String(i), city: l.city, address: l.address })),
    deadlineAt,
    department: p.department || null,
    jobCategory: p.jobCategory || null,
    level: p.level || null,
    employmentType: p.employmentType,
    experienceRequirement:
      f.expMode === "none" ? { mode: "none" } : { mode: "required", minMonths: num(f.expMin), maxMonths: num(f.expMax) },
    educationRequirement: p.educationRequirement || null,
    vacancies: p.vacancies ?? null,
    salary:
      f.salaryMode === "negotiated"
        ? { mode: "negotiated" }
        : { mode: f.salaryMode, min: num(f.salaryMin), max: num(f.salaryMax), period: f.salaryPeriod },
    shiftDescription: p.shiftDescription || null,
    description: p.description,
    requirements: p.requirements,
    benefits: p.benefits,
    cvRequired: p.cvRequired,
    publishedAt: f.publishedAt || new Date().toISOString(),
    status: "open",
    acceptingApplications: true,
  };
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
};
