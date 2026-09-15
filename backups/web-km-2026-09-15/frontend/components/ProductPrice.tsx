"use client";

import { formatVnd } from "@/lib/api";

export type ProductPriceProps = {
  gia: number;
  giaGoc?: number | null;
  dangKm?: boolean;
  phanTramGiam?: number | null;
  /** card = badge góc ảnh riêng; inline = badge cạnh giá */
  layout?: "stack" | "inline" | "compact";
  className?: string;
  priceClassName?: string;
};

/** Giá chuẩn sàn: bán đỏ + gốc gạch + % (khi dangKm). */
export function ProductPrice({
  gia,
  giaGoc,
  dangKm,
  phanTramGiam,
  layout = "stack",
  className = "",
  priceClassName = "",
}: ProductPriceProps) {
  const onSale =
    Boolean(dangKm) &&
    Number(giaGoc) > 0 &&
    Number(gia) > 0 &&
    Number(gia) < Number(giaGoc);
  const pct =
    onSale && Number(phanTramGiam) > 0
      ? Math.round(Number(phanTramGiam))
      : onSale
        ? Math.max(
            1,
            Math.min(
              99,
              Math.round((1 - Number(gia) / Number(giaGoc)) * 100)
            )
          )
        : 0;

  if (!onSale) {
    return (
      <span
        className={`font-extrabold tabular-nums text-[color:var(--aloha-price,#c2410c)] ${priceClassName} ${className}`}
      >
        {formatVnd(gia)}
      </span>
    );
  }

  if (layout === "compact") {
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
        <span
          className={`font-extrabold tabular-nums text-[color:var(--aloha-price,#c2410c)] ${priceClassName}`}
        >
          {formatVnd(gia)}
        </span>
        <span className="text-xs text-slate-400 line-through tabular-nums">
          {formatVnd(Number(giaGoc))}
        </span>
        {pct > 0 ? (
          <span className="text-[10px] font-bold text-red-600">-{pct}%</span>
        ) : null}
      </span>
    );
  }

  if (layout === "inline") {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
        <span
          className={`font-extrabold tabular-nums text-[color:var(--aloha-price,#c2410c)] ${priceClassName}`}
        >
          {formatVnd(gia)}
        </span>
        <span className="text-sm text-slate-400 line-through tabular-nums">
          {formatVnd(Number(giaGoc))}
        </span>
        {pct > 0 ? (
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{pct}%
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={`flex flex-col gap-0.5 ${className}`}>
      <span className="flex flex-wrap items-baseline gap-2">
        <span
          className={`font-extrabold tabular-nums text-[color:var(--aloha-price,#c2410c)] ${priceClassName}`}
        >
          {formatVnd(gia)}
        </span>
        <span className="text-sm text-slate-400 line-through tabular-nums">
          {formatVnd(Number(giaGoc))}
        </span>
      </span>
    </span>
  );
}

/** Badge % góc ảnh card (Shopee-style). */
export function ProductSaleBadge({
  dangKm,
  phanTramGiam,
  gia,
  giaGoc,
  className = "",
}: {
  dangKm?: boolean;
  phanTramGiam?: number | null;
  gia?: number;
  giaGoc?: number | null;
  className?: string;
}) {
  const onSale =
    Boolean(dangKm) &&
    Number(giaGoc) > 0 &&
    Number(gia) > 0 &&
    Number(gia) < Number(giaGoc);
  if (!onSale) return null;
  const pct =
    Number(phanTramGiam) > 0
      ? Math.round(Number(phanTramGiam))
      : Math.max(
          1,
          Math.min(99, Math.round((1 - Number(gia) / Number(giaGoc)) * 100))
        );
  if (!(pct > 0)) return null;
  return (
    <span
      className={`absolute left-1.5 top-1.5 z-[1] rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm ${className}`}
    >
      -{pct}%
    </span>
  );
}
