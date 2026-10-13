"use client";

import { useMemo } from "react";
import { formatVnd } from "@/lib/api";
import {
  DEFAULT_VOLUME_TIERS,
  calculateTierPrice,
} from "@/lib/volumePricing";

type Props = {
  basePrice: number;
  unit?: string;
  qty: number;
  onSelectQty: (qty: number) => void;
  disabled?: boolean;
  maxQty?: number;
  liveWebPrice?: number;
};

/**
 * Dải giá bậc thang chuẩn 1688 / Shopee B2B:
 * Đặt trực tiếp tại vị trí khối Giá, hiển thị 3 cột giá đồng bộ theo số lượng.
 */
export function ProductTierPricing({
  basePrice,
  unit = "cái",
  qty,
  onSelectQty,
  disabled = false,
  maxQty = 10000,
  liveWebPrice,
}: Props) {
  const cleanUnit = unit?.trim() || "sản phẩm";

  const {
    tier,
    savedAmount,
    itemsToNextTier,
  } = useMemo(
    () => calculateTierPrice(basePrice, qty, DEFAULT_VOLUME_TIERS),
    [basePrice, qty]
  );

  if (basePrice <= 0) return null;

  return (
    <div className="w-full rounded-2xl border border-stone-200/90 bg-[#faf7f6] p-2.5 sm:p-3 transition-all">
      {/* 3 Cột Dải Giá Ngang */}
      <div className="grid grid-cols-3 divide-x divide-stone-200/80">
        {DEFAULT_VOLUME_TIERS.map((t) => {
          const isSelected = tier.minQty === t.minQty;
          const tierUnitPrice = Math.round(basePrice * (1 - t.discountPercent / 100));
          const isTarget10 = t.minQty === 10;

          return (
            <button
              key={t.minQty}
              type="button"
              disabled={disabled || (maxQty != null && t.minQty > maxQty)}
              onClick={() => onSelectQty(t.minQty)}
              className={`group flex flex-col items-center justify-between rounded-xl px-1.5 py-1.5 sm:py-2 transition-all cursor-pointer text-center disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1.5 ring-rose-400/50"
                  : "hover:bg-white/60 opacity-85 hover:opacity-100"
              }`}
              title={`Bấm để chọn mốc ${t.label} ${cleanUnit}`}
            >
              {/* Mốc số lượng */}
              <span
                className={`text-[11px] sm:text-xs font-semibold ${
                  isSelected ? "font-bold text-stone-900" : "text-stone-500"
                }`}
              >
                {t.label} {cleanUnit}
              </span>

              {/* Đơn giá nổi bật */}
              <div className="my-0.5">
                <span
                  className={`tabular-nums tracking-tight leading-tight ${
                    isSelected
                      ? "text-[17px] sm:text-[22px] font-black text-[#E11D48]"
                      : "text-[14px] sm:text-[17px] font-extrabold text-stone-800"
                  }`}
                >
                  {formatVnd(tierUnitPrice)}
                </span>
              </div>

              {/* Tag mức giảm */}
              <div>
                {t.discountPercent > 0 ? (
                  <span
                    className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      isTarget10
                        ? isSelected
                          ? "bg-rose-600 text-white"
                          : "bg-rose-100 text-rose-700"
                        : isSelected
                          ? "bg-amber-600 text-white"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Giảm {t.discountPercent}%
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-400">
                    {liveWebPrice && liveWebPrice > basePrice ? "Giá sale" : "Giá lẻ"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Dòng trạng thái mảnh dưới chân dải giá */}
      <div className="mt-2 flex items-center justify-between border-t border-stone-200/70 pt-1.5 px-1 text-[11px]">
        {qty >= 10 ? (
          <div className="flex w-full items-center justify-between text-emerald-700 font-semibold">
            <span>✓ Đang áp dụng giá sỉ <strong>giảm 10%</strong></span>
            {savedAmount > 0 && (
              <span className="font-extrabold text-rose-600">
                Tiết kiệm {formatVnd(savedAmount)} ({qty} {cleanUnit})
              </span>
            )}
          </div>
        ) : qty >= 5 ? (
          <div className="flex w-full items-center justify-between text-stone-600">
            <span>
              Thêm <strong className="text-rose-600">{itemsToNextTier} {cleanUnit}</strong> nữa để được <strong className="text-rose-600">giảm 10%</strong>
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectQty(10)}
              className="text-rose-600 font-bold hover:underline cursor-pointer"
            >
              Chọn 10
            </button>
          </div>
        ) : (
          <div className="text-stone-500">
            💡 Mua từ 5 {cleanUnit} giảm 5%, từ 10 {cleanUnit} giảm 10%
          </div>
        )}
      </div>
    </div>
  );
}
