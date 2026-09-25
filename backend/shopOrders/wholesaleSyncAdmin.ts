import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { Db } from "mongodb";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { SHOP_ORDERS } from "./models.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { lookupKvCustomers, verifyCustomerRegion } from "../shopWholesale/kvCustomers.js";
import { fetchKvAccessToken, loadKvCreds, kvApiBase } from "../services/kvApiClient.js";
import { applyCatalogPrices } from "./orderRouteShared.js";

type GetDb = () => Promise<Db>;
export function registerWholesaleSyncAdmin(app: Express, getDb: GetDb, getOps: GetDb) {
  const gate = [requireAuth(getOps), requireActive, requireManager];
  const fail = (res: any) => res.status(409).json({ error: "Không thể thực hiện. Kiểm tra liên kết khách, nhóm sỉ, phiên bản và trạng thái đơn; không gửi lại nếu chưa rõ kết quả." });
  app.get("/api/shop/admin/si-sync", ...gate, async (_req, res) => {
    try {
      const db = await getDb();
      const items = await db.collection(SHOP_ORDERS).find({ priceMode: "si", kvPushStatus: { $exists: true } },
        { projection: { code: 1, kvOrderCode: 1, kvPushStatus: 1, kvSyncReason: 1, total: 1, revision: 1, createdAt: 1, shopAccountId: 1 } })
        .sort({ createdAt: -1 }).limit(100).toArray();
      for (const item of items) {
        const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(item.shopAccountId), { projection: { applicationRevision: 1, kvCustomerId: 1, kvCustomerCode: 1, fullName: 1, phone: 1 } });
        Object.assign(item, { accountRevision: account?.applicationRevision ?? 0, accountName: account?.fullName, accountPhone: account?.phone, customerId: account?.kvCustomerId, customerCode: account?.kvCustomerCode });
      }
      res.setHeader("Cache-Control", "private, no-store"); res.json({ items, enabled: process.env.SHOP_SI_ORDER_SYNC_ENABLED === "1" });
    } catch { res.sendStatus(503); }
  });
  app.post("/api/shop/admin/si-sync/link/:accountId", ...gate, async (req: AuthRequest, res) => {
    try {
      const { customerId, revision, reason, verified } = req.body || {};
      if (verified !== true || !Number.isSafeInteger(customerId) || !Number.isInteger(revision) || String(reason || "").trim().length < 10) return fail(res);
      const db = await getDb(), ops = await getOps();
      const accounts = db.collection(SHOP_ACCOUNTS);
      const account = await accounts.findOne(shopAccountIdQuery(String(req.params.accountId)));
      if (!account || account.siStatus !== "active" || !account.roles?.includes("si") || (account.kvCustomerId && Number(account.kvCustomerId) !== customerId)) return fail(res);
      const found = await lookupKvCustomers(ops, account.phoneNorm || account.phone);
      if (found.customers.length !== 1 || Number(found.customers[0].id) !== customerId || await verifyCustomerRegion(ops, found.customers[0]) !== account.siRegion) return fail(res);
      // A unique claim serializes links across accounts, including legacy records
      // outside the partial siIdentity unique index. Retained claims are fail-closed.
      const conflict = await accounts.findOne({ _id: { $ne: account._id }, kvRetailer: found.retailer, kvCustomerId: customerId });
      if (conflict) return fail(res);
      await db.collection("aloha_shop_kv_customer_links").updateOne(
        { _id: `${found.retailer}:${customerId}` as any, accountId: String(account._id) },
        { $setOnInsert: { accountId: String(account._id), createdAt: new Date().toISOString() } }, { upsert: true });
      const result = await accounts.updateOne({ _id: account._id, applicationRevision: revision,
        kvCustomerId: account.kvCustomerId ?? null, phoneNorm: account.phoneNorm ?? null, siStatus: "active" }, {
        $set: { kvCustomerId: customerId, kvCustomerCode: String(found.customers[0].code), kvRetailer: found.retailer,
          siKvSyncStatus: "synced", updatedAt: new Date().toISOString() }, $inc: { applicationRevision: 1 },
        $push: { siAudit: { id: randomUUID(), action: "link_kv_customer", actorAdminId: req.auth!.userId,
          customerId, reason: String(reason).slice(0, 1000), at: new Date().toISOString() } } as any });
      if (!result.modifiedCount) return fail(res);
      res.json({ ok: true });
    } catch { fail(res); }
  });
  // Requeue only when no create attempt has started. Unknown outcomes cannot be reset.
  app.post("/api/shop/admin/si-sync/:code/queue", ...gate, async (req: AuthRequest, res) => {
    try {
      const db = await getDb();
      const order = await db.collection(SHOP_ORDERS).findOne(shopOrderLookupFilter(String(req.params.code)));
      if (!order || order.priceMode !== "si" || order.kvOrderId || order.kvSyncStartedAt ||
        order.orderStatus !== "cho_xac_nhan" || !Number.isInteger(req.body.revision)) return fail(res);
      if (!order.policyAcceptedAt && (req.body.confirmedConsent !== true || String(req.body.reason || "").trim().length < 10)) return fail(res);
      const buyer = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(order.shopAccountId));
      const priced = await applyCatalogPrices(await getOps(), order.orderDetails, { account: buyer });
      if (!priced.ok || priced.details.some((d, i) => d.price !== order.orderDetails[i].price)) return fail(res);
      // Expired holds/old consent need the existing proposal flow, not silent renewal.
      if (Date.now() - new Date(order.createdAt).getTime() > 24 * 3600000) return fail(res);
      const result = await db.collection(SHOP_ORDERS).updateOne({ _id: order._id, revision: req.body.revision,
        kvSyncStartedAt: null, kvOrderId: null, kvPushStatus: { $nin: ["preparing", "sending", "unknown", "synced"] }, orderStatus: "cho_xac_nhan" },
        { $set: { kvPushStatus: "queued", kvSyncNextAt: new Date(), kvSyncReason: null, ...(!order.policyAcceptedAt ? { policyAcceptedAt: new Date().toISOString(), policyConsentRecordedBy: req.auth!.userId } : {}) }, $inc: { revision: 1 },
          $push: { kvSyncAudit: { action: "queue", actor: req.auth!.userId, reason: String(req.body.reason || "").slice(0, 1000), at: new Date().toISOString() } } as any });
      if (!result.modifiedCount) return fail(res);
      res.json({ ok: true });
    } catch { fail(res); }
  });
  // Manager supplies a real KV order ID after looking up the marker; GET only.
  app.post("/api/shop/admin/si-sync/:code/reconcile", ...gate, async (req: AuthRequest, res) => {
    try {
      if (!Number.isSafeInteger(req.body.kvOrderId) || req.body.kvOrderId <= 0) return fail(res);
      const db = await getDb(), ops = await getOps();
      const orders = db.collection(SHOP_ORDERS);
      const order = await orders.findOne(shopOrderLookupFilter(String(req.params.code)));
      if (!order || order.priceMode !== "si" || order.kvPushStatus !== "unknown" || order.kvOrderId) return fail(res);
      const creds = await loadKvCreds(ops); if (!creds || creds.retailer !== order.kvSyncRetailer) return fail(res);
      const token = await fetchKvAccessToken(creds);
      const response = await fetch(`${kvApiBase()}/orders/${req.body.kvOrderId}`, { headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return fail(res);
      const raw: any = await response.json(), kv = raw.data || raw;
      if (!kv.code || Number(kv.id) !== req.body.kvOrderId || Number(kv.customerId) !== Number(order.kvSyncCustomerId) ||
        !String(kv.description || "").startsWith(`ALOHA:${String(order._id)} |`)) return fail(res);
      const result = await orders.updateOne({ _id: order._id, kvPushStatus: "unknown", kvOrderId: null },
        { $set: { kvOrderId: kv.id, kvOrderCode: kv.code, kvPushStatus: "synced", kvSyncReason: null, kvSyncedAt: new Date().toISOString() },
          $addToSet: { legacyCodes: order.code }, $push: { kvSyncAudit: { action: "reconcile", actor: req.auth!.userId,
            kvOrderId: kv.id, at: new Date().toISOString() } } as any });
      if (!result.modifiedCount) return fail(res);
      res.json({ ok: true, code: kv.code });
    } catch { fail(res); }
  });
}
