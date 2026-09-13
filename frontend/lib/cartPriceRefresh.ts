"use client";

import { useCart } from "./cart";
import { shopApiBase } from "./api";

export type CatalogPriceRow = {
  ma: string;
  gia: number;
  ton?: number;
  ten: string;
  anh: string;
  path: string;
  dvt: string;
  trongLuong?: number;
  attributes?: import("./api").ShopProductAttr[];
};

/**
 * Lấy giá mới từ server (không cache) rồi ghi đè vào giỏ local.
 * Search đã hiện giá mới; giỏ/checkout từng giữ giá lúc thêm — gọi khi mở trang.
 */
export async function refreshCartPricesFromCatalog(): Promise<{
  updated: number;
  items: CatalogPriceRow[];
}> {
  const lines = useCart.getState().lines;
  const mas = [
    ...new Set(
      lines
        .map((l) => String(l.ma || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (!mas.length) return { updated: 0, items: [] };

  const base = shopApiBase();
  const res = await fetch(`${base}/api/shop/products/prices`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ mas }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { items?: CatalogPriceRow[] };
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) return { updated: 0, items: [] };

  const before = lines.map((l) => `${l.ma}:${l.gia}:${l.qty}:${l.ton ?? ""}`).join("|");
  useCart.getState().patchCatalog(items);
  const after = useCart
    .getState()
    .lines.map((l) => `${l.ma}:${l.gia}:${l.qty}:${l.ton ?? ""}`)
    .join("|");
  return { updated: before === after ? 0 : items.length, items };
}
