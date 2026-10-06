import type { ReactNode } from "react";
import {
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  GraduationCap,
  MapPin,
  Tag,
  UserCheck,
  Users,
} from "lucide-react";
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
import { bodyHtmlForDisplay } from "@/lib/articleBodyHtml";

function SummaryItem({
  label,
  icon: Icon,
  className = "",
  highlight = false,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
        {Icon ? <Icon size={14} className="shrink-0 text-[var(--aloha-green)]" aria-hidden /> : null}
        <span>{label}</span>
      </dt>
      <dd
        className={`mt-1 text-sm font-bold leading-snug sm:text-[15px] ${
          highlight ? "font-extrabold text-[var(--aloha-green-dark)]" : "text-slate-800"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text || !text.trim()) return null;
  const isHtml = /<\s*(p|div|ul|ol|li|h[1-6]|strong|em|b|i|br)\b/i.test(text);

  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-extrabold text-[var(--aloha-green-dark)]">{title}</h2>
      {isHtml ? (
        <div
          className="text-[14.5px] leading-relaxed text-slate-700 sm:text-[15px] [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-slate-800 [&_h4]:mt-2 [&_h4]:mb-1 [&_a]:text-[var(--aloha-green-dark)] [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: bodyHtmlForDisplay(text) }}
        />
      ) : (
        <div className="whitespace-pre-line text-[14.5px] leading-relaxed text-slate-700 sm:text-[15px]">{text}</div>
      )}
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

      {/* Bảng tóm tắt thông số tuyển dụng: 2 cột trên Mobile (giảm 50% chiều dài cuộn) và 3 cột trên Desktop */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-white p-4.5 shadow-sm ring-1 ring-[var(--aloha-line)] sm:gap-5 sm:p-6 lg:grid-cols-3">
        {/* Mức lương - nổi bật */}
        <SummaryItem label="Mức lương" icon={Banknote} highlight>
          {formatSalary(job.salary)}
        </SummaryItem>

        {/* Kinh nghiệm */}
        <SummaryItem label="Kinh nghiệm" icon={Clock}>
          {formatExperienceRequirement(job.experienceRequirement)}
        </SummaryItem>

        {/* Nơi làm việc - trên mobile trải 2 cột vì địa chỉ dài */}
        <SummaryItem label="Nơi làm việc" icon={MapPin} className="col-span-2 lg:col-span-1">
          {job.locations.length ? (
            <ul className="space-y-0.5">
              {job.locations.map((l) => (
                <li key={l.key} className="text-xs font-semibold text-slate-700 sm:text-sm">
                  {formatLocation(l)}
                </li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </SummaryItem>

        {/* Loại hình */}
        <SummaryItem label="Loại hình" icon={Briefcase}>
          {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
        </SummaryItem>

        {/* Cấp bậc */}
        {job.level ? (
          <SummaryItem label="Cấp bậc" icon={UserCheck}>
            {LEVEL_LABELS[job.level]}
          </SummaryItem>
        ) : null}

        {/* Bằng cấp */}
        {job.educationRequirement ? (
          <SummaryItem label="Bằng cấp" icon={GraduationCap}>
            {EDUCATION_LABELS[job.educationRequirement]}
          </SummaryItem>
        ) : null}

        {/* Số lượng tuyển */}
        {job.vacancies ? (
          <SummaryItem label="Số lượng tuyển" icon={Users}>
            {job.vacancies}
          </SummaryItem>
        ) : null}

        {/* Phòng ban */}
        {job.department ? (
          <SummaryItem label="Phòng ban" icon={Building2}>
            {job.department}
          </SummaryItem>
        ) : null}

        {/* Ngành nghề */}
        {job.jobCategory ? (
          <SummaryItem label="Ngành nghề" icon={Tag}>
            {job.jobCategory}
          </SummaryItem>
        ) : null}

        {/* Ngày đăng */}
        {job.publishedAt ? (
          <SummaryItem label="Ngày đăng" icon={CalendarDays}>
            {formatVnDate(job.publishedAt)}
          </SummaryItem>
        ) : null}

        {/* Hạn nộp hồ sơ */}
        {job.deadlineAt ? (
          <SummaryItem label="Hạn nộp hồ sơ" icon={CalendarDays} highlight>
            {formatVnDate(job.deadlineAt)}
          </SummaryItem>
        ) : null}
      </dl>

      <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)] sm:p-6">
        <Section title="Mô tả công việc" text={job.description} />
        <Section title="Yêu cầu công việc" text={job.requirements} />
        <Section title="Quyền lợi được hưởng" text={job.benefits} />
        {job.shiftDescription ? <Section title="Thời gian làm việc" text={job.shiftDescription} /> : null}
      </div>

      {actions}
    </article>
  );
}
