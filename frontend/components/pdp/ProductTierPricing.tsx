"use client";
import { Check } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { DEFAULT_VOLUME_TIERS, calculateTierPrice } from "@/lib/volumePricing";
type Props = { basePrice: number; unit?: string; qty: number; onSelectQty: (qty: number) => void; disabled?: boolean; maxQty?: number; liveWebPrice?: number };
export function ProductTierPricing({ basePrice, unit = "cái", qty, onSelectQty, disabled = false, maxQty = 10000 }: Props) {
  if (basePrice <= 0) return null;
  const tier = calculateTierPrice(basePrice, qty).tier;
  return <section className="space-y-2" aria-label="Giá theo số lượng">
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {DEFAULT_VOLUME_TIERS.map(t => {
        const selected = t.minQty === tier.minQty;
        return <button key={t.minQty} type="button" aria-pressed={selected}
          disabled={disabled || t.minQty > maxQty} onClick={() => onSelectQty(t.minQty)}
          className={`relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-1 py-3 text-center transition disabled:opacity-40 sm:px-2 ${selected ? "border-green-600 bg-green-50/70" : "border-stone-200 bg-stone-50 hover:border-green-300"}`}>
          {selected && <span className="absolute right-1.5 top-1.5 rounded-full bg-green-700 p-0.5 text-white"><Check size={11}/></span>}
          <span className={`text-[11px] font-medium ${selected ? "text-green-800" : "text-slate-500"}`}>{t.label} {unit}</span>
          <span className="flex flex-wrap items-baseline justify-center gap-x-0.5 sm:gap-x-1.5">
            <span className={`whitespace-nowrap text-[12px] font-extrabold tabular-nums sm:text-lg ${selected ? "text-[#e65343]" : "text-slate-800"}`}>{formatVnd(Math.round(basePrice * (1 - t.discountPercent / 100)))}</span>
            <span className="text-[10px] font-semibold text-slate-600 sm:text-[13px]">/{unit.toLowerCase()}</span>
          </span>
        </button>;
      })}
    </div>
  </section>;
}
