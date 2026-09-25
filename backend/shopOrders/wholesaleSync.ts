import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { lookupKvCustomers, verifyCustomerRegion } from "../shopWholesale/kvCustomers.js";
import { ensureReviewKvOrder } from "../shopInvoices/invoiceService.js";
import { fullAddressForKv } from "./orderRouteShared.js";
import { syncBus } from "../syncBus.js";

// The order document is the durable outbox. A started POST is never retried
// automatically: KiotViet does not offer a verified idempotency contract here.
export function wholesaleSyncBlock(order: any, account: any, now = Date.now()): string | null {
  if (order.orderStatus === "huy" || order.done || order.paymentStatus === "cancelled") return "cancelled";
  if (order.orderStatus !== "cho_xac_nhan") return "needs_review";
  if (order.kvOrderId) return "already_synced";
  if (!account || account.active === false || account.siStatus !== "active" || !account.roles?.includes("si")) return "account_review";
  if (!["HCM", "TINH"].includes(String(account.siRegion || ""))) return "account_review";
  if (!account.kvCustomerId) return "awaiting_customer_link";
  if (!order.policyAcceptedAt) return "needs_review";
  if (order.priceMode !== "si") return "needs_review";
  if (order.backorderStatus && order.backorderStatus !== "pending_confirmation") return "needs_review";
  if (Number(order.paidAmount) > 0 || order.paymentStatus === "paid") return "needs_review";
  const until = order.holdExpiresAt || order.expiresAt;
  if (until && new Date(until).getTime() <= now) return "needs_review";
  if (!until && now - new Date(order.createdAt).getTime() > 24 * 3600000) return "needs_review";
  // Snapshot must be wholesale: never push retail / unlabeled lines for an HCM/TINH si order.
  if (
    !Array.isArray(order.orderDetails) ||
    !order.orderDetails.length ||
    order.orderDetails.some(
      (d: any) =>
        !d.productCode ||
        !(d.quantity > 0) ||
        !(Number(d.price) > 0) ||
        d.priceKind !== "si"
    )
  ) {
    return "needs_review";
  }
  return null;
}

