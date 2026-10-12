import type { Db } from "mongodb";
import { kvProductId } from "../shopCatalog/kvProductIdentity.js";

export type TopRow = { ma: string; name: string; unit: string; value: number; revenue?: number; quantity?: number };
const number = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const code = (v: unknown) => String(v || "").trim().toUpperCase();

export function salesLines(order: Record<string, any>) {
  if (order.orderStatus !== "hoan_thanh" || order.isTest === true) return [];
  const total = Math.max(0, number(order.total));
  const paid = order.paymentStatus === "paid" || (total > 0 && Math.max(number(order.paidAmount), number(order.totalPayment)) >= total
    && !["cancelled", "failed", "expired"].includes(order.paymentStatus));
  if (!paid) return [];
  const details = Array.isArray(order.orderDetails) ? order.orderDetails : [];
  const returned = new Set((Array.isArray(order.returnedProductCodes) ? order.returnedProductCodes : []).map(code));
  if (order.returnedAt && !returned.size && !details.some((d: any) => d.returnedQuantity !== undefined)) return [];
  const lines = details.filter((d: any) => !d.isGift && number(d.quantity) > 0).map((d: any) => ({
    ma: code(d.productCode), name: String(d.productName || d.productCode || ""), unit: String(d.unit || d.dvt || ""),
    quantity: number(d.quantity), returned: returned.has(code(d.productCode)) ? number(d.quantity) : Math.min(number(d.quantity), Math.max(0, number(d.returnedQuantity))),
    weight: Math.max(0, number(d.price) * number(d.quantity) - Math.max(0, number(d.discount))),
  }));
  const sum = lines.reduce((n: number, d: any) => n + d.weight, 0);
  const discounts = details.reduce((n: number, d: any) => n + Math.max(0, number(d.discount)), 0);
  const giftValue = details.filter((d: any) => d.isGift).reduce((n: number, d: any) => n + Math.max(0, number(d.price) * number(d.quantity) - number(d.discount)), 0);
  // Authoritative checkout total already includes every voucher; never subtract line discounts twice.
  const goodsNet = order.total != null ? Math.max(0, total - Math.max(0, number(order.shippingFee)) - giftValue)
    : Math.max(0, sum - Math.max(0, number(order.discount) - discounts));
  const shares = lines.map((d: any) => sum > 0 ? Math.round(goodsNet) * d.weight / sum : 0);
  const allocations = shares.map(Math.floor);
  let remainder = sum > 0 ? Math.round(goodsNet) - allocations.reduce((n: number, value: number) => n + value, 0) : 0;
  for (const i of shares.map((_: number, i: number) => i).sort((a: number, b: number) => shares[b] - allocations[b] - (shares[a] - allocations[a]) || a - b)) {
    if (remainder-- <= 0) break;
    allocations[i]++;
  }
  return lines.map((d: any, i: number) => ({ ...d,
    quantity: d.quantity - d.returned,
    revenue: allocations[i] * (d.quantity - d.returned) / d.quantity,
  })).filter((d: any) => d.ma && d.quantity > 0);
}

export function rankSales(orders: Record<string, any>[], products: Record<string, any>[], metric: "revenue" | "quantity") {
  const byCode = new Map<string, Record<string, any>>();
  for (const p of products.filter(p => !p.mergedInto)) {
    for (const ma of [p.ma, ...(p.kvCodeAliases || [])]) byCode.set(code(ma), p);
  }
  const groups = new Map<string, TopRow>();
  const canonicalCode = (ma: unknown) => code(byCode.get(code(ma))?.ma || ma);
  for (const order of orders) for (const line of salesLines({ ...order,
    orderDetails: Array.isArray(order.orderDetails) ? order.orderDetails.map((d: any) => ({ ...d, productCode: canonicalCode(d.productCode) })) : [],
    returnedProductCodes: Array.isArray(order.returnedProductCodes) ? order.returnedProductCodes.map(canonicalCode) : [],
  })) {
    const p = byCode.get(line.ma), id = p?.source === "kiotviet" ? kvProductId(p) : "", key = id ? `kv:${id}` : `ma:${line.ma}`;
    const row = groups.get(key) || { ma: String(p?.ma || line.ma), name: String(p?.ten || line.name), unit: String(p?.dvt || line.unit), value: 0, revenue: 0, quantity: 0 };
    row.revenue! += line.revenue; row.quantity! += line.quantity;
    groups.set(key, row);
  }
  return [...groups.values()].map(row => ({ ...row, revenue: Math.round(row.revenue!), value: metric === "revenue" ? Math.round(row.revenue!) : row.quantity! }))
    .filter(row => row.value > 0).sort((a, b) => b.value - a.value || a.ma.localeCompare(b.ma)).slice(0, 10);
}

export async function catalogLabels(db: Db) {
  return db.collection("aloha_products").find({ mergedInto: { $exists: false } }).project({ ma: 1, ten: 1, dvt: 1, id: 1, kvId: 1, kvCodeAliases: 1, source: 1 }).toArray();
}

export async function topSales(db: Db, start: Date, end: Date, metric: "revenue" | "quantity") {
  await db.collection("aloha_shop_orders").createIndex({ orderStatus: 1, deliveredAt: 1 }, { name: "admin_top_sales" });
  const orders = await db.collection("aloha_shop_orders").aggregate([
    { $match: { orderStatus: "hoan_thanh", isTest: { $ne: true } } },
    { $set: { analyticsDate: { $convert: { input: { $ifNull: ["$deliveredAt", "$createdAt"] }, to: "date", onError: null, onNull: null } } } },
    { $match: { analyticsDate: { $gte: start, $lt: end } } },
    { $project: { orderStatus: 1, paymentStatus: 1, total: 1, totalPayment: 1, paidAmount: 1, discount: 1, shippingFee: 1,
      orderDetails: 1, returnedAt: 1, returnedProductCodes: 1 } },
  ], { maxTimeMS: 15000 }).toArray();
  return { items: rankSales(orders, await catalogLabels(db), metric),
    excludedUnresolvedReturns: orders.filter(o => o.returnedAt && !o.returnedProductCodes?.length && !o.orderDetails?.some((d: any) => d.returnedQuantity !== undefined)).length };
}
