import Link from "next/link";
import Image from "next/image";
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
    description: `Khám phá cơ hội nghề nghiệp tại ${site} — cùng Aloha mang mảng xanh đến hàng triệu ngôi nhà Việt.`,
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
      <div className="bg-[#F8F9FA] pb-16">
        {/* Hero Section theo phong cách hình 1 nhưng dùng nhận diện màu xanh Aloha */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#124116] via-[#1B5E20] to-[#2E7D32] text-white">
          {/* Họa tiết tech/botanical nhẹ nhàng nền */}
          <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-[#4CAF50]/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-72 w-72 rounded-full bg-[#81C784]/10 blur-2xl" />

          <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-16 sm:pt-8 sm:pb-24">
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-1.5 text-sm text-white/70" aria-label="Đường dẫn">
              <Link href="/" className="transition hover:text-white">
                Trang chủ
              </Link>
              <span>/</span>
              <span className="font-semibold text-white">Tuyển dụng</span>
            </nav>

            {/* Bố cục 2 cột: Ảnh banner bên trái + Nội dung chữ bên phải */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Cột trái: Khung ảnh banner bo góc phong cách card với tỷ lệ chuẩn của banner */}
              <div className="lg:col-span-6">
                <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                  {/* Đường viền điểm nhấn góc trên bên trái */}
                  <div className="pointer-events-none absolute -left-2.5 -top-2.5 z-10 h-16 w-16 rounded-tl-[1.8rem] border-l-4 border-t-4 border-[#81C784]/80 sm:h-20 sm:w-20 sm:rounded-tl-[2rem]" />

                  <div className="relative aspect-[1024/409] w-full overflow-hidden rounded-2xl shadow-2xl ring-4 ring-white/20 sm:rounded-[2rem]">
                    <Image
                      src="/images/recruitment-hero.png"
                      alt="Tuyển dụng nhân viên shop cây cảnh Aloha"
                      fill
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              {/* Cột phải: Tiêu đề + Khẩu hiệu */}
              <div className="space-y-4 text-center lg:col-span-6 lg:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl lg:leading-[1.18]">
                  Khám phá công việc
                  <span className="block text-[#ffe566]">phù hợp với bạn</span>
                </h1>
                <p className="mx-auto max-w-xl text-base leading-relaxed text-white/90 sm:text-lg lg:mx-0">
                  Bạn đã sẵn sàng để phát triển sự nghiệp bền vững? Tham gia ngay cùng Aloha!
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2 lg:justify-start">
                  <ApplyButton
                    source="hero"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#ffe566] px-8 text-[15px] font-extrabold text-slate-900 shadow-lg transition hover:bg-[#ffd92e] hover:shadow-xl active:scale-95"
                  >
                    <Send size={18} aria-hidden />
                    Ứng tuyển ngay
                  </ApplyButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Khung tìm kiếm nổi bo tròn bên dưới banner theo phong cách ảnh 1 */}
        <div className="relative z-20 mx-auto -mt-8 max-w-7xl px-4 sm:-mt-12">
          <div className="rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-slate-200/80 sm:rounded-3xl sm:p-5">
            <form action="/tuyen-dung" method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label htmlFor="job-search" className="sr-only">
                Tìm kiếm vị trí tuyển dụng
              </label>
              <div className="relative flex-1">
                <input
                  id="job-search"
                  name="q"
                  defaultValue={q}
                  maxLength={80}
                  placeholder="Tìm kiếm..."
                  className="h-12 w-full rounded-xl border border-slate-200/90 bg-[#F4F7F4] pl-5 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--aloha-green)] focus:bg-white focus:ring-4 focus:ring-[var(--aloha-green)]/15 sm:h-14 sm:rounded-2xl"
                />
                <Search size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green-dark)] active:scale-95 sm:h-14 sm:rounded-2xl"
              >
                Tìm kiếm
              </button>
            </form>
          </div>
        </div>

        {/* Danh sách việc làm dạng thẻ hàng ngang theo phong cách hình 2 */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:pt-14" aria-labelledby="open-jobs">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="open-jobs" className="text-2xl font-extrabold text-[var(--aloha-green-dark)]">
                {q ? `Kết quả cho “${q}”` : "Vị trí đang tuyển"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {total > 0 ? `Hiện có ${total} vị trí mở dành cho bạn.` : "Danh sách cơ hội nghề nghiệp tại Aloha."}
              </p>
            </div>
            {q ? (
              <Link
                href="/tuyen-dung"
                className="text-sm font-semibold text-[var(--aloha-green)] hover:underline"
              >
                ✕ Xóa bộ lọc tìm kiếm
              </Link>
            ) : null}
          </div>

          {loadError ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{loadError}</p>
          ) : !items.length ? (
            <div className="rounded-2xl bg-white px-4 py-12 text-center ring-1 ring-[var(--aloha-line)]">
              <p className="text-base text-slate-600">
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
            <div className="space-y-4 sm:space-y-5">
              {items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          <div className="mt-8">
            <Pagination page={page} pages={pages} total={total} unit="việc làm" />
          </div>
        </section>

        {/* Mục liên hệ chung "Hãy để Aloha kết nối với bạn" */}
        <section id="ket-noi" className="mx-auto mt-12 max-w-7xl scroll-mt-24 px-4 sm:mt-16" aria-labelledby="ket-noi-title">
          <div className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 id="ket-noi-title" className="text-2xl font-extrabold text-[var(--aloha-green-dark)]">
                Hãy để Aloha kết nối với bạn
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                Chưa thấy vị trí phù hợp? Để lại thông tin và CV, Aloha sẽ chủ động liên hệ khi có cơ hội công việc phù hợp với bạn.
              </p>
            </div>
            {options?.applyEnabled ? (
              <ApplyButton
                source="connect_section"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--aloha-green-dark)] px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] active:scale-95"
              >
                <Send size={18} aria-hidden />
                Để lại thông tin
              </ApplyButton>
            ) : (
              <ApplyUnavailable />
            )}
          </div>
        </section>

        {/* Thông tin liên hệ & Tuyển CTV */}
        <section className="mx-auto mt-8 grid max-w-7xl gap-4 px-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
            <h3 className="text-lg font-extrabold text-[var(--aloha-green-dark)]">Liên hệ tuyển dụng</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {footer?.phone ? (
                <li className="flex items-center gap-2.5">
                  <Phone size={17} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
                  <a href={`tel:${footer.phone.replace(/\s/g, "")}`} className="font-semibold hover:underline">
                    {footer.phone}
                  </a>
                </li>
              ) : null}
              {footer?.email ? (
                <li className="flex items-center gap-2.5">
                  <Mail size={17} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
                  <a href={`mailto:${footer.email}`} className="font-semibold hover:underline">
                    {footer.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <Link
            href="/tuyen-ctv"
            className="flex items-center gap-4 rounded-2xl bg-[#fff8db] p-6 ring-1 ring-[#f1e3a0] transition hover:shadow-md"
          >
            <Users size={32} className="shrink-0 text-[var(--aloha-green-dark)]" aria-hidden />
            <span>
              <span className="block text-lg font-extrabold text-[var(--aloha-green-dark)]">Muốn làm cộng tác viên?</span>
              <span className="mt-0.5 block text-sm text-slate-600">Xem chương trình tuyển CTV bán hàng chiết khấu tốt của Aloha →</span>
            </span>
          </Link>
        </section>
      </div>
    </RecruitmentApplyProvider>
  );
}
