import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/** Tiêu đề mục thống nhất trên trang ưu đãi: ô icon màu chiến dịch + tiêu đề + mô tả + link "Xem tất cả". */
export function DealsSectionHead({
  icon: Icon,
  title,
  subtitle,
  moreHref,
  moreLabel = "Xem tất cả",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white shadow-sm shadow-rose-900/20">
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-black uppercase leading-tight tracking-tight text-slate-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-[13px] font-medium">{subtitle}</p> : null}
      </div>
      {moreHref ? (
        <Link
          href={moreHref}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-0.5 text-xs font-bold text-[var(--campaign-primary)] hover:underline sm:text-sm"
        >
          {moreLabel}
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