export async function syncWholesaleOrder(db: Db, ops: Db, id: unknown, deps = {
  lookup: lookupKvCustomers, region: verifyCustomerRegion, send: ensureReviewKvOrder,
}) {
  const orders = db.collection(SHOP_ORDERS);
  const owner = randomUUID();
  const now = new Date();
  // Lease expiry before POST is safe. Expiry after POST is unknown, never queued again.
  await orders.updateOne({ _id: id as any, kvPushStatus: "sending", kvSyncLeaseUntil: { $lte: now } },
    { $set: { kvPushStatus: "unknown", kvSyncReason: "response_not_confirmed" } });
  const order = await orders.findOneAndUpdate({ _id: id as any, priceMode: "si", kvOrderId: null,
    kvPushStatus: { $in: ["queued", "awaiting_customer_link", "retry_wait", "preparing"] },
    $and: [{ $or: [{ kvEditLeaseUntil: { $exists: false } }, { kvEditLeaseUntil: { $lte: now } }] },
      { $or: [{ kvSyncLeaseUntil: { $exists: false } }, { kvSyncLeaseUntil: { $lte: now } }] },
      { $or: [{ kvSyncNextAt: { $exists: false } }, { kvSyncNextAt: { $lte: now } }] }] },
    { $set: { kvPushStatus: "preparing", kvSyncOwner: owner, kvSyncLeaseUntil: new Date(Date.now() + 10 * 60000) } },
    { returnDocument: "after" });
  if (!order) return { status: "busy_or_finished" };
  const filter = { _id: order._id, kvSyncOwner: owner };
  let started = false;
  const stop = async (status: string) => {
    await orders.updateOne(filter, { $set: { kvPushStatus: status, kvSyncReason: status },
      $unset: { kvSyncLeaseUntil: "", kvSyncOwner: "" } });
    return { status };
  };
  try {
    const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(order.shopAccountId));
    const block = wholesaleSyncBlock(order, account);
    if (block) return await stop(block);
    const found = await deps.lookup(ops, account!.phoneNorm || account!.phone);
    if (found.customers.length !== 1 || Number(found.customers[0].id) !== Number(account!.kvCustomerId) || found.retailer !== account!.kvRetailer) return await stop("customer_review");
    if (await deps.region(ops, found.customers[0]) !== account!.siRegion) return await stop("customer_review");
    const latestAccount = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(order.shopAccountId));
    if (!latestAccount || latestAccount.updatedAt !== account!.updatedAt || latestAccount.kvCustomerId !== account!.kvCustomerId) return await stop("customer_review");
    // Keep the accepted price snapshot, not today's catalog price.
    // The final CAS rejects edits/cancellation while remote customer validation ran.
    const claimed = await orders.updateOne({ ...filter, kvPushStatus: "preparing", orderStatus: order.orderStatus,
      revision: order.revision ?? null, updatedAt: order.updatedAt ?? null, kvOrderId: null },
      { $set: { kvPushStatus: "sending", kvSyncStartedAt: new Date().toISOString(), kvSyncCustomerId: Number(account!.kvCustomerId),
        kvSyncRetailer: found.retailer, kvSyncMarker: `ALOHA:${String(order._id)}` }, $inc: { kvSyncAttempts: 1 } });
    if (!claimed.modifiedCount) return await stop("needs_review");
    started = true;
    const result = await deps.send({ mainDb: ops, customerName: order.customerName,
      customerId: Number(account!.kvCustomerId), customerPhone: order.customerPhone,
      address: fullAddressForKv({ deliveryMethod: order.deliveryMethod, shippingAddress: order.shippingAddress, ward: order.ward, district: order.district, province: order.province }), orderDetails: order.orderDetails,
      description: `ALOHA:${String(order._id)} | Web ${order.code} | Cho xac nhan anh va thanh toan`.slice(0, 500),
      totalPayment: 0, shippingFee: Number(order.shippingFee) || 0 });
    if (!result.kvOrderCode || String(result.kvOrderCode) === String(result.kvOrderId)) throw new Error("missing_official_code");
    await orders.updateOne(filter, { $set: { kvOrderId: result.kvOrderId, kvOrderCode: result.kvOrderCode,
      kvCustomerId: Number(account!.kvCustomerId), kvPushStatus: "synced", kvSyncedAt: new Date().toISOString(), kvSyncReason: null },
      $addToSet: { legacyCodes: order.code }, $unset: { kvSyncOwner: "", kvSyncLeaseUntil: "", kvSyncNextAt: "" } });
    // code/id stay immutable; displayShopOrderCode uses the official KV code.
    syncBus.publish(["shop_orders"], "si-order-synced", { ids: [order.code] });
    return { status: "synced", code: result.kvOrderCode };
  } catch {
    const attempts = Number(order.kvSyncPrepareAttempts || 0) + 1;
    const status = started ? "unknown" : attempts >= 5 ? "needs_review" : "retry_wait";
    await orders.updateOne(filter, { $set: { kvPushStatus: status, kvSyncReason: started ? "response_not_confirmed" : "customer_lookup_unavailable",
      kvSyncNextAt: new Date(Date.now() + Math.min(30 * 60000, 30000 * 2 ** Math.min(attempts, 6)) + Math.random() * 10000) },
      $inc: { kvSyncPrepareAttempts: 1 }, $unset: { kvSyncOwner: "", kvSyncLeaseUntil: "" } });
    return { status };
  }
}

export function startWholesaleOrderSync(getDb: () => Promise<Db>, getOpsDb: () => Promise<Db>) {
  if (process.env.SHOP_SI_ORDER_SYNC_ENABLED !== "1") return;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const db = await getDb();
      const now = new Date();
      const rows = await db.collection(SHOP_ORDERS).find({ priceMode: "si", kvOrderId: null,
        kvPushStatus: { $in: ["queued", "awaiting_customer_link", "retry_wait", "preparing", "sending"] },
        $and: [{ $or: [{ kvSyncNextAt: { $exists: false } }, { kvSyncNextAt: { $lte: now } }] },
          { $or: [{ kvSyncLeaseUntil: { $exists: false } }, { kvSyncLeaseUntil: { $lte: now } }] }] })
        .sort({ createdAt: 1 }).limit(10).toArray();
      for (const row of rows) await syncWholesaleOrder(db, await getOpsDb(), row._id);
    } catch { /* Persisted state survives outages; next tick retries preparation only. */ }
    finally { running = false; }
  }, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
