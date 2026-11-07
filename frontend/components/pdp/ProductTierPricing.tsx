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

  // Tạm thời ẩn các ô bậc giá theo số lượng, hiển thị giá bán tiêu chuẩn
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 text-2xl font-bold text-[var(--aloha-price)] sm:text-[1.75rem]">
      <span>{formatVnd(basePrice)}</span>
      {unit ? (
        <span className="text-base font-semibold text-[var(--aloha-muted)] sm:text-lg">
          / {unit}
        </span>
      ) : null}
    </div>
  );

  /*
  const { tier } = calculateTierPrice(basePrice, qty);

  return (
    <section aria-label="Giá theo số lượng">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {DEFAULT_VOLUME_TIERS.map((t) => {
          const selected = t.minQty === tier.minQty;
          const price = Math.round(basePrice * (1 - t.discountPercent / 100));

          return (
            <button
              key={t.minQty}
              type="button"
              aria-pressed={selected}
              disabled={disabled || t.minQty > maxQty}
              onClick={() => onSelectQty(t.minQty)}
              className={`relative flex min-h-[46px] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition cursor-pointer overflow-hidden disabled:cursor-not-allowed disabled:opacity-40 sm:py-2 sm:px-2 ${
                selected
                  ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-1.5 ring-emerald-600 shadow-2xs"
                  : "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/60 text-slate-700"
              }`}
            >
              {t.discountPercent > 0 && (
                <span className="absolute top-0 right-0 rounded-bl-md bg-rose-50 border-b border-l border-rose-200/90 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-600 leading-none">
                  -{t.discountPercent}%
                </span>
              )}

              {selected && (
                <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-tl-md bg-emerald-600 text-white">
                  <Check size={9} className="stroke-[3.5]" />
                </span>
              )}

              <span
                className={`text-[11px] font-semibold leading-tight sm:text-xs ${
                  selected ? "text-emerald-900" : "text-slate-600"
                }`}
              >
                {t.label} {unit ? unit.toLowerCase() : ""}
              </span>

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
  */
}
