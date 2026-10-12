import { ObjectId, type Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";

export function stockHoldOrderRefs(order: Record<string, any>, extra = "") {
  return [...new Set([extra, order._id, order.stockHoldOrderId, order.code, order.id, order.kvOrderCode,
    ...(Array.isArray(order.legacyCodes) ? order.legacyCodes : [])].map(v => String(v ?? "").trim()).filter(Boolean))];
}
export async function resolveStockHoldRefs(db: Db, ref: string) {
  const raw = String(ref || "").trim();
  if (!raw) return [];
  const query = shopOrderLookupFilter(raw);
  (query.$or as Record<string, unknown>[]).push({ _id: raw });
  if (ObjectId.isValid(raw)) (query.$or as Record<string, unknown>[]).push({ _id: new ObjectId(raw) });
  const orders = await db.collection(SHOP_ORDERS).find(query).limit(2).toArray();
  if (orders.length > 1) throw new Error("Ambiguous stock hold order reference");
  return orders.length ? stockHoldOrderRefs(orders[0], raw) : [raw];
}
