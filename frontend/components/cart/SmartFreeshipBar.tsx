"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Truck, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { formatCompactVnd } from "@/lib/voucherFormat";
import { getAvailablePromotions, type AvailablePromotionUI } from "@/lib/promotions";
import { useCampaignView } from "@/lib/campaign/useCampaignView";

export type FreeshipTier = {
  threshold: number;
  discount: number;
  label: string;
};

// Mốc mặc định theo chính sách của Aloha Shop khi chưa tải được từ database
const DEFAULT_TIERS: FreeshipTier[] = [
  { threshold: 1_000_000, discount: 30_000, label: "Giảm 30K ship" },
  { threshold: 2_000_000, discount: 50_000, label: "Giảm 50K ship" },
];

/**
 * URL điều hướng mua thêm thông minh:
 * - Khi có chiến dịch ưu đãi đang chạy: chuyển sang trang có lọc "Giảm giá" (?sort=giam_gia&inStock=1)
 * - Khi không có chiến dịch: chuyển sang trang có lọc "Nổi bật" (?sort=ban_chay&inStock=1)
 */
export function useMoreShoppingHref(): string {
  const { running } = useCampaignView();
  return running ? "/tim?sort=giam_gia&inStock=1" : "/tim?sort=ban_chay&inStock=1";
}

/**
 * Thanh tiến trình Freeship thông minh (Smart Threshold Progress Bar) chuẩn sàn TMĐT (Shopee / TikTok Shop).
 * Đặt tại đầu Giỏ hàng cho cả Desktop và Mobile để kích thích người dùng mua thêm (tăng AOV).
 */
