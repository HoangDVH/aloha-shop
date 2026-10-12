import type { Db } from "mongodb";
import { z } from "zod";
import { visitInput } from "../shopVisits/service.js";
import { shopFilterBase } from "../shopCatalog/catalog/publicProduct.js";
import { kvProductId } from "../shopCatalog/kvProductIdentity.js";
import { catalogLabels, type TopRow } from "./sales.js";

export const PRODUCT_VIEWS = "aloha_shop_product_views";
export const productViewInput = visitInput.pick({ visitorId: true, sessionId: true }).extend({ productCode: z.string().trim().min(1).max(120) }).strict();
const indexed = new WeakMap<Db, Promise<unknown>>();
export async function ensureProductViewIndexes(db: Db) {
  let pending = indexed.get(db);
  if (!pending) {
    pending = db.collection(PRODUCT_VIEWS).createIndexes([
      { key: { sessionId: 1, productKey: 1 }, unique: true, name: "product_view_session_unique" },
      { key: { viewedAt: 1, productKey: 1, visitorId: 1 }, name: "product_views_range" },
    ]).catch(error => { indexed.delete(db); throw error; });
    indexed.set(db, pending);
  }
  await pending;
}
export async function recordProductView(db: Db, input: z.infer<typeof productViewInput>, now = new Date()) {
  const ma = input.productCode;
  const p = await db.collection("aloha_products").findOne({ $and: [
    ...(shopFilterBase().$and as object[]), { $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }, { kvCodeAliases: ma.toUpperCase() }] },
  ] });
  if (!p) return false;
  await ensureProductViewIndexes(db);
  const id = p.source === "kiotviet" ? kvProductId(p) : "", productKey = id ? `kv:${id}` : `ma:${String(p.ma).toUpperCase()}`;
  try {
    await db.collection(PRODUCT_VIEWS).updateOne({ sessionId: input.sessionId, productKey }, { $setOnInsert: {
      sessionId: input.sessionId, visitorId: input.visitorId, productKey, ma: p.ma, name: p.ten, unit: p.dvt, viewedAt: now,
    } }, { upsert: true });
  } catch (error: any) { if (error?.code !== 11000) throw error; }
  return true;
}
export async function topViews(db: Db, start: Date, end: Date, metric: "views" | "visitors") {
  await ensureProductViewIndexes(db);
  const [rows, first, products] = await Promise.all([
    db.collection(PRODUCT_VIEWS).aggregate([
      { $match: { viewedAt: { $gte: start, $lt: end } } },
      { $group: { _id: { productKey: "$productKey", visitorId: "$visitorId" }, views: { $sum: 1 }, ma: { $first: "$ma" }, name: { $first: "$name" }, unit: { $first: "$unit" } } },
      { $group: { _id: "$_id.productKey", views: { $sum: "$views" }, visitors: { $sum: 1 }, ma: { $first: "$ma" }, name: { $first: "$name" }, unit: { $first: "$unit" } } },
      { $set: { value: metric === "views" ? "$views" : "$visitors" } }, { $sort: { value: -1, _id: 1 } }, { $limit: 10 },
    ], { maxTimeMS: 15000 }).toArray(),
    db.collection(PRODUCT_VIEWS).findOne({}, { sort: { viewedAt: 1 }, projection: { viewedAt: 1 } }), catalogLabels(db),
  ]);
  const labels = new Map(products.map(p => [p.source === "kiotviet" && kvProductId(p) ? `kv:${kvProductId(p)}` : `ma:${String(p.ma).toUpperCase()}`, p]));
  return { items: rows.map(r => { const p = labels.get(r._id); return { ma: p?.ma || r.ma, name: p?.ten || r.name,
    unit: p?.dvt || r.unit || "", value: r.value } as TopRow; }), trackingSince: first?.viewedAt?.toISOString() || null };
}
