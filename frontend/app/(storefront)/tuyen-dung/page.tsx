import Link from "next/link";
import type { Metadata } from "next";
import { Mail, Phone, Search, Send, Users } from "lucide-react";
import { fetchRecruitmentFormOptions, fetchRecruitmentJobs } from "@/lib/recruitmentApi";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import type { PublicJobListItem } from "@/lib/recruitment";
import { JobCard } from "@/components/recruitment/JobCard";
import { ApplyButton, RecruitmentApplyProvider } from "@/components/recruitment/ApplyHub";
import { ApplyUnavailable } from "@/components/recruitment/JobApplyCta";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: `Tuyển dụng · ${site}`,
    description: `Việc làm đang tuyển tại ${site} — xem vị trí đang mở hoặc để lại thông tin để Aloha liên hệ.`,
  };
}

type Sp = { page?: string; q?: string };

export default async function TuyenDungPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = String(sp.q || "").trim().slice(0, 80);

  let items: PublicJobListItem[] = [];
  let total = 0;
  let pages = 1;
  let loadError = "";
  const [jobsRes, options, appearance] = await Promise.all([
    fetchRecruitmentJobs({ page, q }).catch((e: Error) => e),
    fetchRecruitmentFormOptions(),
    fetchAppearance().catch(() => fallbackAppearance()),
  ]);
  if (jobsRes instanceof Error) loadError = "Không tải được danh sách việc làm. Vui lòng thử lại sau.";
  else {
    items = jobsRes.items || [];
    total = jobsRes.total || 0;
    pages = jobsRes.pages || 1;
  }
  const footer = appearance.theme?.footer;
  const applyJobs = items.map((j) => ({ id: j.id, title: j.title, locations: j.locations, cvRequired: j.cvRequired }));

  return (
    <RecruitmentApplyProvider options={options} jobs={applyJobs}>
    <div className="bg-[#F7F7F4] pb-12">
      <section className="bg-[var(--aloha-green-dark)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <nav className="mb-4 text-sm text-white/70">
            <Link href="/" className="hover:text-white">
              Trang chủ
            </Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-white">Tuyển dụng</span>
          </nav>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Tuyển dụng</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-white/85">
            Cùng Aloha mang cây xanh đến gần hơn với mọi nhà. Xem các vị trí đang mở hoặc để lại thông tin để
            Aloha liên hệ khi có công việc phù hợp.
          </p>
          <ApplyButton
            source="hero"
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#ffe566] px-7 text-[15px] font-extrabold text-slate-900 shadow-md transition hover:bg-[#ffd92e]"
          >
            <Send size={18} aria-hidden />
            Ứng tuyển ngay
          </ApplyButton>
          <form action="/tuyen-dung" method="get" role="search" className="mt-6 flex max-w-3xl gap-2">
            <label htmlFor="job-search" className="sr-only">
              Tìm việc làm
            </label>
            <div className="relative min-w-0 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="job-search"
                name="q"
                defaultValue={q}
                maxLength={80}
                placeholder="Nhập tên vị trí…"
                className="h-12 w-full rounded-full border-0 bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none ring-2 ring-transparent focus:ring-[#ffe566]"
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-white/15 px-6 text-[15px] font-bold text-white ring-1 ring-white/50 transition hover:bg-white/25"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="open-jobs">
        <h2 id="open-jobs" className="mb-4 text-xl font-extrabold text-[var(--aloha-green-dark)]">
          {q ? `Kết quả cho “${q}”` : "Vị trí đang tuyển"}
        </h2>
        {loadError ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{loadError}</p>
        ) : !items.length ? (
          <div className="rounded-2xl bg-white px-4 py-10 text-center ring-1 ring-[var(--aloha-line)]">
            <p className="text-sm text-slate-600">
              {q ? "Không tìm thấy vị trí phù hợp với từ khóa." : "Hiện Aloha chưa có vị trí đang mở."} Bạn có thể
              để lại thông tin bên dưới để Aloha liên hệ khi có cơ hội.
            </p>
            {q ? (
              <Link href="/tuyen-dung" className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--aloha-green-dark)] underline">
                Xóa từ khóa
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
        <Pagination page={page} pages={pages} total={total} unit="việc làm" />
      </section>

      <section id="ket-noi" className="mx-auto mt-12 max-w-6xl scroll-mt-24 px-4" aria-labelledby="ket-noi-title">
        <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 ring-1 ring-[var(--aloha-line)] sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 id="ket-noi-title" className="text-2xl font-extrabold text-[var(--aloha-green-dark)]">
              Hãy để Aloha kết nối với bạn
            </h2>
            <p className="mt-2 text-[15px] text-slate-600">
              Chưa thấy vị trí phù hợp? Để lại thông tin và CV, Aloha sẽ liên hệ khi có công việc phù hợp.
            </p>
          </div>
          {options?.applyEnabled ? (
            <ApplyButton
              source="connect_section"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--aloha-green-dark)] px-7 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)]"
            >
              <Send size={18} aria-hidden />
              Để lại thông tin
            </ApplyButton>
          ) : (
            <ApplyUnavailable />
          )}
        </div>
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 px-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[var(--aloha-line)]">
          <h2 className="font-extrabold text-[var(--aloha-green-dark)]">Liên hệ tuyển dụng</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {footer?.phone ? (
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-[var(--aloha-green)]" aria-hidden />
                <a href={`tel:${footer.phone.replace(/\s/g, "")}`} className="font-semibold hover:underline">
                  {footer.phone}
                </a>
              </li>
            ) : null}
            {footer?.email ? (
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-[var(--aloha-green)]" aria-hidden />
                <a href={`mailto:${footer.email}`} className="font-semibold hover:underline">
                  {footer.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <Link
          href="/tuyen-ctv"
          className="flex items-center gap-3 rounded-2xl bg-[#fff8db] p-5 ring-1 ring-[#f1e3a0] transition hover:shadow-md"
        >
          <Users size={28} className="shrink-0 text-[var(--aloha-green-dark)]" aria-hidden />
          <span>
            <span className="block font-extrabold text-[var(--aloha-green-dark)]">Muốn làm cộng tác viên?</span>
            <span className="text-sm text-slate-600">Xem chương trình tuyển CTV bán hàng của Aloha →</span>
          </span>
        </Link>
      </section>
    </div>
    </RecruitmentApplyProvider>
  );
}
