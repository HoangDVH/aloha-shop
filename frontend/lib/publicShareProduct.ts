import type { ShopProduct } from "./api";
import type { AvailablePromotionUI } from "./promotions";

export async function fetchPublicShareOffers(signal?: AbortSignal): Promise<AvailablePromotionUI[]> {
  const res = await fetch("/api/shop/promotions/available", { credentials: "omit", cache: "no-store", signal });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/** Sharing uses anonymous retail data, never the account's wholesale or voucher price. */
export async function fetchPublicShareProduct(ma: string, signal?: AbortSignal): Promise<ShopProduct> {
  const res = await fetch(`/api/shop/products/${encodeURIComponent(ma)}`, { credentials: "omit", cache: "no-store", signal });
  if (!res.ok) throw new Error("Không tải được giá công khai");
  const data = await res.json();
  if (!data.item?.ma) throw new Error("Không tìm thấy sản phẩm");
  return data.item;
}
