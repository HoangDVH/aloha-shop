import type { Db } from "mongodb";
import { visitRange } from "../shopVisits/service.js";

type Order = Record<string, any>;
export type SaleSummary = { revenue: number; orders: number; average: number };
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
export function saleValue(order: Order): number | null {
  if (order.orderStatus !== "hoan_thanh" || order.isTest === true) return null;
  const total = Math.max(0, num(order.total));
  const paid = order.paymentStatus === "paid" || (total > 0
    && Math.max(num(order.paidAmount), num(order.totalPayment)) >= total
    && !["cancelled", "failed", "expired"].includes(order.paymentStatus));
  if (!paid) return null;
  const gifts = (Array.isArray(order.orderDetails) ? order.orderDetails : []).filter((d: Order) => d.isGift)
    .reduce((sum: number, d: Order) => sum + Math.max(0, num(d.price) * num(d.quantity) - num(d.discount)), 0);
  return Math.round(Math.max(0, total - Math.max(0, num(order.shippingFee)) - gifts));
}
export function comparisonWindow(range: NonNullable<ReturnType<typeof visitRange>>, now = new Date()) {
  const duration = range.end.getTime() - range.start.getTime();
  const end = new Date(Math.max(range.start.getTime(), Math.min(range.end.getTime(), now.getTime())));
  return { start: range.start, end, previousStart: new Date(range.start.getTime() - duration),
    previousEnd: new Date(end.getTime() - duration), partial: end < range.end };
}
export function summarizeSales(orders: Order[], start: Date, end: Date, group: "day" | "hour") {
  const points = new Map<string, { key: string; revenue: number; orders: number }>();
  if (group === "hour") for (let h = 0; h < 24; h++) points.set(String(h).padStart(2, "0"), { key: String(h).padStart(2, "0"), revenue: 0, orders: 0 });
  else for (let ms = start.getTime(); ms < end.getTime(); ms += 86400_000) {
    const key = new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
    points.set(key, { key, revenue: 0, orders: 0 });
  }
  let revenue = 0, count = 0;
  for (const order of orders) {
    const value = saleValue(order), date = new Date(order.deliveredAt ?? order.createdAt);
    if (value === null || !Number.isFinite(date.getTime()) || date < start || date >= end) continue;
    revenue += value; count++;
    const local = new Date(date.getTime() + 7 * 3600_000).toISOString();
    const key = group === "hour" ? local.slice(11, 13) : local.slice(0, 10);
    const point = points.get(key);
    if (point) { point.revenue += value; point.orders++; }
  }
  return { summary: { revenue, orders: count, average: count ? Math.round(revenue / count) : 0 }, points: [...points.values()] };
}
const indexed = new WeakMap<Db, Promise<unknown>>();
export async function ensureBusinessIndexes(db: Db) {
  let promise = indexed.get(db);
  if (!promise) {
    promise = db.collection("aloha_shop_orders").createIndexes([
      { key: { orderStatus: 1, deliveredAt: 1 }, name: "admin_top_sales" },
      { key: { analyticsSessionId: 1, analyticsVisitorId: 1, analyticsPlacedAt: 1 }, name: "admin_order_conversion" },
    ]).catch(error => { indexed.delete(db); throw error; });
    indexed.set(db, promise);
  }
  await promise;
}
export async function businessStats(db: Db, range: NonNullable<ReturnType<typeof visitRange>>, group: "day" | "hour", now = new Date()) {
  await ensureBusinessIndexes(db);
  const window = comparisonWindow(range, now);
  const orders = await db.collection("aloha_shop_orders").aggregate([
    { $match: { orderStatus: "hoan_thanh", isTest: { $ne: true } } },
    { $set: { analyticsDate: { $convert: { input: { $ifNull: ["$deliveredAt", "$createdAt"] }, to: "date", onError: null, onNull: null } } } },
    { $match: { analyticsDate: { $gte: window.previousStart, $lt: window.end } } },
    { $project: { orderStatus: 1, isTest: 1, paymentStatus: 1, total: 1, paidAmount: 1, totalPayment: 1, shippingFee: 1,
      orderDetails: 1, deliveredAt: 1, createdAt: 1 } },
  ], { maxTimeMS: 15000 }).toArray();
  const current = summarizeSales(orders, window.start, window.end, group);
  return { ...current, previous: summarizeSales(orders, window.previousStart, window.previousEnd, group).summary,
    previousFrom: new Date(window.previousStart.getTime() + 7 * 3600_000).toISOString().slice(0, 10),
    previousTo: new Date(window.previousEnd.getTime() - 1 + 7 * 3600_000).toISOString().slice(0, 10),
    partialComparison: window.partial, updatedAt: now.toISOString() };
}
