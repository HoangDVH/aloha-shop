"use client";

import { useCart } from "./cart";
import { priceSessionGeneration, usePriceSession } from "./priceSession";
import { shopApiBase } from "./api";

export type CatalogPriceRow = {
  ma: string;
  gia: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
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
  if (!mas.length) { usePriceSession.setState({ ready: true, error: "" }); return { updated: 0, items: [] }; }

  const base = shopApiBase();
  const generation = priceSessionGeneration();
  usePriceSession.setState({ ready: false, error: "" });
  try {
  const items: CatalogPriceRow[] = [];
  for (let offset = 0; offset < mas.length; offset += 80) {
  const res = await fetch(`${base}/api/shop/products/prices`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ mas: mas.slice(offset, offset + 80) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { items?: CatalogPriceRow[] };
  if (generation !== priceSessionGeneration()) return { updated: 0, items: [] };
  items.push(...(Array.isArray(data.items) ? data.items : []));
  }
  if (generation !== priceSessionGeneration()) return { updated: 0, items: [] };
  // Missing/deleted SKUs must not retain a purchasable persisted price.
  const present = new Set(items.map(i => i.ma.toUpperCase()));
  for (const line of lines) if (!present.has(line.ma.toUpperCase())) items.push({ ...line, gia: 0, ton: 0, allowBackorder: false });

  const before = lines.map((l) => `${l.ma}:${l.gia}:${l.qty}:${l.ton ?? ""}`).join("|");
  useCart.getState().patchCatalog(items);
  const after = useCart
    .getState()
    .lines.map((l) => `${l.ma}:${l.gia}:${l.qty}:${l.ton ?? ""}`)
    .join("|");
  usePriceSession.setState({ ready: true, error: "" });
  return { updated: before === after ? 0 : items.length, items };
  } catch (error) {
    if (generation === priceSessionGeneration()) usePriceSession.setState({ ready: false, error: "Chưa kiểm tra được giá mới. Vui lòng tải lại hoặc thử lại." });
    throw error;
  }
}
