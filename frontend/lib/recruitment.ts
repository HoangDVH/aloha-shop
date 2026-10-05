/** Kiểu dữ liệu + nhãn tuyển dụng dùng chung shop và admin (cùng renderer khi xem trước). */

export type JobLocation = { key: string; city: string; address: string };
export type EmploymentType = "full_time" | "part_time" | "intern" | "temporary";
export type JobLevel = "intern" | "staff" | "specialist" | "team_lead" | "manager";
export type EducationLevel = "not_required" | "high_school" | "vocational" | "college" | "university";
export type SalaryMode = "negotiated" | "range" | "from" | "up_to";
export type SalaryPeriod = "month" | "hour";
export type ExperienceLevel = "experienced" | "new_graduate" | "intern" | "no_experience";
export type ApplicationStatus =
  | "new"
  | "reviewing"
  | "interviewing"
  | "offered"
  | "hired"
  | "rejected"
  | "withdrawn";

export type Salary = { mode: SalaryMode; min?: number; max?: number; period?: SalaryPeriod };
export type ExperienceRequirement = { mode: "none" | "required"; minMonths?: number; maxMonths?: number };

export type ApplicationSource = "hero" | "job_card" | "job_detail" | "connect_section";
export type CvFormat = "pdf" | "doc" | "docx";

export type PublicJobListItem = {
  id: string;
  slug: string;
  title: string;
  locations: JobLocation[];
  deadlineAt: string | null;
  cvRequired: boolean;
};

/** Tin mà form ứng tuyển gắn vào (đủ để hiện nơi làm + yêu cầu CV). */
export type ApplyJobTarget = { id: string; title: string; locations: JobLocation[]; cvRequired: boolean };

export type PublicJobDetail = PublicJobListItem & {
  department: string | null;
  jobCategory: string | null;
  level: JobLevel | null;
  employmentType: EmploymentType;
  experienceRequirement: ExperienceRequirement;
  educationRequirement: EducationLevel | null;
  vacancies: number | null;
  salary: Salary;
  shiftDescription: string | null;
  description: string;
  requirements: string;
  benefits: string;
  cvRequired: boolean;
  publishedAt: string | null;
  status: "open" | "closed";
  acceptingApplications: boolean;
};

export type RecruitmentFormOptions = {
  applyEnabled: boolean;
  cvEnabled: boolean;
  cvMaxBytes: number;
  cvAcceptExts: string[];
  cvAcceptMimes: string[];
  noticeVersion: string;
  retentionDays: number | null;
  locations: JobLocation[];
  experienceLevels: ExperienceLevel[];
};

export const RECRUITMENT_PRIVACY_PATH = "/tuyen-dung/quyen-rieng-tu";

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  intern: "Thực tập",
  temporary: "Thời vụ",
};

export const LEVEL_LABELS: Record<JobLevel, string> = {
  intern: "Thực tập sinh",
  staff: "Nhân viên",
  specialist: "Chuyên viên",
  team_lead: "Trưởng nhóm",
  manager: "Quản lý",
};

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  not_required: "Không yêu cầu",
  high_school: "THPT",
  vocational: "Trung cấp",
  college: "Cao đẳng",
  university: "Đại học",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  experienced: "Đã có kinh nghiệm",
  new_graduate: "Mới ra trường",
  intern: "Thực tập",
  no_experience: "Chưa có kinh nghiệm",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "Mới",
  reviewing: "Đang xem",
  interviewing: "Phỏng vấn",
  offered: "Đã đề nghị",
  hired: "Đã nhận việc",
  rejected: "Từ chối",
  withdrawn: "Rút hồ sơ",
};

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  hero: "Nút Ứng tuyển ngay",
  job_card: "Thẻ việc làm",
  job_detail: "Trang chi tiết tin",
  connect_section: "Mục Kết nối",
};

export const CV_FORMAT_LABELS: Record<CvFormat, string> = { pdf: "PDF", doc: "Word (.doc)", docx: "Word (.docx)" };

export const SALARY_MODE_LABELS: Record<SalaryMode, string> = {
  negotiated: "Thỏa thuận",
  range: "Khoảng",
  from: "Từ",
  up_to: "Đến",
};

function vnd(n: number | undefined): string {
  return Number(n || 0).toLocaleString("vi-VN");
}

export function formatSalary(s: Salary | null | undefined): string {
  if (!s || s.mode === "negotiated") return "Thỏa thuận";
  const unit = s.period === "hour" ? "VNĐ/giờ" : "VNĐ/tháng";
  if (s.mode === "range") return `${vnd(s.min)} – ${vnd(s.max)} ${unit}`;
  if (s.mode === "from") return `Từ ${vnd(s.min)} ${unit}`;
  return `Đến ${vnd(s.max)} ${unit}`;
}

function months(n: number): string {
  return n % 12 === 0 ? `${n / 12} năm` : `${n} tháng`;
}

export function formatExperienceRequirement(e: ExperienceRequirement | null | undefined): string {
  if (!e || e.mode === "none" || !e.minMonths) return "Không yêu cầu";
  if (e.maxMonths) return `${months(e.minMonths)} – ${months(e.maxMonths)}`;
  return `Từ ${months(e.minMonths)}`;
}

export function formatVnDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Saigon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatVnDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Saigon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLocation(l: JobLocation): string {
  return l.address ? `${l.address}, ${l.city}` : l.city;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
