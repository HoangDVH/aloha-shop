import type { Db } from "mongodb";
import { z } from "zod";
import { visitInput, visitRange } from "../shopVisits/service.js";
import { ensureBusinessIndexes } from "./business.js";

export const FUNNEL = "aloha_shop_funnel_sessions";
export const funnelIdentity = visitInput.pick({ visitorId: true, sessionId: true }).strict();
export const funnelInput = visitInput.extend({ event: z.enum(["visit", "cart", "checkout"]) }).strict();
const indexed = new WeakMap<Db, Promise<unknown>>();
export async function ensureFunnelIndexes(db: Db) {
  let promise = indexed.get(db);
  if (!promise) {
    promise = db.collection(FUNNEL).createIndexes([
      { key: { sessionId: 1 }, unique: true, name: "funnel_session_unique" },
      { key: { startedAt: 1 }, name: "funnel_session_range" },
    ]).catch(error => { indexed.delete(db); throw error; });
    indexed.set(db, promise);
  }
  await promise;
}
export async function recordFunnelEvent(db: Db, input: z.infer<typeof funnelInput>, now = new Date()) {
  await ensureFunnelIndexes(db);
  const update = { $setOnInsert: { sessionId: input.sessionId, visitorId: input.visitorId, startedAt: now },
    ...(input.event === "visit" ? {} : { $min: { [`${input.event}At`]: now } }) };
  try {
    await db.collection(FUNNEL).updateOne({ sessionId: input.sessionId, visitorId: input.visitorId }, update, { upsert: true });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    if (input.event !== "visit") await db.collection(FUNNEL).updateOne({ sessionId: input.sessionId, visitorId: input.visitorId }, { $min: { [`${input.event}At`]: now } });
  }
}
/** Persist backend-confirmed placement; retries keep the first timestamp and original session. */
export async function confirmFunnelOrder(db: Db, order: Record<string, any>, now = new Date()) {
  if (order.isTest === true || !order.analyticsSessionId || !order.analyticsVisitorId) return;
  await db.collection("aloha_shop_orders").updateOne({ code: order.code, analyticsSessionId: order.analyticsSessionId,
    analyticsVisitorId: order.analyticsVisitorId, isTest: { $ne: true } }, { $min: { analyticsPlacedAt: now } });
}
export async function confirmReplayedOrder(db: Db, accountId: string, key: string) {
  const order = await db.collection("aloha_shop_orders").findOne({ shopAccountId: accountId, idempotencyKey: key });
  if (order) await confirmFunnelOrder(db, order);
}
export async function funnelStats(db: Db, range: NonNullable<ReturnType<typeof visitRange>>) {
  await ensureFunnelIndexes(db); await ensureBusinessIndexes(db);
  const [rows, first] = await Promise.all([
    db.collection(FUNNEL).aggregate([
      { $match: { startedAt: { $gte: range.start, $lt: range.end } } },
      { $lookup: { from: "aloha_shop_orders", let: { session: "$sessionId", visitor: "$visitorId" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$analyticsSessionId", "$$session"] }, { $eq: ["$analyticsVisitorId", "$$visitor"] }] },
          analyticsPlacedAt: { $gte: range.start, $lt: range.end }, isTest: { $ne: true } } },
        { $limit: 1 }, { $project: { _id: 1 } },
      ], as: "placed" } },
      { $set: { hasCart: { $and: [{ $gte: ["$cartAt", range.start] }, { $lt: ["$cartAt", range.end] }] },
        hasCheckout: { $and: [{ $gte: ["$checkoutAt", range.start] }, { $lt: ["$checkoutAt", range.end] }] },
        hasPlaced: { $gt: [{ $size: "$placed" }, 0] } } },
      { $group: { _id: null, visits: { $sum: 1 }, cart: { $sum: { $cond: ["$hasCart", 1, 0] } },
        checkout: { $sum: { $cond: ["$hasCheckout", 1, 0] } }, placed: { $sum: { $cond: ["$hasPlaced", 1, 0] } },
        cartToCheckout: { $sum: { $cond: [{ $and: ["$hasCart", "$hasCheckout"] }, 1, 0] } },
        checkoutToPlaced: { $sum: { $cond: [{ $and: ["$hasCheckout", "$hasPlaced"] }, 1, 0] } } } },
    ], { maxTimeMS: 15000 }).toArray(),
    db.collection(FUNNEL).findOne({}, { sort: { startedAt: 1 }, projection: { startedAt: 1 } }),
  ]);
  const row = rows[0];
  return { visits: row?.visits || 0, cart: row?.cart || 0, checkout: row?.checkout || 0, placed: row?.placed || 0,
    transitions: { cart: row?.cart || 0, checkout: row?.cartToCheckout || 0, placed: row?.checkoutToPlaced || 0 },
    trackingSince: first?.startedAt?.toISOString() || null };
}
