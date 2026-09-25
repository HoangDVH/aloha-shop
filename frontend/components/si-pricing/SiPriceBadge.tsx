import { formatVnd } from "@/lib/api";

export function SiPriceBadge({ price, webPrice, unit, variant = "detail" }: {
  price: number;
  webPrice?: number;
  unit?: string;
  variant?: "card" | "detail";
}) {
  const hasSaving = Number.isFinite(webPrice) && Number(webPrice) > price && price > 0;
  const discount = hasSaving ? Math.floor((Number(webPrice) - price) / Number(webPrice) * 100) : 0;
  const compact = variant === "card";
  const hasWebPrice = Number.isFinite(webPrice) && Number(webPrice) > 0;
  return (
    <div className={`flex w-full min-w-0 items-center rounded-xl bg-[#faf3e5] ${compact ? "gap-1 px-1.5 py-2 sm:gap-2 sm:px-2.5" : "gap-3 px-3 py-3 sm:gap-4 sm:px-4"}`}>
      <div className={`min-w-0 space-y-1 ${compact ? "flex-1" : "flex-initial"}`}>
        <div className={`flex min-w-0 items-baseline gap-1 ${compact ? "flex-nowrap" : "flex-nowrap sm:gap-1.5"}`}>
          <span className={`shrink-0 font-medium text-stone-700 ${compact ? "text-[9px] sm:text-[11px]" : "text-xs sm:text-sm"}`}>GIÁ SỈ</span>
          <span aria-label={`Giá sỉ: ${formatVnd(price)}`} className={`whitespace-nowrap font-extrabold tracking-tight text-[#bd2027] tabular-nums ${compact ? "text-sm sm:text-lg" : "text-2xl sm:text-3xl"}`}>
            {formatVnd(price)}
          </span>
          {unit ? <span title={unit} className={`min-w-0 truncate font-normal text-stone-600 ${compact ? "text-[9px] sm:text-[10px]" : "text-xs sm:text-sm"}`}>/ {unit}</span> : null}
        </div>
        {hasWebPrice ? (
          <div className={`flex flex-wrap items-baseline gap-1 font-normal text-stone-500 ${compact ? "text-[10px] sm:text-xs" : "text-sm sm:text-base"}`}>
            <span className="shrink-0">Giá lẻ</span>
            <del aria-label={`Giá lẻ (giá web): ${formatVnd(webPrice!)}`} className="whitespace-nowrap tabular-nums">{formatVnd(webPrice!)}</del>
          </div>
        ) : null}
      </div>
      {discount > 0 ? (
        <span title="Tiết kiệm so với giá web" aria-label={`Thấp hơn giá web ${discount}%`} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#c82029] font-bold text-white ring-1 ring-inset ring-black/5 ${compact ? "h-7 w-7 text-[9px] sm:h-10 sm:w-10 sm:text-xs" : "h-12 w-12 text-sm sm:h-14 sm:w-14 sm:text-base"}`}>
          -{discount}%
        </span>
      ) : null}
    </div>
  );
}
