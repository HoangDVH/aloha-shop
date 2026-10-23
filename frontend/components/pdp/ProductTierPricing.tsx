"use client";
import { Check } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { DEFAULT_VOLUME_TIERS, calculateTierPrice } from "@/lib/volumePricing";

type Props = {
  basePrice: number;
  unit?: string;
  qty: number;
  onSelectQty: (qty: number) => void;
  disabled?: boolean;
  maxQty?: number;
  liveWebPrice?: number;
};

export function ProductTierPricing({
  basePrice,
  unit = "cái",
  qty,
  onSelectQty,
  disabled = false,
  maxQty = 10000,
}: Props) {
  if (basePrice <= 0) return null;
  const { tier } = calculateTierPrice(basePrice, qty);

  return (
    <section aria-label="Giá theo số lượng">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1.5">
        {DEFAULT_VOLUME_TIERS.map((t) => {
          const selected = t.minQty === tier.minQty;
          const price = Math.round(basePrice * (1 - t.discountPercent / 100));
          const isBest = t.highlight || t.discountPercent >= 10;

          return (
            <button
              key={t.minQty}
              type="button"
              aria-pressed={selected}
              disabled={disabled || t.minQty > maxQty}
              onClick={() => onSelectQty(t.minQty)}
              className={`relative flex min-h-[46px] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:py-2 sm:px-2 ${
                selected
                  ? "border-emerald-600 bg-emerald-50/60 text-emerald-950 ring-1 ring-emerald-600 shadow-2xs"
                  : "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/60 text-slate-700"
              }`}
            >
              {/* Badge ưu đãi % giảm đồng bộ họ màu Rose thanh lịch */}
              {t.discountPercent > 0 && (
                <span
                  className={`absolute -top-2.5 right-1.5 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black leading-none shadow-xs tracking-tight ${
                    isBest
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 text-rose-600 border border-rose-200"
                  }`}
                >
                  {isBest ? "🔥 -10%" : `-${t.discountPercent}%`}
                </span>
              )}

              {/* Chấm tick xác nhận ô đang chọn */}
              {selected && (
                <span className="absolute -top-2 -left-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                  <Check size={11} className="stroke-[3]" />
                </span>
              )}

              {/* Dòng 1: Khoảng số lượng */}
              <span
                className={`text-[11px] font-semibold leading-tight sm:text-xs ${
                  selected ? "text-emerald-800" : "text-slate-600"
                }`}
              >
                {t.label} {unit ? unit.toLowerCase() : ""}
              </span>

              {/* Dòng 2: Giá rõ ràng, không lặp lại /kg */}
              <span
                className={`text-xs font-extrabold tabular-nums tracking-tight sm:text-sm ${
                  selected ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {formatVnd(price)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
