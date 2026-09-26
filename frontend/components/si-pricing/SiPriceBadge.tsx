import { formatVnd } from "@/lib/api";

export function SiPriceBadge({ price, webPrice, unit, variant = "detail" }: {
  price: number;
  webPrice?: number;
  unit?: string;
  variant?: "card" | "wholesale-card" | "wholesale-detail" | "detail";
}) {
  const hasSaving = Number.isFinite(webPrice) && Number(webPrice) > price && price > 0;
  const discount = hasSaving ? Math.floor(((Number(webPrice) - price) / Number(webPrice)) * 100) : 0;
  const hasWebPrice = Number.isFinite(webPrice) && Number(webPrice) > 0;

  if (variant === "wholesale-card") {
    return (
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span
          aria-label={`Giá sỉ: ${formatVnd(price)}`}
          className="whitespace-nowrap text-[14px] font-extrabold leading-tight tracking-tight text-[#ee4d2d] tabular-nums sm:text-base"
        >
          {formatVnd(price)}
        </span>
        {hasWebPrice ? (
          <del
            aria-label={`Giá web: ${formatVnd(webPrice!)}`}
            className="whitespace-nowrap text-[10px] font-medium text-gray-400 tabular-nums sm:text-[11px]"
          >
            {formatVnd(webPrice!)}
          </del>
        ) : null}
        {unit ? <span className="w-full text-[10px] text-[var(--aloha-muted)]">/ {unit}</span> : null}
      </div>
    );
  }

  if (variant === "wholesale-detail") {
    return (
      <div className="flex w-full min-w-0 flex-nowrap items-baseline gap-2 bg-[#faf7f6] px-2 py-3 sm:gap-3 sm:px-4">
        <span
          aria-label={`Giá sỉ: ${formatVnd(price)}`}
          className="whitespace-nowrap text-[clamp(18px,5vw,30px)] font-normal leading-tight tracking-tight text-[#ee4d2d] tabular-nums"
        >
          {formatVnd(price)}
          {unit ? (
            <span className="ml-1 text-xs font-normal text-[var(--aloha-muted)] sm:text-base">
              / {unit}
            </span>
          ) : null}
        </span>
        {hasWebPrice ? (
          <del
            aria-label={`Giá web: ${formatVnd(webPrice!)}`}
            className="whitespace-nowrap text-xs text-gray-400 tabular-nums sm:text-base"
          >
            {formatVnd(webPrice!)}
          </del>
        ) : null}
        {discount > 0 ? (
          <span
            aria-label={`Thấp hơn giá web ${discount}%`}
            className="shrink-0 whitespace-nowrap rounded-sm bg-[#fff0eb] px-1.5 py-0.5 text-xs font-semibold text-[#ee4d2d] sm:text-sm"
          >
            -{discount}%
          </span>
        ) : null}
      </div>
    );
  }

  /** Grid card: gọn như Shopee/B2B — giá chính + % + MSRP gạch, không panel/label «GIÁ SỈ». */
  if (variant === "card") {
    return (
      <div className="flex min-h-[2.65rem] min-w-0 flex-col justify-end">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <span
            aria-label={`Giá sỉ: ${formatVnd(price)}`}
            className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-[#bd2027] tabular-nums sm:text-base"
          >
            {formatVnd(price)}
          </span>
          {unit ? (
            <span
              title={unit}
              className="max-w-[4.5rem] truncate text-[10px] font-semibold text-[var(--aloha-muted)] sm:text-[11px]"
            >
              / {unit}
            </span>
          ) : null}
          {discount > 0 ? (
            <span
              title="Tiết kiệm so với giá web"
              aria-label={`Thấp hơn giá web ${discount}%`}
              className="inline-flex shrink-0 items-center rounded px-1 py-px text-[9px] font-bold leading-none text-[#c82029] ring-1 ring-[#c82029]/25 sm:text-[10px]"
            >
              -{discount}%
            </span>
          ) : null}
        </div>
        {hasWebPrice ? (
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[10px] text-stone-500 sm:text-[11px]">
            <del
              aria-label={`Giá lẻ (giá web): ${formatVnd(webPrice!)}`}
              className="whitespace-nowrap tabular-nums"
            >
              {formatVnd(webPrice!)}
            </del>
          </div>
        ) : (
          <div className="mt-0.5 h-[1.05rem]" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-3 rounded-xl bg-[#faf3e5] px-3 py-3 sm:gap-4 sm:px-4">
      <div className="min-w-0 flex-initial space-y-1">
        <div className="flex min-w-0 flex-nowrap items-baseline gap-1 sm:gap-1.5">
          <span className="shrink-0 text-xs font-medium text-stone-700 sm:text-sm">GIÁ SỈ</span>
          <span
            aria-label={`Giá sỉ: ${formatVnd(price)}`}
            className="whitespace-nowrap text-2xl font-extrabold tracking-tight text-[#bd2027] tabular-nums sm:text-3xl"
          >
            {formatVnd(price)}
          </span>
          {unit ? (
            <span title={unit} className="min-w-0 truncate text-xs font-normal text-stone-600 sm:text-sm">
              / {unit}
            </span>
          ) : null}
        </div>
        {hasWebPrice ? (
          <div className="flex flex-wrap items-baseline gap-1 text-sm font-normal text-stone-500 sm:text-base">
            <span className="shrink-0">Giá lẻ</span>
            <del aria-label={`Giá lẻ (giá web): ${formatVnd(webPrice!)}`} className="whitespace-nowrap tabular-nums">
              {formatVnd(webPrice!)}
            </del>
          </div>
        ) : null}
      </div>
      {discount > 0 ? (
        <span
          title="Tiết kiệm so với giá web"
          aria-label={`Thấp hơn giá web ${discount}%`}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#c82029] text-sm font-bold text-white ring-1 ring-inset ring-black/5 sm:h-14 sm:w-14 sm:text-base"
        >
          -{discount}%
        </span>
      ) : null}
    </div>
  );
}
