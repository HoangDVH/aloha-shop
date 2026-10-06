import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchRecruitmentFormOptions, fetchRecruitmentJob } from "@/lib/recruitmentApi";
import { JobDetailView } from "@/components/recruitment/JobDetailView";
import { ApplyUnavailable, JobApplyCta } from "@/components/recruitment/JobApplyCta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await fetchRecruitmentJob(slug).catch(() => null);
  if (!job) return { title: "Tuyển dụng" };
  const description = job.description.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: `${job.title} · Tuyển dụng`,
    description: description || job.title,
    robots: job.acceptingApplications ? undefined : { index: false, follow: true },
  };
}

export default async function TuyenDungDetailPage({ params }: Props) {
  const { slug } = await params;
  const [job, options] = await Promise.all([
    fetchRecruitmentJob(slug).catch(() => null),
    fetchRecruitmentFormOptions(),
  ]);
  if (!job) notFound();

  const actions = job.acceptingApplications ? (
    options?.applyEnabled ? (
      <JobApplyCta
        options={options}
        job={{ id: job.id, title: job.title, locations: job.locations, cvRequired: job.cvRequired }}
      />
    ) : (
      <ApplyUnavailable />
    )
  ) : (
    <Link
      href="/tuyen-dung?ung-tuyen=chung&nguon=job_detail"
      className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--aloha-green)] px-6 text-[15px] font-bold text-[var(--aloha-green-dark)] hover:bg-white"
    >
      Để lại thông tin liên hệ
    </Link>
  );

  return (
    <div className="bg-[#F7F7F4] py-8">
      <div className="mx-auto max-w-7xl px-4">
        <nav className="mb-5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-slate-500" aria-label="Đường dẫn">
          <Link href="/" className="shrink-0 hover:text-[var(--aloha-green)]">
            Trang chủ
          </Link>
          <span className="shrink-0">/</span>
          <Link href="/tuyen-dung" className="shrink-0 hover:text-[var(--aloha-green)]">
            Tuyển dụng
          </Link>
          <span className="shrink-0">/</span>
          <span className="min-w-0 truncate font-semibold text-[var(--aloha-green)]">{job.title}</span>
        </nav>
        <JobDetailView job={job} actions={<div className="pt-2">{actions}</div>} />
      </div>
    </div>
  );
}
