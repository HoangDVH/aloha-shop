import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { fetchKvAccessToken, loadKvCreds, kvApiBase } from "../services/kvApiClient.js";
import { lookupKvCustomers, verifyCustomerRegion } from "./kvCustomers.js";
import { syncBus } from "../syncBus.js";

/** One durable lease and one create attempt per account. Ambiguous outcomes only reconcile. */
export async function provisionWholesaleCustomer(shopDb: Db, opsDb: Db, accountId: unknown) {
  if (process.env.SHOP_SI_KV_PROVISION_ENABLED !== "1") return { status: "disabled" };
  const owner = randomUUID();
  const now = new Date();
  const accounts = shopDb.collection(SHOP_ACCOUNTS);
  const account = await accounts.findOneAndUpdate({ _id: accountId as any, siStatus: "active", siIdentity: true, kvCustomerId: null,
    $or: [{ siKvLeaseUntil: { $exists: false } }, { siKvLeaseUntil: { $lte: now } }] },
    { $set: { siKvLeaseOwner: owner, siKvLeaseUntil: new Date(Date.now() + 180000) } }, { returnDocument: "after" });
  if (!account) return { status: "busy_or_synced" };
  const filter = { _id: account._id, siKvLeaseOwner: owner };
  const code = `WS${String(account._id).toUpperCase()}`;
  try {
    const creds = await loadKvCreds(opsDb);
    if (!creds) throw new Error("KV_NOT_CONFIGURED");
    const token = await fetchKvAccessToken(creds);
    const headers = { Authorization: `Bearer ${token}`, Retailer: creds.retailer, "Content-Type": "application/json" };
    const found = await lookupKvCustomers(opsDb, account.phoneNorm);
    // Another customer with this phone requires human review; never silently relink.
    if (found.customers.some(c => c.code !== code) || found.customers.length > 1) throw new Error("PHONE_REQUIRES_REVIEW");
    let customer = found.customers.find(c => c.code === code);
    if (!customer && account.siKvCreateStartedAt) {
      const result = await fetch(`${kvApiBase()}/customers/code/${encodeURIComponent(code)}`, { headers, signal: AbortSignal.timeout(10000) });
      if (result.ok) customer = await result.json();
      else if (result.status !== 404) throw new Error("KV_RECONCILE_UNAVAILABLE");
      if (!customer) throw new Error("CREATE_OUTCOME_UNKNOWN_REVIEW_REQUIRED");
    }
    if (!customer) {
      const groupId = Number(account.siRegion === "HCM" ? process.env.KV_GROUP_ID_SI_HCM : process.env.KV_GROUP_ID_SI_TINH);
      if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error("GROUP_NOT_CONFIGURED");
      // Persist BEFORE network I/O: a timeout/restart must never trigger blind POST retry.
      const started = await accounts.updateOne({ ...filter, siKvCreateStartedAt: { $exists: false }, siStatus: "active" },
        { $set: { siKvCreateStartedAt: now.toISOString(), siKvSyncStatus: "reconciling", siKvProvisionCode: code } });
      if (!started.modifiedCount) throw new Error("ACCOUNT_CHANGED");
      const profile = account.siProfile || {};
      const response = await fetch(`${kvApiBase()}/customers`, { method: "POST", headers, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ code, name: profile.shopName || account.fullName, contactNumber: account.phoneNorm, address: profile.detail || "",
          locationName: profile.province || "", wardName: profile.ward || "", email: account.email, groupIds: [groupId], comments: `Aloha wholesale account ${account._id}` }) });
      if (!response.ok) throw new Error("KV_CREATE_REQUIRES_RECONCILIATION");
      customer = await response.json();
    }
    if (!Number.isSafeInteger(Number(customer?.id)) || Number(customer.id) <= 0 || customer.code !== code) throw new Error("KV_INVALID_CUSTOMER");
    const region = await verifyCustomerRegion(opsDb, customer);
    if (region !== account.siRegion) throw new Error("GROUP_REQUIRES_REVIEW");
    await accounts.updateOne({ ...filter, siStatus: "active", siRegion: account.siRegion }, { $set: {
      kvCustomerId: Number(customer.id), kvCustomerCode: customer.code, kvRetailer: creds.retailer,
      siKvSyncStatus: "synced", siKvSyncedAt: new Date().toISOString(),
    }, $unset: { siKvLastError: "" }, $push: { siAudit: { id: randomUUID(), action: "kv_synced", at: new Date().toISOString(), customerId: Number(customer.id) } } as any });
    syncBus.publish([SHOP_ACCOUNTS], "si_kv_synced", { ids: [String(account._id)] });
    return { status: "synced" };
  } catch (error: any) {
    // Safe machine reason only: do not retain credentials or KV response bodies.
    const reason = /^[A-Z_]+$/.test(error.message || "") ? error.message : "KV_UNAVAILABLE";
    await accounts.updateOne(filter, { $set: { siKvSyncStatus: "reconciling", siKvLastError: reason,
      siKvSyncNextAt: new Date(Date.now() + 5 * 60000).toISOString() }, $inc: { siKvAttempts: 1 } });
    return { status: "reconciling", reason };
  } finally {
    await accounts.updateOne(filter, { $unset: { siKvLeaseOwner: "", siKvLeaseUntil: "" } });
  }
}

export function startWholesaleProvisionWorker(getDb: () => Promise<Db>, getOpsDb: () => Promise<Db>) {
  if (process.env.SHOP_SI_KV_PROVISION_ENABLED !== "1") return;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const db = await getDb();
      const accounts = await db.collection(SHOP_ACCOUNTS).find({ siStatus: "active", siKvSyncStatus: { $in: ["pending", "reconciling"] },
        siKvSyncNextAt: { $lte: new Date().toISOString() } }).limit(5).toArray();
      for (const account of accounts) await provisionWholesaleCustomer(db, await getOpsDb(), account._id);
    } catch { /* Durable account state is retried on the next tick. */ }
    finally { running = false; }
  }, 60000);
  timer.unref();
}
