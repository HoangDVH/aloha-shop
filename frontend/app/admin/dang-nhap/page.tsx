import Link from "next/link";
import { Suspense } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import { AdminLoginForm } from "@/components/admin/auth/AdminLoginForm";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

function AdminAuthBrand({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-center gap-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-icon-auth.png?v=1"
        alt=""
        className="h-14 w-auto object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
        draggable={false}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className="text-[1.85rem] font-extrabold tracking-[0.04em] text-[#E8C86A] sm:text-[2rem]"
          style={{
            textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 8px 18px rgba(0,0,0,0.25)",
          }}
        >
          ALOHA
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[0.65rem] font-semibold tracking-[0.14em] text-[#D4B45A]/95 uppercase">
          <span className="h-px w-4 bg-[#D4B45A]/70" aria-hidden />
          Admin Shop
          <span className="h-px w-4 bg-[#D4B45A]/70" aria-hidden />
        </span>
      </span>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className={`${beVietnam.className} relative min-h-screen`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/banners/banner-hero-01.png?v=6)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, color-mix(in srgb, var(--aloha-green-dark) 94%, transparent) 0%, color-mix(in srgb, var(--aloha-green-mid) 88%, transparent) 42%, color-mix(in srgb, var(--aloha-green) 82%, transparent) 100%)",
          }}
        />
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[var(--aloha-gold)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <aside className="hidden flex-col justify-between pl-14 pr-10 pt-14 pb-12 lg:flex xl:pl-20 xl:pr-14 xl:pt-16">
          <AdminAuthBrand />
          <div className="auth-brand-float max-w-lg space-y-4 text-white">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--aloha-gold)] uppercase">
              ALOHA Admin
            </p>
            <h2 className="text-4xl font-extrabold leading-tight xl:text-5xl">
              Vận hành shop
              <span className="mt-1 block text-emerald-100/95">CTV · giao diện · bài viết</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/80">
              Đăng nhập bằng tài khoản Quản lý app nội bộ để quản lý CTV/hoa hồng và website bán hàng.
            </p>
          </div>
          <p className="text-sm text-white/50">© {new Date().getFullYear()} ALOHA THẾ GIỚI CHẬU CÂY</p>
        </aside>

        <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:px-10 xl:px-16">
          <div className="mb-6 lg:hidden">
            <AdminAuthBrand />
          </div>

          <div className="auth-panel-enter w-full max-w-[420px]">
            <div className="rounded-3xl bg-white p-6 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/20 sm:p-8">
              <div className="text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--aloha-ink)]">
                  Đăng nhập Admin
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">Dùng tài khoản Quản lý app nội bộ</p>
              </div>
              <div className="mt-7">
                <Suspense fallback={null}>
                  <AdminLoginForm />
                </Suspense>
              </div>
            </div>

            <p className="mt-6 text-center text-sm">
              <Link
                href="/"
                className="inline-flex items-center gap-1 font-semibold text-white/85 transition hover:text-white"
              >
                ← Về cửa hàng
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
