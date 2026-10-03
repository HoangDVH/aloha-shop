import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../../shopOrders/models.js";
import { settleCampaignHolds } from "../orderCampaign.js";
import { countersWithPendingOps } from "../flash/settleOperation.js";
import { FLASH_COUNTERS_COL } from "../types.js";

/** Bộ đếm chưa đổi trong khoảng này mới được đối soát (tránh đụng đơn đang tạo dở). */
const QUIET_MS = 3 * 60_000;

const CANCELLED = {
  $or: [
    { orderStatus: "huy" },
    { status: "huy" },
    { paymentStatus: { $in: ["expired", "cancelled", "refunded"] } },
  ],
};

/**
 * Đơn đã huỷ / hết hạn mà suất vẫn `held` (bước nhả trước đó lỗi giữa chừng) → nhả;
 * đơn đã thanh toán / giao xong mà suất vẫn `held` → chuyển `sold`.
 */
export async function settleOrphanHolds(db: Db): Promise<{ released: number; sold: number }> {
  const col = db.collection(SHOP_ORDERS);
  const out = { released: 0, sold: 0 };
  const cancelled = await col
    .find({ "campaignHolds.state": "held", ...CANCELLED }, { projection: { code: 1 } })
    .limit(200)
    .toArray();
  for (const d of cancelled) {
    if (await settleCampaignHolds(db, String(d.code), "released")) out.released++;
  }
  const done = await col
    .find(
      { "campaignHolds.state": "held", $or: [{ paymentStatus: "paid" }, { done: true }], orderStatus: { $ne: "huy" } },
      { projection: { code: 1 } }
    )
    .limit(200)
    .toArray();
  for (const d of done) {
    if (await settleCampaignHolds(db, String(d.code), "sold")) out.sold++;
  }
  return out;
}

type HeldAgg = { _id: string; qty: number };

/** Tổng suất đơn đang giữ theo từng bộ đếm, và theo từng khách của bộ đếm flash. */
async function heldFromOrders(db: Db): Promise<{ counters: Map<string, number>; customers: Map<string, number> }> {
  const col = db.collection(SHOP_ORDERS);
  const match = { $match: { "campaignHolds.state": "held" } };
  const [flash, gifts, customers] = await Promise.all([
    col.aggregate<HeldAgg>([match, { $unwind: "$campaignHolds.flash" }, { $group: { _id: "$campaignHolds.flash.counterId", qty: { $sum: "$campaignHolds.flash.qty" } } }]).toArray(),
    col.aggregate<HeldAgg>([match, { $unwind: "$campaignHolds.gifts" }, { $group: { _id: "$campaignHolds.gifts.counterId", qty: { $sum: "$campaignHolds.gifts.qty" } } }]).toArray(),
    col
      .aggregate<HeldAgg>([
        match,
        { $unwind: "$campaignHolds.flash" },
        { $unwind: "$campaignHolds.flash.customerIds" },
        {
          $group: {
            _id: { $concat: ["$campaignHolds.flash.counterId", ":", "$campaignHolds.flash.customerIds"] },
            qty: { $sum: "$campaignHolds.flash.qty" },
          },
        },
      ])
      .toArray(),
  ]);
  const counters = new Map<string, number>();
  for (const r of [...flash, ...gifts]) counters.set(r._id, (counters.get(r._id) || 0) + r.qty);
  return { counters, customers: new Map(customers.map((r) => [r._id, r.qty])) };
}

export type CounterDiff = { id: string; kind: string; held: number; expected: number };

type ReconcileOpts = { nowMs?: number; fix?: boolean; quietMs?: number };

/**
 * `held` trên bộ đếm lớn hơn tổng các đơn đang giữ (tiến trình chết giữa bước giữ suất và lưu đơn)
 * → trả phần dư. Chỉ giảm, không bao giờ tăng; update kèm điều kiện `held` cũ nên chạy lặp / song song
 * không sửa đôi. `fix: false` chỉ báo lệch.
 */
export async function reconcileFlashCounters(
  db: Db,
  { nowMs = Date.now(), fix = false, quietMs = QUIET_MS }: ReconcileOpts = {}
): Promise<{ diffs: CounterDiff[]; fixed: number }> {
  const quietBefore = new Date(nowMs - quietMs).toISOString();
  const stale = await db
    .collection(FLASH_COUNTERS_COL)
    .find({ held: { $gt: 0 }, updatedAt: { $lt: quietBefore } }, { projection: { held: 1, kind: 1 } })
    .limit(1000)
    .toArray();
  if (!stale.length) return { diffs: [], fixed: 0 };
  const [expected, pending] = await Promise.all([heldFromOrders(db), countersWithPendingOps(db)]);
  const diffs: CounterDiff[] = [];
  let fixed = 0;
  for (const c of stale) {
    const id = String(c._id);
    if (pending.has(id)) continue;
    const want = c.kind === "customer" ? expected.customers.get(id) || 0 : expected.counters.get(id) || 0;
    const extra = Number(c.held) - want;
    if (extra <= 0) continue;
    diffs.push({ id, kind: String(c.kind), held: Number(c.held), expected: want });
    if (!fix) continue;
    const r = await db
      .collection(FLASH_COUNTERS_COL)
      .updateOne({ _id: id as any, held: c.held }, { $inc: { held: -extra }, $set: { updatedAt: new Date(nowMs).toISOString() } });
    if (r.modifiedCount === 1) fixed++;
  }
  return { diffs, fixed };
}

export async function ensureCampaignHoldIndex(db: Db): Promise<void> {
  await db.collection(SHOP_ORDERS).createIndex({ "campaignHolds.state": 1 }, { sparse: true });
  await db.collection(SHOP_ORDERS).createIndex({ "campaignHolds.op.startedAt": 1 }, { sparse: true });
}
