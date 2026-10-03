import crypto from "node:crypto";
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../../shopOrders/models.js";
import { FLASH_COUNTERS_COL } from "../types.js";
import { customerDocId } from "./flashCounters.js";
import type { CampaignHolds, HoldOperation } from "./flashTypes.js";

/**
 * Chốt / nhả suất của 1 đơn gồm nhiều bước (bộ đếm SP, bộ đếm từng khách, bộ đếm quà) mà Mongo
 * standalone không có transaction. Mỗi bước ghi dấu `operationId:i` vào chính document bộ đếm trong
 * cùng lệnh update, nên chạy lại sau khi tiến trình chết chỉ làm nốt bước chưa xong (WK03).
 */

/** Thao tác dở quá lâu mới được worker làm tiếp; phải nhỏ hơn QUIET_MS của đối soát. */
export const RESUME_AFTER_MS = 2 * 60_000;

type Step = { id: string; qty: number };

function stepsOf(h: Pick<CampaignHolds, "flash" | "gifts">): Step[] {
  const out: Step[] = [];
  for (const f of h.flash || []) {
    out.push({ id: f.counterId, qty: f.qty });
    for (const key of f.customerIds || []) out.push({ id: customerDocId(f.counterId, key), qty: f.qty });
  }
  for (const g of h.gifts || []) out.push({ id: g.counterId, qty: g.qty });
  return out;
}

/** Id mọi bộ đếm 1 đơn đụng tới (đối soát bỏ qua các bộ đếm đang có thao tác dở). */
export const counterIdsOf = (h: Pick<CampaignHolds, "flash" | "gifts">) => stepsOf(h).map((s) => s.id);

const marker = (op: HoldOperation, i: number) => `${op.id}:${i}`;

async function applySteps(db: Db, steps: Step[], op: HoldOperation): Promise<void> {
  const col = db.collection(FLASH_COUNTERS_COL);
  for (let i = 0; i < steps.length; i++) {
    const { id, qty } = steps[i];
    const inc = op.target === "sold" ? { held: -qty, sold: qty } : { held: -qty };
    await col.updateOne(
      { _id: id as any, held: { $gte: qty }, ops: { $ne: marker(op, i) } },
      { $inc: inc, $push: { ops: marker(op, i) } as any, $set: { updatedAt: new Date().toISOString() } }
    );
  }
}

/** Làm (tiếp) thao tác: áp các bước → chuyển `cleanup` → gỡ dấu trên bộ đếm → xoá `op` khỏi đơn. */
export async function runHoldOperation(db: Db, orderCode: string, holds: CampaignHolds, op: HoldOperation): Promise<void> {
  const orders = db.collection(SHOP_ORDERS);
  const steps = stepsOf(holds);
  const mine = { code: orderCode, "campaignHolds.op.id": op.id };
  if (op.phase === "apply") {
    await applySteps(db, steps, op);
    await orders.updateOne(mine, { $set: { "campaignHolds.op.phase": "cleanup" } });
  }
  if (steps.length) {
    const ids = [...new Set(steps.map((s) => s.id))];
    await db
      .collection(FLASH_COUNTERS_COL)
      .updateMany({ _id: { $in: ids as any[] } }, { $pull: { ops: { $in: steps.map((_, i) => marker(op, i)) } } as any });
  }
  await orders.updateOne(mine, { $unset: { "campaignHolds.op": "" } });
}

/** Đổi trạng thái `from → to` kèm operationId mới; null = đơn không ở `from` (đã có nơi khác xử lý). */
export async function beginHoldOperation(
  db: Db,
  orderCode: string,
  from: CampaignHolds["state"],
  target: HoldOperation["target"]
): Promise<{ holds: CampaignHolds; op: HoldOperation } | null> {
  const now = new Date().toISOString();
  const op: HoldOperation = { id: crypto.randomUUID(), target, phase: "apply", startedAt: now };
  const doc = await db.collection(SHOP_ORDERS).findOneAndUpdate(
    { code: orderCode, "campaignHolds.state": from, "campaignHolds.op": { $exists: false } },
    { $set: { "campaignHolds.state": target, "campaignHolds.settledAt": now, "campaignHolds.op": op } },
    { returnDocument: "before", projection: { campaignHolds: 1 } }
  );
  const holds = (doc?.campaignHolds as CampaignHolds | undefined) || null;
  return holds ? { holds, op } : null;
}

/** Worker: làm nốt thao tác bị bỏ dở (tiến trình chết giữa chừng). */
export async function resumeHoldOperations(db: Db, nowMs = Date.now()): Promise<number> {
  const before = new Date(nowMs - RESUME_AFTER_MS).toISOString();
  const rows = await db
    .collection(SHOP_ORDERS)
    .find({ "campaignHolds.op.startedAt": { $lt: before } }, { projection: { code: 1, campaignHolds: 1 } })
    .limit(100)
    .toArray();
  for (const r of rows) {
    const holds = r.campaignHolds as CampaignHolds;
    if (holds.op) await runHoldOperation(db, String(r.code), holds, holds.op);
  }
  return rows.length;
}

/** Bộ đếm của các đơn đang có thao tác dở. */
export async function countersWithPendingOps(db: Db): Promise<Set<string>> {
  const rows = await db
    .collection(SHOP_ORDERS)
    .find({ "campaignHolds.op": { $exists: true } }, { projection: { campaignHolds: 1 } })
    .limit(500)
    .toArray();
  return new Set(rows.flatMap((r) => counterIdsOf(r.campaignHolds as CampaignHolds)));
}
