"use client";

import { shopApiBase } from "./api";

export type LivePriceRow = {
  ma: string;
  gia: number;
  ton?: number;
  ten?: string;
  anh?: string;
  path?: string;
  dvt?: string;
  trongLuong?: number;
  isActive?: boolean;
};

/** Giá + tồn mới từ Mongo — không cache (cùng API giỏ hàng). */
export async function fetchLivePrices(mas: string[]): Promise<LivePriceRow[]> {
  const uniq = [
    ...new Set(
      mas
        .map((m) => String(m || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, 80);
  if (!uniq.length) return [];

  const base = shopApiBase();
  const res = await fetch(`${base}/api/shop/products/prices`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ mas: uniq }),
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { items?: LivePriceRow[] };
  return Array.isArray(data.items) ? data.items : [];
}
