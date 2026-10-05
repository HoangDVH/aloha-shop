import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { formatLocation, formatVnDate, type PublicJobListItem } from "@/lib/recruitment";
import { ApplyButton } from "./ApplyHub";

export function JobCard({ job }: { job: PublicJobListItem }) {
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)] transition hover:shadow-md sm:p-6">
      <h2 className="text-lg font-extrabold leading-snug text-[var(--aloha-green-dark)]">
        <Link href={`/tuyen-dung/${job.slug}`} className="hover:underline">
          {job.title}
        </Link>
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {job.locations.map((l) => (
          <li key={l.key} className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" aria-hidden />
            <span>{formatLocation(l)}</span>
          </li>
        ))}
        {job.deadlineAt ? (
          <li className="flex items-center gap-2">
            <CalendarDays size={16} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
            <span>Ngày hết hạn: {formatVnDate(job.deadlineAt)}</span>
          </li>
        ) : null}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <ApplyButton
          source="job_card"
          job={{ id: job.id, title: job.title, locations: job.locations, cvRequired: job.cvRequired }}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-5 text-sm font-bold text-white transition hover:bg-[var(--aloha-green)]"
        >
          Ứng tuyển
        </ApplyButton>
        <Link
          href={`/tuyen-dung/${job.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--aloha-green)] px-5 text-sm font-bold text-[var(--aloha-green-dark)] transition hover:bg-[var(--aloha-green)] hover:text-white"
        >
          Xem chi tiết
        </Link>
      </div>
    </article>
  );
}
