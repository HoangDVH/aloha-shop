import Link from "next/link";
import { Headphones, Leaf, Sparkles } from "lucide-react";

/** Banner phụ — nền trắng (không kem). */
export function HomePromoStrip() {
  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-6 overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-[var(--aloha-line)] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7 sm:shadow-[var(--aloha-shadow)]">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold tracking-tight text-[var(--aloha-ink)] sm:text-xl">
              ALOHA — Cùng bạn kiến tạo không gian xanh
            </p>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--aloha-muted)]">
              Cây khỏe · chậu đẹp · giao nhanh — chọn dễ, sống xanh mỗi ngày.
            </p>
            <Link
              href="/tim"
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--aloha-terracotta)] px-5 text-sm font-bold text-white transition hover:bg-[var(--aloha-terracotta-hover)]"
            >
              Khám phá ngay →
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6">
            {[
              { icon: Leaf, label: "Đa dạng" },
              { icon: Sparkles, label: "Chất lượng" },
              { icon: Headphones, label: "Hỗ trợ" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex min-w-[4.5rem] flex-col items-center gap-1.5 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aloha-surface)] text-[var(--aloha-green)] ring-1 ring-[var(--aloha-line)]">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-xs font-semibold text-[var(--aloha-ink)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
