import type { Db } from "mongodb";
import { FLASH_COUNTERS_COL } from "../types.js";
import type { FlashHold, GiftHold } from "./flashTypes.js";

/**
 * Bộ đếm suất (Mongo standalone, không transaction): chỉ dùng update có điều kiện trên `_id` cố định.
 * `sold + held <= quota` luôn đúng vì mọi lần tăng `held` đều kèm điều kiện đó.
 */
export type CounterDoc = {
  _id: string;
  kind: "flash" | "gift";
  campaignId: string;
  ma: string;
  quota: number;
  held: number;
  sold: number;
  updatedAt: string;
};

type CustomerDoc = { _id: string; kind: "customer"; counterId: string; held: number; sold: number; updatedAt: string };

export type CounterSpec = { id: string; kind: "flash" | "gift"; campaignId: string; ma: string; quota: number };

const col = (db: Db) => db.collection<CounterDoc>(FLASH_COUNTERS_COL);
const custCol = (db: Db) => db.collection<CustomerDoc>(FLASH_COUNTERS_COL);
const nowIso = () => new Date().toISOString();
export const customerDocId = (counterId: string, key: string) => `${counterId}:${key}`;

export async function ensureFlashCounterIndexes(db: Db): Promise<void> {
  await col(db).createIndex({ campaignId: 1, kind: 1 });
}

export async function counterSnapshot(db: Db, ids: string[]): Promise<Map<string, CounterDoc>> {
  if (!ids.length) return new Map();
  const rows = await col(db).find({ _id: { $in: ids } }).toArray();
  return new Map(rows.map((r) => [r._id, r]));
}

/** Số đã mua (đã bán + đang giữ) lớn nhất trong các khoá của khách (tài khoản, SĐT). */
export async function customerUsage(db: Db, counterIds: string[], keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!counterIds.length || !keys.length) return out;
  const ids = counterIds.flatMap((c) => keys.map((k) => customerDocId(c, k)));
  const rows = await custCol(db).find({ _id: { $in: ids } }).toArray();
  for (const r of rows) out.set(r.counterId, Math.max(out.get(r.counterId) || 0, (r.held || 0) + (r.sold || 0)));
  return out;
}

async function ensureCounter(db: Db, spec: CounterSpec): Promise<void> {
  const update = {
    $set: { quota: spec.quota, updatedAt: nowIso() },
    $setOnInsert: { kind: spec.kind, campaignId: spec.campaignId, ma: spec.ma, held: 0, sold: 0 },
  };
  try {
    await col(db).updateOne({ _id: spec.id }, update, { upsert: true });
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
    await col(db).updateOne({ _id: spec.id }, update);
  }
}

/** Giữ `qty` suất nếu còn đủ; false = hết suất. */
export async function holdCounter(db: Db, spec: CounterSpec, qty: number): Promise<boolean> {
  await ensureCounter(db, spec);
  const r = await col(db).updateOne(
    { _id: spec.id, $expr: { $lte: [{ $add: ["$sold", "$held", qty] }, "$quota"] } },
    { $inc: { held: qty }, $set: { updatedAt: nowIso() } }
  );
  return r.modifiedCount === 1;
}

/** Trả suất đang giữ (huỷ / hết hạn) hoặc chuyển sang đã bán; không bao giờ để âm. */
export async function settleCounter(db: Db, id: string, qty: number, target: "sold" | "released"): Promise<boolean> {
  const inc = target === "sold" ? { held: -qty, sold: qty } : { held: -qty };
  const r = await col(db).updateOne({ _id: id, held: { $gte: qty } }, { $inc: inc, $set: { updatedAt: nowIso() } });
  return r.modifiedCount === 1;
}

/** Hoàn suất đã bán (chỉ dùng khi xoá đơn test). */
export async function unsellCounter(db: Db, id: string, qty: number, customerKeys: string[] = []): Promise<void> {
  await col(db).updateOne({ _id: id, sold: { $gte: qty } }, { $inc: { sold: -qty }, $set: { updatedAt: nowIso() } });
  for (const key of customerKeys) {
    await custCol(db).updateOne({ _id: customerDocId(id, key), sold: { $gte: qty } }, { $inc: { sold: -qty } });
  }
}

async function holdCustomer(db: Db, counterId: string, key: string, limit: number, qty: number): Promise<boolean> {
  const _id = customerDocId(counterId, key);
  const base = { $setOnInsert: { kind: "customer" as const, counterId, held: 0, sold: 0 }, $set: { updatedAt: nowIso() } };
  try {
    await custCol(db).updateOne({ _id }, base, { upsert: true });
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
  }
  const cond = Number.isFinite(limit) ? { $expr: { $lte: [{ $add: ["$sold", "$held", qty] }, limit] } } : {};
  const r = await custCol(db).updateOne({ _id, ...cond }, { $inc: { held: qty }, $set: { updatedAt: nowIso() } });
  return r.modifiedCount === 1;
}

async function settleCustomer(db: Db, counterId: string, key: string, qty: number, target: "sold" | "released") {
  const inc = target === "sold" ? { held: -qty, sold: qty } : { held: -qty };
  await custCol(db).updateOne(
    { _id: customerDocId(counterId, key), held: { $gte: qty } },
    { $inc: inc, $set: { updatedAt: nowIso() } }
  );
}

export type FlashHoldRequest = { spec: CounterSpec; qty: number; limit: number };

/**
 * Giữ suất cho mọi dòng giá sale của 1 đơn; dòng nào thiếu suất / vượt giới hạn khách thì
 * hoàn lại những gì đã giữ và báo thất bại (đơn tính lại giá).
 */
export async function holdFlashLines(
  db: Db,
  reqs: FlashHoldRequest[],
  customerKeys: string[]
): Promise<{ ok: true; holds: FlashHold[] } | { ok: false; counterId: string }> {
  const done: FlashHold[] = [];
  for (const r of reqs) {
    if (!(await holdCounter(db, r.spec, r.qty))) {
      await settleFlashHolds(db, done, "released");
      return { ok: false, counterId: r.spec.id };
    }
    const okKeys: string[] = [];
    for (const key of customerKeys) {
      if (await holdCustomer(db, r.spec.id, key, r.limit, r.qty)) {
        okKeys.push(key);
        continue;
      }
      await settleFlashHolds(db, [...done, { counterId: r.spec.id, qty: r.qty, customerIds: okKeys }], "released");
      return { ok: false, counterId: r.spec.id };
    }
    done.push({ counterId: r.spec.id, qty: r.qty, customerIds: okKeys });
  }
  return { ok: true, holds: done };
}

export async function settleFlashHolds(db: Db, holds: FlashHold[], target: "sold" | "released"): Promise<void> {
  for (const h of holds) {
    await settleCounter(db, h.counterId, h.qty, target);
    for (const key of h.customerIds) await settleCustomer(db, h.counterId, key, h.qty, target);
  }
}

export async function settleGiftHolds(db: Db, holds: GiftHold[], target: "sold" | "released"): Promise<void> {
  for (const h of holds) await settleCounter(db, h.counterId, h.qty, target);
}
