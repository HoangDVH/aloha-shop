import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { formatLocation, formatVnDate, type PublicJobListItem } from "@/lib/recruitment";
import { ApplyButton } from "./ApplyHub";

export function JobCard({ job }: { job: PublicJobListItem }) {
  return (
    <article className="group relative rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-[var(--aloha-green)]/30">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-extrabold text-[var(--aloha-green-dark)] transition-colors hover:text-[var(--aloha-green)] sm:text-xl">
          <Link href={`/tuyen-dung/${job.slug}`} className="hover:underline">
            {job.title}
          </Link>
        </h3>

        <div className="space-y-2 text-sm text-slate-600 sm:text-[14.5px]">
          {job.locations.length ? (
            <div className="flex items-start gap-2.5">
              <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" aria-hidden />
              <span className="leading-relaxed">
                {job.locations.map(formatLocation).join(" · ")}
              </span>
            </div>
          ) : null}

          {job.deadlineAt ? (
            <div className="flex items-center gap-2.5">
              <CalendarDays size={18} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
              <span>
                Ngày hết hạn:{" "}
                <strong className="font-semibold text-slate-800">
                  {formatVnDate(job.deadlineAt)}
                </strong>
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 pt-2">
          <Link
            href={`/tuyen-dung/${job.slug}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-dark)] active:scale-95"
          >
            Xem chi tiết
          </Link>
          <ApplyButton
            source="job_card"
            job={{ id: job.id, title: job.title, locations: job.locations, cvRequired: job.cvRequired }}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#ffe566] px-6 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-[#ffd92e] active:scale-95"
          >
            Ứng tuyển
          </ApplyButton>
        </div>
      </div>
    </article>
  );
}
