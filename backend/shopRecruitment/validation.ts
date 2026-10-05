import crypto from "crypto";
import { z } from "zod";
import {
  APPLICATION_SOURCES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  JOB_LEVELS,
  LIMITS,
  MAX_JOB_LOCATIONS,
  SALARY_MODES,
  SALARY_PERIODS,
  SUBMISSION_TYPES,
  type ExperienceRequirement,
  type JobLocation,
  type RecruitmentJobDoc,
  type Salary,
} from "./types.js";
import { locationKey } from "./config.js";
import { isValidPhoneVn, normalizePhoneVn } from "../shopAuth/ctvApplication.js";

const VN_OFFSET = "+07:00";

/** Ngày Asia/Saigon (YYYY-MM-DD) → cuối ngày đó theo UTC. VN không có DST. */
export function deadlineFromLocalDate(raw: string): Date | null {
  const s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T23:59:59.999${VN_OFFSET}`);
  if (!Number.isFinite(d.getTime())) return null;
  const roundTrip = deadlineToLocalDate(d);
  return roundTrip === s ? d : null;
}

export function deadlineToLocalDate(d: Date | undefined | null): string {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
}

export function isJobAcceptingApplications(
  job: Pick<RecruitmentJobDoc, "status" | "deadlineAt" | "publishedAt">,
  now = new Date()
): boolean {
  if (job.status !== "open" || !job.publishedAt || !job.deadlineAt) return false;
  return new Date(job.deadlineAt).getTime() >= now.getTime();
}

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || (typeof v === "string" && !v.trim()) ? undefined : v;

const optText = (max: number) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      const e = emptyToUndef(v);
      return e === undefined ? undefined : Number(e);
    },
    z.number().int().min(min).max(max).optional()
  );

const salarySchema = z
  .object({
    mode: z.enum(SALARY_MODES),
    min: optInt(1, 10_000_000_000),
    max: optInt(1, 10_000_000_000),
    period: z.preprocess(emptyToUndef, z.enum(SALARY_PERIODS).optional()),
  })
  .superRefine((s, ctx) => {
    const need = (field: "min" | "max", ok: boolean, msg: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [field], message: msg });
    };
    if (s.mode === "negotiated") return;
    if (s.mode === "range") {
      need("min", s.min != null, "Nhập lương tối thiểu");
      need("max", s.max != null, "Nhập lương tối đa");
      if (s.min != null && s.max != null && s.min > s.max) {
        ctx.addIssue({ code: "custom", path: ["max"], message: "Lương tối đa phải ≥ tối thiểu" });
      }
    }
    if (s.mode === "from") need("min", s.min != null, "Nhập mức lương từ");
    if (s.mode === "up_to") need("max", s.max != null, "Nhập mức lương đến");
    if (!s.period) {
      ctx.addIssue({ code: "custom", path: ["period"], message: "Chọn đơn vị tính lương" });
    }
  })
  .transform((s): Salary => {
    if (s.mode === "negotiated") return { mode: "negotiated" };
    if (s.mode === "range") return { mode: s.mode, min: s.min, max: s.max, period: s.period };
    if (s.mode === "from") return { mode: s.mode, min: s.min, period: s.period };
    return { mode: s.mode, max: s.max, period: s.period };
  });

const experienceRequirementSchema = z
  .object({
    mode: z.enum(["none", "required"]),
    minMonths: optInt(1, 600),
    maxMonths: optInt(1, 600),
  })
  .superRefine((e, ctx) => {
    if (e.mode !== "required") return;
    if (e.minMonths == null) {
      ctx.addIssue({ code: "custom", path: ["minMonths"], message: "Nhập số tháng kinh nghiệm" });
    }
    if (e.minMonths != null && e.maxMonths != null && e.maxMonths < e.minMonths) {
      ctx.addIssue({ code: "custom", path: ["maxMonths"], message: "Tối đa phải ≥ tối thiểu" });
    }
  })
  .transform((e): ExperienceRequirement =>
    e.mode === "none"
      ? { mode: "none" }
      : {
          mode: "required",
          minMonths: e.minMonths,
          ...(e.maxMonths != null ? { maxMonths: e.maxMonths } : {}),
        }
  );

const locationInputSchema = z.object({
  city: z.string().trim().min(1, "Nhập tỉnh/thành").max(LIMITS.city),
  address: z.string().trim().max(LIMITS.address).default(""),
  key: optText(60),
});

const locationsSchema = z
  .array(locationInputSchema)
  .max(MAX_JOB_LOCATIONS, `Tối đa ${MAX_JOB_LOCATIONS} nơi làm việc`)
  .transform((arr): JobLocation[] => {
    const seen = new Set<string>();
    const out: JobLocation[] = [];
    for (const l of arr) {
      const key = l.key || locationKey(l.city, l.address);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, city: l.city, address: l.address });
    }
    return out;
  });

export const jobInputSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên vị trí").max(LIMITS.title),
  slug: optText(120),
  department: optText(LIMITS.shortLabel),
  jobCategory: optText(LIMITS.shortLabel),
  level: z.preprocess(emptyToUndef, z.enum(JOB_LEVELS).optional()),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  locations: locationsSchema.default([]),
  experienceRequirement: experienceRequirementSchema.default({ mode: "none" }),
  educationRequirement: z.preprocess(emptyToUndef, z.enum(EDUCATION_LEVELS).optional()),
  vacancies: optInt(1, 10_000),
  salary: salarySchema.default({ mode: "negotiated" }),
  shiftDescription: optText(LIMITS.shiftDescription),
  description: z.string().trim().max(LIMITS.jdText).default(""),
  requirements: z.string().trim().max(LIMITS.jdText).default(""),
  benefits: z.string().trim().max(LIMITS.jdText).default(""),
  deadlineDate: z.preprocess(emptyToUndef, z.string().optional()),
  cvRequired: z.boolean().default(false),
});

export type JobInput = z.infer<typeof jobInputSchema>;

/** Trường không được đổi sau khi tin đã xuất bản — thay đổi lớn phải đóng và tạo tin mới. */
export const LOCKED_AFTER_PUBLISH = [
  "locations",
  "salary",
  "employmentType",
  "experienceRequirement",
  "educationRequirement",
  "cvRequired",
] as const;

export function zodFirstError(err: z.ZodError): { field: string; message: string } {
  const issue = err.issues[0];
  return {
    field: issue?.path?.join(".") || "",
    message: issue?.message || "Dữ liệu không hợp lệ",
  };
}

/** Trường bắt buộc trước khi mở tin (ký hiệu B trong kế hoạch). */
export function validateJobForOpen(
  job: Pick<
    RecruitmentJobDoc,
    "title" | "employmentType" | "locations" | "description" | "requirements" | "benefits" | "deadlineAt" | "salary"
  >,
  { now = new Date(), requireFutureDeadline = true }: { now?: Date; requireFutureDeadline?: boolean } = {}
): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = [];
  if (!job.title?.trim()) errors.push({ field: "title", message: "Nhập tên vị trí" });
  if (!job.employmentType) errors.push({ field: "employmentType", message: "Chọn loại hình" });
  if (!job.locations?.length) errors.push({ field: "locations", message: "Thêm ít nhất 1 nơi làm việc" });
  if (!job.salary?.mode) errors.push({ field: "salary", message: "Chọn cách hiển thị lương" });
  if (!job.description?.trim()) errors.push({ field: "description", message: "Nhập mô tả công việc" });
  if (!job.requirements?.trim()) errors.push({ field: "requirements", message: "Nhập yêu cầu công việc" });
  if (!job.benefits?.trim()) errors.push({ field: "benefits", message: "Nhập quyền lợi" });
  if (!job.deadlineAt) {
    errors.push({ field: "deadlineDate", message: "Chọn hạn nộp hồ sơ" });
  } else if (requireFutureDeadline && new Date(job.deadlineAt).getTime() < now.getTime()) {
    errors.push({ field: "deadlineDate", message: "Hạn nộp phải ở tương lai" });
  }
  return errors;
}

// —— Hồ sơ ứng tuyển (public) ——

const dataUrlSchema = z.string().max(8 * 1024 * 1024);

export const applicationInputSchema = z
  .object({
    submissionType: z.enum(SUBMISSION_TYPES),
    source: z.enum(APPLICATION_SOURCES).optional().catch(undefined),
    jobId: optText(40),
    interestedPosition: optText(LIMITS.interestedPosition),
    locationPreference: z.object({
      mode: z.enum(["selected", "any"]),
      keys: z.array(z.string().trim().min(1).max(60)).max(MAX_JOB_LOCATIONS * 4).default([]),
    }),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    fullName: z.string().trim().min(1, "Nhập họ và tên").max(LIMITS.fullName),
    email: z
      .string()
      .trim()
      .max(LIMITS.email)
      .pipe(z.email("Email không hợp lệ"))
      .transform((s) => s.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(LIMITS.phone)
      .refine(isValidPhoneVn, "Số điện thoại không hợp lệ")
      .transform(normalizePhoneVn),
    experienceSummary: optText(LIMITS.experienceSummary),
    cv: z
      .object({ name: z.string().trim().min(1).max(200), data: dataUrlSchema })
      .optional()
      .nullable(),
    consent: z.object({
      accepted: z.literal(true, { message: "Cần đồng ý thông báo xử lý dữ liệu" }),
      purpose: z.enum(["specific_job", "recruitment_contact"]),
      noticeVersion: z.string().trim().min(1).max(40),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.submissionType === "job_application") {
      if (!v.jobId) ctx.addIssue({ code: "custom", path: ["jobId"], message: "Thiếu tin tuyển dụng" });
      if (v.consent.purpose !== "specific_job") {
        ctx.addIssue({ code: "custom", path: ["consent"], message: "Mục đích đồng ý không khớp loại hồ sơ" });
      }
    } else {
      if (v.jobId) ctx.addIssue({ code: "custom", path: ["jobId"], message: "Form liên hệ chung không gắn tin" });
      if (!v.interestedPosition) {
        ctx.addIssue({ code: "custom", path: ["interestedPosition"], message: "Nhập công việc/vị trí quan tâm" });
      }
      if (v.consent.purpose !== "recruitment_contact") {
        ctx.addIssue({ code: "custom", path: ["consent"], message: "Mục đích đồng ý không khớp loại hồ sơ" });
      }
    }
    if (v.locationPreference.mode === "selected" && !v.locationPreference.keys.length) {
      ctx.addIssue({ code: "custom", path: ["locationPreference"], message: "Chọn nơi làm việc mong muốn" });
    }
  });

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export function isValidIdempotencyKey(raw: string): boolean {
  return /^[A-Za-z0-9_-]{16,100}$/.test(raw);
}

/** Hash nội dung submit (CV tính bằng sha256 nội dung) để phân biệt retry hợp lệ với nội dung khác. */
export function applicationRequestHash(input: ApplicationInput, cvSha256: string | null): string {
  const canonical = {
    t: input.submissionType,
    j: input.jobId || null,
    p: input.interestedPosition || null,
    lm: input.locationPreference.mode,
    lk: [...input.locationPreference.keys].sort(),
    x: input.experienceLevel,
    n: input.fullName,
    e: input.email,
    ph: input.phone,
    s: input.experienceSummary || null,
    cv: cvSha256,
    c: [input.consent.purpose, input.consent.noticeVersion],
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
