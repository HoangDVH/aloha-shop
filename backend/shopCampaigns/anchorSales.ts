import type { Db } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "../shopOrders/models.js";
import type { ActiveCampaign } from "./currentCampaign.js";
import { isSelling } from "./campaignPhase.js";
import { promoRowFor, type FlashStockLookup } from "./campaignPromo.js";
import type { CampaignProduct } from "./types.js";

const SOLD_TTL_MS = 30_000;
const DEAD_PAYMENT = ["expired", "cancelled", "failed"];
const soldCache = new Map<string, { at: number; sold: Map<string, number> }>();

/** Dòng chỉ có giá trước KM (khách trả giá web) và có số suất để tính "Đã bán x%". */
export function isAnchorRow(p: CampaignProduct): boolean {
  return !(p.salePrice > 0) && (Number(p.compareAtPrice) || 0) > 0 && p.quota > 0 && !p.paused;
}

/**
 * Chênh (giá trước KM − giá khách trả) × SL cho dòng không flash, không quà. Chỉ để hiện dòng
 * "Giảm giá sản phẩm"; không cộng vào tiền hàng, KiotViet hay hoa hồng.
 */
export function anchorSavingsOf(active: ActiveCampaign, details: ShopOrderDetail[], nowMs: number): number {
  if (!isSelling(active.phase)) return 0;
  let sum = 0;
  for (const d of details) {
    if (d.isGift || d.flash || !(d.price > 0)) continue;
    const p = promoRowFor(active, String(d.productCode || "").toUpperCase(), nowMs);
    const anchor = p && !(p.salePrice > 0) ? Math.round(Number(p.compareAtPrice) || 0) : 0;
    if (anchor > d.price) sum += (anchor - d.price) * d.quantity;
  }
  return sum;
}

/**
 * Số cây đã bán theo mã từ lúc chiến dịch bắt đầu (bỏ dòng quà, đơn huỷ / hết hạn / lỗi thanh toán).
 * Chiến dịch chỉ cho tài khoản thử thì đếm cả đơn thử; chiến dịch thật bỏ đơn thử.
 */
export async function loadAnchorSold(db: Db, active: ActiveCampaign, mas: string[]): Promise<Map<string, number>> {
  if (!mas.length) return new Map();
  const startIso = new Date(active.content.info.startAt).toISOString();
  const rows = await db
    .collection(SHOP_ORDERS)
    .aggregate<{ _id: string; qty: number }>([
      {
        $match: {
          createdAt: { $gte: startIso },
          orderStatus: { $ne: "huy" },
          paymentStatus: { $nin: DEAD_PAYMENT },
          "orderDetails.productCode": { $in: mas },
          ...(active.content.info.testOnly ? {} : { isTest: { $ne: true } }),
        },
      },
      { $unwind: "$orderDetails" },
      { $match: { "orderDetails.productCode": { $in: mas }, "orderDetails.isGift": { $ne: true } } },
      { $group: { _id: "$orderDetails.productCode", qty: { $sum: "$orderDetails.quantity" } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id).toUpperCase(), Math.max(0, Number(r.qty) || 0)]));
}

async function cachedSold(db: Db, active: ActiveCampaign, mas: string[], nowMs: number): Promise<Map<string, number>> {
  const key = `${active.id}:${active.publishedAt || ""}`;
  const hit = soldCache.get(key);
  if (hit && nowMs - hit.at < SOLD_TTL_MS) return hit.sold;
  const sold = await loadAnchorSold(db, active, mas);
  soldCache.set(key, { at: nowMs, sold });
  return sold;
}

/** Nguồn "Đã bán x% / Còn y suất" cho dòng giá gạch; số suất chỉ để hiển thị, không chặn mua. */
export async function anchorStockLookup(db: Db, active: ActiveCampaign, nowMs: number): Promise<FlashStockLookup | undefined> {
  const rows = active.content.products.filter(isAnchorRow);
  if (!rows.length) return undefined;
  const sold = await cachedSold(db, active, [...new Set(rows.map((p) => p.ma))], nowMs);
  return (p) => {
    if (!isAnchorRow(p)) return null;
    const used = sold.get(p.ma.toUpperCase()) || 0;
    return { remaining: Math.max(0, p.quota - used), soldPct: Math.min(100, Math.round((used / p.quota) * 100)), sold: used };
  };
}
