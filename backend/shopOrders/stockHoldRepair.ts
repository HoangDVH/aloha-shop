import { ObjectId, type Db, type Document } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { SHOP_STOCK_HOLDS } from "./stockHold.js";
import { stockHoldOrderRefs } from "./stockHoldRefs.js";

type Action = "released" | "consumed" | "rebound";
export type HoldRepair = { before: Document; orderId: string; orderCode: string; action: Action; orderStatus: string };
export function holdRepairAction(hold: Document, order: Document, now = new Date()): Action | null {
  if (order.orderStatus === "huy" || order.voidedTestAt) return "released";
  if (order.orderStatus === "hoan_thanh") return "consumed";
  // Expired reservations already stop affecting availability; don't revive them.
  if (hold.expiresAt && new Date(hold.expiresAt) <= now) return null;
  if (String(hold.orderCode) !== String(order.code) || !stockHoldOrderRefs(order).includes(String(hold.orderId))) return "rebound";
  // Old WEB order IDs remain a mutable display code. Bind renamed orders to Mongo ID.
  if (String(hold.orderId) !== String(order._id) && String(hold.orderId) !== String(order.code)) return "rebound";
  return null;
}
async function matchingOrders(db: Db, hold: Document) {
  const refs = [...new Set([hold.orderId, hold.orderCode].map(v => String(v || "")).filter(Boolean))];
  if (!refs.length) return [];
  const query: Record<string, unknown> = { $or: [
    { _id: { $in: refs.filter(ObjectId.isValid).map(v => new ObjectId(v)) } },
    { _id: { $in: refs } }, { code: { $in: refs } }, { id: { $in: refs } }, { kvOrderCode: { $in: refs } }, { legacyCodes: { $in: refs } },
  ] };
  return db.collection(SHOP_ORDERS).find(query).limit(2).toArray();
}
export async function planStockHoldRepair(db: Db, now = new Date()) {
  const held = await db.collection(SHOP_STOCK_HOLDS).find({ status: "held" }).toArray();
  const changes: HoldRepair[] = [], unresolved: { holdId: string; reason: string }[] = [];
  for (const hold of held) {
    const orders = await matchingOrders(db, hold);
    if (orders.length !== 1 || !orders[0].code) {
      unresolved.push({ holdId: String(hold._id), reason: orders.length > 1 ? "ambiguous_order" : "missing_order" }); continue;
    }
    const order = orders[0], action = holdRepairAction(hold, order, now);
    if (action) changes.push({ before: hold, orderId: String(order._id), orderCode: String(order.code), action, orderStatus: String(order.orderStatus) });
  }
  return { held: held.length, changes, unresolved };
}
/** CAS on each hold and recheck its order before writing. No product quantities are changed. */
export async function applyStockHoldRepair(db: Db, changes: HoldRepair[], now = new Date()) {
  const result = { released: 0, consumed: 0, rebound: 0, skipped: 0 };
  for (const change of changes) {
    const before = change.before;
    const orders = await matchingOrders(db, before);
    if (orders.length !== 1 || String(orders[0]._id) !== change.orderId || String(orders[0].code) !== change.orderCode
      || holdRepairAction(before, orders[0], now) !== change.action) { result.skipped++; continue; }
    const patch: Document = { orderId: change.orderId, orderCode: change.orderCode, updatedAt: now,
      repairedAt: now, repairReason: "stock_hold_order_code_migration" };
    if (change.action !== "rebound") Object.assign(patch, { status: change.action, [`${change.action}At`]: now });
    const updated = await db.collection(SHOP_STOCK_HOLDS).updateOne({ _id: before._id, status: "held",
      orderId: before.orderId, orderCode: before.orderCode, qty: before.qty, ma: before.ma, expiresAt: before.expiresAt ?? null,
    }, { $set: patch });
    if (updated.modifiedCount) result[change.action]++; else result.skipped++;
    if (updated.modifiedCount && change.action === "rebound") {
      // An old deployed handler might have finalized the order between our read
      // and rebind. Recheck and settle that hold without changing product stock.
      const latest = await db.collection(SHOP_ORDERS).findOne({ _id: orders[0]._id });
      const terminal = latest && holdRepairAction({ ...before, ...patch }, latest, now);
      if (terminal === "released" || terminal === "consumed") await db.collection(SHOP_STOCK_HOLDS).updateOne({ _id: before._id, status: "held" },
        { $set: { status: terminal, [`${terminal}At`]: now, updatedAt: now } });
    }
  }
  return result;
}
