import type { ReactNode } from "react";
import {
  EDUCATION_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  LEVEL_LABELS,
  formatExperienceRequirement,
  formatLocation,
  formatSalary,
  formatVnDate,
  type PublicJobDetail,
} from "@/lib/recruitment";

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-extrabold text-[var(--aloha-green-dark)]">{title}</h2>
      <div className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{text}</div>
    </section>
  );
}

/** Renderer tin tuyển dụng — dùng chung trang shop và xem trước trong admin. */
export function JobDetailView({ job, actions }: { job: PublicJobDetail; actions?: ReactNode }) {
  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">{job.title}</h1>
        {!job.acceptingApplications ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            Tin này đã đóng hoặc hết hạn nhận hồ sơ. Bạn vẫn có thể để lại thông tin để Aloha liên hệ khi có
            công việc phù hợp.
          </p>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 ring-1 ring-[var(--aloha-line)] sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        <SummaryItem label="Mức lương">{formatSalary(job.salary)}</SummaryItem>
        <SummaryItem label="Nơi làm việc">
          {job.locations.length ? (
            <ul className="space-y-0.5">
              {job.locations.map((l) => (
                <li key={l.key}>{formatLocation(l)}</li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </SummaryItem>
        <SummaryItem label="Kinh nghiệm">{formatExperienceRequirement(job.experienceRequirement)}</SummaryItem>
        {job.educationRequirement ? (
          <SummaryItem label="Bằng cấp">{EDUCATION_LABELS[job.educationRequirement]}</SummaryItem>
        ) : null}
        <SummaryItem label="Loại hình">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</SummaryItem>
        {job.level ? <SummaryItem label="Cấp bậc">{LEVEL_LABELS[job.level]}</SummaryItem> : null}
        {job.vacancies ? <SummaryItem label="Số lượng tuyển">{job.vacancies}</SummaryItem> : null}
        {job.department ? <SummaryItem label="Phòng ban">{job.department}</SummaryItem> : null}
        {job.jobCategory ? <SummaryItem label="Ngành nghề">{job.jobCategory}</SummaryItem> : null}
        {job.publishedAt ? <SummaryItem label="Ngày đăng">{formatVnDate(job.publishedAt)}</SummaryItem> : null}
        {job.deadlineAt ? <SummaryItem label="Hạn nộp hồ sơ">{formatVnDate(job.deadlineAt)}</SummaryItem> : null}
      </dl>

      <div className="space-y-6 rounded-2xl bg-white p-5 ring-1 ring-[var(--aloha-line)] sm:p-6">
        <Section title="Mô tả công việc" text={job.description} />
        <Section title="Yêu cầu công việc" text={job.requirements} />
        <Section title="Quyền lợi được hưởng" text={job.benefits} />
        {job.shiftDescription ? <Section title="Thời gian làm việc" text={job.shiftDescription} /> : null}
      </div>

      {actions}
    </article>
  );
}
