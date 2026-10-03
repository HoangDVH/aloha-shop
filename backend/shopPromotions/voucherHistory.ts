/**
 * Lịch sử dùng voucher của 1 khách, đọc từ bảng redemptions (mỗi lần áp voucher vào đơn là 1 dòng).
 * Lượt mới nhất của mỗi voucher quyết định trạng thái: đang giữ / đã dùng / đã hoàn lại (đơn huỷ, hết hạn).
 */
import type { Db } from "mongodb";
import { PROMOTION_REDEMPTIONS_COL } from "./types.js";
import { SHOP_ORDERS } from "../shopOrders/models.js";

export type VoucherReturn = { orderCode: string; reason: "cancelled" | "expired"; at: string };
export type VoucherLatest = { orderCode: string; status: "held" | "used" | "released"; at: string };

const RETURN_WINDOW_MS = 30 * 24 * 3600_000;

export async function ensureRedemptionIndexes(db: Db): Promise<void> {
  await db.collection(PROMOTION_REDEMPTIONS_COL).createIndex({ customerKey: 1, createdAt: -1 });
}

/** Lượt áp mới nhất của từng voucher cho khách (bỏ qua lượt không gắn mã đơn). */
export async function latestRedemptions(
  shopDb: Db,
  customerKey: string | undefined
): Promise<Map<string, VoucherLatest>> {
  const out = new Map<string, VoucherLatest>();
  if (!customerKey) return out;
  const rows = await shopDb
    .collection<any>(PROMOTION_REDEMPTIONS_COL)
    .find({ customerKey }, { projection: { promotionId: 1, orderCode: 1, status: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(300)
    .toArray();
  for (const r of rows) {
    const id = String(r.promotionId || "");
    if (!id || out.has(id) || !r.orderCode) continue;
    out.set(id, {
      orderCode: String(r.orderCode),
      status: r.status,
      at: String(r.updatedAt || r.createdAt || ""),
    });
  }
  return out;
}

export function voucherReturnReason(order: any): VoucherReturn["reason"] | null {
  const pay = String(order?.paymentStatus || "");
  const st = String(order?.orderStatus || order?.status || "");
  if (pay === "expired") return "expired";
  if (pay === "cancelled" || pay === "failed" || st === "huy") return "cancelled";
  return null;
}

/**
 * Voucher vừa được hoàn về cho khách vì đơn dùng nó đã huỷ / hết hạn (trong 30 ngày gần nhất).
 * Chỉ tính khi đơn còn trong hệ thống và thật sự huỷ — lượt trả do tạo đơn lỗi thì không gắn nhãn.
 */
export async function loadVoucherReturns(
  shopDb: Db,
  customerKey: string | undefined,
  latest?: Map<string, VoucherLatest>
): Promise<Map<string, VoucherReturn>> {
  const out = new Map<string, VoucherReturn>();
  const map = latest || (await latestRedemptions(shopDb, customerKey));
  const cutoff = Date.now() - RETURN_WINDOW_MS;
  const released = [...map.entries()].filter(
    ([, v]) => v.status === "released" && Date.parse(v.at) >= cutoff
  );
  if (!released.length) return out;
  const codes = [...new Set(released.map(([, v]) => v.orderCode))];
  const orders = await shopDb
    .collection<any>(SHOP_ORDERS)
    .find(
      { $or: [{ code: { $in: codes } }, { kvOrderCode: { $in: codes } }] },
      { projection: { code: 1, kvOrderCode: 1, paymentStatus: 1, orderStatus: 1, status: 1 } }
    )
    .toArray();
  const byCode = new Map<string, any>();
  for (const o of orders) {
    if (o.code) byCode.set(String(o.code), o);
    if (o.kvOrderCode) byCode.set(String(o.kvOrderCode), o);
  }
  for (const [promotionId, v] of released) {
    const reason = voucherReturnReason(byCode.get(v.orderCode));
    if (reason) out.set(promotionId, { orderCode: v.orderCode, reason, at: v.at });
  }
  return out;
}
