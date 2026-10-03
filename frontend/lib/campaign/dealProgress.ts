import type { CampaignPromoUI } from "./campaignApi";

/**
 * `state`: upcoming = ngoài khung / chưa mở; fresh = đang mở, chưa bán suất nào; selling; low = tồn kho thật còn 1–4;
 * soldOut = hết suất của khung (card hiện giá thường, server cũng tính giá thường); live = đang mở nhưng không có số suất.
 */
export type DealProgress = {
  left: string;
  right: string;
  pct: number;
  soldOut: boolean;
  state: "upcoming" | "fresh" | "selling" | "low" | "soldOut" | "live";
};

/** Tồn kho thật dưới mức này thì thanh chuyển "Sắp cháy" và nhấp nháy. */
export const LOW_STOCK_THRESHOLD = 5;

const VN = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");
const vnDay = (ms: number) => Math.floor((ms + VN) / 86_400_000);

/** "Mở bán 12:00" (hôm nay) / "Mở bán 12:00 ngày mai" / "Mở bán 12:00, 05/10". */
export function opensText(iso: string, nowMs: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "Sắp mở bán";
  const d = new Date(at + VN);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const days = vnDay(at) - vnDay(nowMs);
  if (days <= 0) return `Mở bán ${time}`;
  if (days === 1) return `Mở bán ${time} ngày mai`;
  return `Mở bán ${time}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/**
 * Thanh "đã bán / còn lại" của SP flash sale, tính theo suất giá sale của khung (không theo tồn kho tổng).
 * Trả null khi SP không có giá sale trong chiến dịch.
 * `stockCap`: tồn kho thật khi SP không nhận đặt trước — không hiện số suất lớn hơn số khách mua được.
 * `stock`: tồn kho đang có (kể cả SP nhận đặt trước), quyết định trạng thái "Sắp cháy".
 */
export function flashDealProgress(
  promo: CampaignPromoUI | null | undefined,
  selling: boolean,
  stockCap: number | null,
  nowMs: number,
  stock: number | null = null
): DealProgress | null {
  if (!promo || promo.salePrice == null || (promo.kind !== "flash" && promo.kind !== "teaser")) return null;
  if (!selling) {
    const at = promo.opensAt || (promo.kind === "teaser" ? promo.endsAt : null);
    return { left: at ? opensText(at, nowMs) : "Sắp mở bán", right: "Sắp diễn ra", pct: 0, soldOut: false, state: "upcoming" };
  }
  const pct = pctOf(promo);
  const lowStock = lowStockOf(stock);
  if (promo.remaining == null) {
    return lowStock != null ? lowProgress(lowStock, pct) : { left: "Giá sốc đang diễn ra", right: "", pct, soldOut: false, state: "live" };
  }
  const remaining = stockCap == null ? promo.remaining : Math.min(promo.remaining, stockCap);
  if (remaining <= 0) {
    return { left: "Đã hết suất giá sale", right: "Về giá thường", pct: 100, soldOut: true, state: "soldOut" };
  }
  return tieredProgress(promo, remaining, lowStock);
}

/** Phần tô / chữ "Đang bán chạy" bắt đầu từ mức này. */
export const HOT_PCT = 50;
/** Từ mức này (hoặc còn ≤ LOW_QUOTA_LEFT suất) chuyển "Chỉ còn N suất". */
export const NEARLY_GONE_PCT = 80;
export const LOW_QUOTA_LEFT = 3;

const pctOf = (promo: CampaignPromoUI) => Math.max(0, Math.min(100, Math.round(promo.soldPct ?? 0)));
const lowStockOf = (stock: number | null) => (stock != null && stock > 0 && stock < LOW_STOCK_THRESHOLD ? Math.floor(stock) : null);
const lowProgress = (n: number, pct: number): DealProgress => ({ left: `Chỉ còn ${n} suất cuối!`, right: "Sắp cháy", pct, soldOut: false, state: "low" });

/**
 * Chữ trên thanh theo giai đoạn kiểu sàn TMĐT, chỉ dùng số thật:
 * sắp hết → "Chỉ còn N suất"; chưa ai mua → "Vừa mở bán"; ≥ 50% → "Đang bán chạy · Đã bán N"; còn lại → "Đã bán N".
 */
function tieredProgress(promo: CampaignPromoUI, remaining: number, lowStock: number | null): DealProgress {
  const pct = pctOf(promo);
  if (lowStock != null) return lowProgress(Math.min(remaining, lowStock), pct);
  if (remaining <= LOW_QUOTA_LEFT || pct >= NEARLY_GONE_PCT) return lowProgress(remaining, pct);
  const sold = promo.soldQty;
  if (pct === 0 && !sold) return { left: "Vừa mở bán", right: "", pct, soldOut: false, state: "fresh" };
  const count = sold != null ? `Đã bán ${sold}` : `Đã bán ${pct}%`;
  if (pct >= HOT_PCT) return { left: "Đang bán chạy", right: count, pct, soldOut: false, state: "selling" };
  return { left: count, right: "", pct, soldOut: false, state: "selling" };
}

/**
 * Thanh của SP chỉ có giá trước KM (khách trả giá web): số đã bán giá web / số suất admin đặt.
 * Hết suất vẫn mua được giá web nên không bao giờ báo "hết suất" mà ghi "Bán chạy · Đã bán N".
 * Không có số suất thì chỉ hiện tồn kho thật. Trả null khi không phải giá gạch hoặc hết hàng không nhận đặt trước.
 */
export function anchorDealProgress(
  promo: CampaignPromoUI | null | undefined,
  stock: number | null,
  allowBackorder?: boolean
): DealProgress | null {
  if (!promo || promo.salePrice != null || !((promo.compareAtPrice ?? 0) > promo.listPrice)) return null;
  const inStock = stock != null && stock > 0 ? Math.floor(stock) : 0;
  const pct = pctOf(promo);
  if (!inStock && allowBackorder === false) return null;
  if (promo.remaining != null && promo.soldPct != null) {
    const lowStock = lowStockOf(stock);
    if (promo.remaining <= 0 && lowStock != null) return lowProgress(lowStock, 100);
    if (promo.remaining <= 0) {
      const count = promo.soldQty != null ? `Đã bán ${promo.soldQty}` : "";
      return { left: "Bán chạy", right: count, pct: 100, soldOut: false, state: "selling" };
    }
    return tieredProgress(promo, promo.remaining, lowStock);
  }
  if (inStock > 0 && inStock < LOW_STOCK_THRESHOLD) return lowProgress(inStock, pct);
  return { left: "Ưu đãi đang diễn ra", right: inStock ? `Còn ${inStock}` : "Nhận đặt trước", pct: 0, soldOut: false, state: "live" };
}
