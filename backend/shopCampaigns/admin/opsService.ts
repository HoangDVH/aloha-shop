import type { Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { SHOP_ORDERS } from "../../shopOrders/models.js";
import { PROMOTION_AUDIT_COL, PROMOTIONS_COL } from "../../shopPromotions/types.js";
import { FLASH_COUNTERS_COL, type CampaignContent } from "../types.js";
import type { CounterDiff } from "../worker/reconcileCounters.js";

const REPORT_ID = "report:reconcile";
const NOT_CANCELLED = { orderStatus: { $ne: "huy" }, status: { $ne: "huy" } };

export type RunningSummary = { revenue: number; orders: number; flashSold: number; flashHeld: number; vouchersUsed: number };

/** 4 thẻ số trang "Đang chạy": đơn có giữ suất chiến dịch (chưa huỷ, chưa nhả). */
export async function runningSummary(db: Db, campaignId: string, content: CampaignContent): Promise<RunningSummary> {
  const [orders, counters, vouchers] = await Promise.all([
    db
      .collection(SHOP_ORDERS)
      .aggregate<{ n: number; revenue: number }>([
        { $match: { "campaignHolds.campaignId": campaignId, "campaignHolds.state": { $ne: "released" }, ...NOT_CANCELLED } },
        { $group: { _id: null, n: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$total", 0] } } } },
      ])
      .toArray(),
    db
      .collection(FLASH_COUNTERS_COL)
      .aggregate<{ sold: number; held: number }>([
        { $match: { campaignId, kind: "flash" } },
        { $group: { _id: null, sold: { $sum: "$sold" }, held: { $sum: "$held" } } },
      ])
      .toArray(),
    db
      .collection(PROMOTIONS_COL)
      .find({ id: { $in: content.voucherIds } }, { projection: { usedCount: 1 } })
      .toArray(),
  ]);
  return {
    revenue: Math.round(orders[0]?.revenue || 0),
    orders: orders[0]?.n || 0,
    flashSold: counters[0]?.sold || 0,
    flashHeld: counters[0]?.held || 0,
    vouchersUsed: vouchers.reduce((s, v) => s + (Number(v.usedCount) || 0), 0),
  };
}

export type ReviewOrder = { code: string; createdAt: string; total: number; buyer: string; paymentStatus: string };

/** Đơn đã nhận tiền nhưng suất đã hết khi tiền tới (FS13) — chờ nhân viên liên hệ khách. */
export async function needsReviewOrders(db: Db): Promise<ReviewOrder[]> {
  const rows = await db
    .collection(SHOP_ORDERS)
    .find(
      { "campaignHolds.needsReview": true, "campaignHolds.reviewedAt": { $exists: false } },
      { projection: { code: 1, createdAt: 1, total: 1, customerName: 1, customerPhone: 1, paymentStatus: 1 } }
    )
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return rows.map((r) => ({
    code: String(r.code),
    createdAt: String(r.createdAt || ""),
    total: Number(r.total) || 0,
    buyer: String(r.customerName || r.customerPhone || ""),
    paymentStatus: String(r.paymentStatus || ""),
  }));
}

export async function resolveNeedsReview(db: Db, code: string, actor: string, note: string): Promise<boolean> {
  const at = new Date().toISOString();
  const r = await db.collection(SHOP_ORDERS).updateOne(
    { code, "campaignHolds.needsReview": true, "campaignHolds.reviewedAt": { $exists: false } },
    { $set: { "campaignHolds.reviewedAt": at, "campaignHolds.reviewedBy": actor, "campaignHolds.reviewNote": note.slice(0, 300) } }
  );
  if (r.modifiedCount !== 1) return false;
  await db.collection(PROMOTION_AUDIT_COL).insertOne({
    id: `aud_${Date.now()}_${randomUUID().slice(0, 6)}`,
    entity: "campaign",
    action: "campaign_review_resolved",
    actor,
    orderCode: code,
    note: note.slice(0, 300),
    createdAt: at,
  });
  return true;
}

export type ReconcileReport = { at: string; diffs: CounterDiff[]; fixed: number; source: string };

/** Worker tự sửa mỗi lượt; lưu lại lần có lệch gần nhất để admin thấy trong "Cần xử lý". */
export async function saveReconcileReport(db: Db, report: ReconcileReport): Promise<void> {
  if (!report.diffs.length) return;
  await db
    .collection(FLASH_COUNTERS_COL)
    .updateOne({ _id: REPORT_ID as any }, { $set: { kind: "report", ...report } }, { upsert: true });
}

export async function lastReconcileReport(db: Db): Promise<ReconcileReport | null> {
  const doc = await db.collection(FLASH_COUNTERS_COL).findOne({ _id: REPORT_ID as any });
  if (!doc) return null;
  return { at: String(doc.at), diffs: (doc.diffs as CounterDiff[]) || [], fixed: Number(doc.fixed) || 0, source: String(doc.source || "") };
}