export function SmartFreeshipBar({
  currentAmount,
  className = "",
  variant = "default",
  moreHref,
}: {
  currentAmount: number;
  className?: string;
  variant?: "default" | "compact";
  moreHref?: string;
}) {
  const defaultMoreHref = useMoreShoppingHref();
  const targetHref = moreHref || defaultMoreHref;
  const [promos, setPromos] = useState<AvailablePromotionUI[]>([]);

  useEffect(() => {
    let alive = true;
    getAvailablePromotions()
      .then((items) => {
        if (!alive) return;
        setPromos(items.filter((p) => p.benefitType === "shipping"));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const tiers: FreeshipTier[] = useMemo(() => {
    if (!promos.length) return DEFAULT_TIERS;
    const list = promos
      .filter((p) => p.minOrderThreshold && p.minOrderThreshold > 0)
      .map((p) => {
        const threshold = p.minOrderThreshold as number;
        const discount = p.discountValue || 30_000;
        const label = `Giảm ${formatCompactVnd(discount)} ship`;
        return { threshold, discount, label };
      })
      .sort((a, b) => a.threshold - b.threshold);

    return list.length ? list : DEFAULT_TIERS;
  }, [promos]);

  // Tìm mốc kế tiếp cần đạt
  const { currentTier, nextTier, shortfall, pct, isHighestReached } = useMemo(() => {
    if (!tiers.length) {
      return { currentTier: null, nextTier: null, shortfall: 0, pct: 100, isHighestReached: true };
    }

    const highest = tiers[tiers.length - 1];
    if (currentAmount >= highest.threshold) {
      return { currentTier: highest, nextTier: null, shortfall: 0, pct: 100, isHighestReached: true };
    }

    const next = tiers.find((t) => t.threshold > currentAmount) || highest;
    const prev = [...tiers].reverse().find((t) => t.threshold <= currentAmount) || null;

    const shortfall = Math.max(0, next.threshold - currentAmount);
    const pct = Math.min(98, Math.max(4, Math.round((currentAmount / next.threshold) * 100)));

    return { currentTier: prev, nextTier: next, shortfall, pct, isHighestReached: false };
  }, [tiers, currentAmount]);

  if (!tiers.length) return null;

  if (variant === "compact") {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
          isHighestReached
            ? "border-emerald-200/90 bg-emerald-50/70 shadow-2xs"
            : "border-teal-200/80 bg-gradient-to-r from-teal-50/80 via-emerald-50/60 to-teal-50/80 shadow-2xs"
        } p-2.5 sm:p-3 ${className}`}
        role="status"
        aria-live="polite"
      >
        {isHighestReached ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden />
              </span>
              <p className="text-xs font-bold text-emerald-900 leading-snug">
                🎉 Đã đạt <span className="text-[#0D9488] uppercase">{currentTier?.label || "Miễn phí vận chuyển"}</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              <Sparkles size={11} className="text-amber-500 fill-amber-500" />
              Đã nhận
            </span>
          </div>
        ) : (
          <div>
            {/* Tầng 1: Số tiền còn thiếu + Nút Mua thêm */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-xs">
                  <Truck size={13} strokeWidth={2.4} aria-hidden />
                </span>
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  Mua thêm <strong className="text-[#C8102E] font-black">{formatVnd(shortfall)}</strong>
                </p>
              </div>

              <Link
                href={targetHref}
                className="group inline-flex shrink-0 items-center gap-0.5 rounded-full border border-teal-200/90 bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs transition-all hover:bg-white hover:text-teal-900 active:scale-95 select-none"
              >
                <span>+ Mua thêm</span>
                <ChevronRight
                  size={11}
                  className="text-teal-600 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            {/* Tầng 2: Mục tiêu quyền lợi nhận được (100% không bị cắt) */}
            <div className="mt-1 flex items-center justify-between pl-8 text-[11.5px] leading-tight">
              <span className="text-slate-600">
                để được <strong className="text-[#0D9488] font-bold uppercase">{nextTier?.label}</strong>
              </span>
              <span className="text-[10px] font-semibold text-teal-700/80 tabular-nums">{pct}%</span>
            </div>
          </div>
        )}

        {/* Thanh tiến trình siêu mỏng */}
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70" aria-hidden>
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isHighestReached
                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                : "bg-gradient-to-r from-[#0D9488] via-emerald-500 to-[#0F766E]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isHighestReached
          ? "border-emerald-200/90 bg-gradient-to-r from-emerald-50/95 via-teal-50/80 to-emerald-50/95 shadow-xs"
          : "border-teal-200/80 bg-gradient-to-r from-teal-50/85 via-emerald-50/70 to-teal-50/85 shadow-2xs"
      } p-3 sm:p-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          {/* Icon tròn sinh động */}
          <span
            className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs transition-colors ${
              isHighestReached
                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-[#0D9488] to-[#0F766E]"
            }`}
          >
            {isHighestReached ? (
              <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden />
            ) : (
              <Truck size={17} strokeWidth={2.4} aria-hidden />
            )}
          </span>

          {/* Dòng thông điệp chính */}
          <div className="min-w-0 flex-1">
            {isHighestReached ? (
              <p className="text-xs sm:text-[13.5px] font-bold text-emerald-900 leading-snug">
                🎉 Tuyệt vời! Bạn đã đủ điều kiện{" "}
                <span className="text-[#0D9488] uppercase">{currentTier?.label || "Miễn phí vận chuyển"}</span>
              </p>
            ) : currentTier ? (
              <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-snug">
                Đã đạt <strong className="text-emerald-700 font-bold">{currentTier.label}</strong>! Mua thêm{" "}
                <strong className="text-[#C8102E] font-black">{formatVnd(shortfall)}</strong> để được{" "}
                <strong className="text-[#0D9488] font-bold uppercase">{nextTier?.label}</strong>
              </p>
            ) : (
              <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-snug">
                Mua thêm <strong className="text-[#C8102E] font-black">{formatVnd(shortfall)}</strong> để được{" "}
                <strong className="text-[#0D9488] font-bold uppercase">{nextTier?.label}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Nút hành động Mua thêm nếu chưa đạt mốc cao nhất */}
        {!isHighestReached ? (
          <Link
            href={targetHref}
            className="group inline-flex min-h-[30px] sm:min-h-[32px] shrink-0 items-center gap-0.5 rounded-full border border-teal-200/90 bg-white/95 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-teal-800 shadow-2xs transition-all hover:bg-white hover:text-teal-900 hover:shadow-xs active:scale-95 select-none"
          >
            <span>Mua thêm</span>
            <ChevronRight
              size={13}
              className="text-teal-600 transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            <Sparkles size={12} className="text-amber-500 fill-amber-500" />
            Đã nhận
          </span>
        )}
      </div>

      {/* Thanh tiến trình Progress Bar */}
      <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/70" aria-hidden>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-xs ${
            isHighestReached
              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
              : "bg-gradient-to-r from-[#0D9488] via-emerald-500 to-[#0F766E]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
