import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { fetchKvAccessToken, loadKvCreds, kvApiBase } from "../services/kvApiClient.js";
import { resolveShopKvBranchId } from "../shopOrders/kvPush.js";
import { lookupKvCustomers, verifyCustomerRegion } from "./kvCustomers.js";
import { syncBus } from "../syncBus.js";

/** Marker in KV customer.comments — dùng đối soát khi không gửi mã WS cố định. */
export function wholesaleProvisionMarker(accountId: unknown): string {
  return `ALOHA_WS:${String(accountId)}`;
}

function customerHasMarker(customer: { comments?: unknown } | null | undefined, marker: string): boolean {
  return String(customer?.comments || "").includes(marker);
}

function isValidKvCustomer(customer: any): boolean {
  return (
    Number.isSafeInteger(Number(customer?.id)) &&
    Number(customer.id) > 0 &&
    Boolean(String(customer?.code || "").trim())
  );
}

async function hydrateCustomer(
  headers: Record<string, string>,
  customer: any
): Promise<any> {
  const id = Number(customer?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return customer;
  const res = await fetch(`${kvApiBase()}/customers/${id}`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return customer;
  const body: any = await res.json().catch(() => null);
  const row = body?.data ?? body;
  if (!row || Number(row.id) !== id) return customer;
  return { ...customer, ...row };
}

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
  const marker = wholesaleProvisionMarker(account._id);
  let clearCreateStarted = false;
  try {
    const creds = await loadKvCreds(opsDb);
    if (!creds) throw new Error("KV_NOT_CONFIGURED");
    const token = await fetchKvAccessToken(creds);
    const headers = { Authorization: `Bearer ${token}`, Retailer: creds.retailer, "Content-Type": "application/json" };

    const pickMarked = async (phone: string) => {
      const found = await lookupKvCustomers(opsDb, phone);
      const hydrated = await Promise.all(found.customers.map((c) => hydrateCustomer(headers, c)));
      const markedRows = hydrated.filter((c) => customerHasMarker(c, marker));
      const unmarkedRows = hydrated.filter((c) => !customerHasMarker(c, marker));
      return { marked: markedRows, unmarked: unmarkedRows, retailer: found.retailer };
    };

    let { marked, unmarked } = await pickMarked(account.phoneNorm);
    // Phone already used by other KV customers (no our marker) → human review.
    if (unmarked.length > 0 || marked.length > 1) throw new Error("PHONE_REQUIRES_REVIEW");

    let customer = marked[0] || null;

    // After a started create: re-lookup by phone + marker (KV tự sinh mã KH…).
    if (!customer && account.siKvCreateStartedAt) {
      const again = await pickMarked(account.phoneNorm);
      if (again.unmarked.length > 0 || again.marked.length > 1) throw new Error("PHONE_REQUIRES_REVIEW");
      if (again.marked.length === 1) customer = again.marked[0];
      else if (account.siKvLastError === "KV_CREATE_VALIDATION_FAILED") {
        clearCreateStarted = true;
        await accounts.updateOne(filter, { $unset: { siKvCreateStartedAt: "" } });
      } else {
        // Timeout / unknown: never blind-POST again.
        throw new Error("CREATE_OUTCOME_UNKNOWN_REVIEW_REQUIRED");
      }
    }

    if (!customer) {
      const groupId = Number(account.siRegion === "HCM" ? process.env.KV_GROUP_ID_SI_HCM : process.env.KV_GROUP_ID_SI_TINH);
      if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error("GROUP_NOT_CONFIGURED");
      const branchId = await resolveShopKvBranchId(creds, token);
      if (!(branchId > 0)) throw new Error("BRANCH_NOT_CONFIGURED");
      // Persist BEFORE network I/O: a timeout/restart must never trigger blind POST retry.
      const started = await accounts.updateOne({ ...filter, siKvCreateStartedAt: { $exists: false }, siStatus: "active" },
        { $set: { siKvCreateStartedAt: now.toISOString(), siKvSyncStatus: "reconciling", siKvProvisionMarker: marker } });
      if (!started.modifiedCount) throw new Error("ACCOUNT_CHANGED");
      const profile = account.siProfile || {};
      const addressParts = [
        String(profile.detail || "").trim(),
        String(profile.ward || "").trim(),
        String(profile.province || "").trim(),
      ].filter(Boolean);
      // Không gửi `code` — KV tự sinh mã KH…; đối soát bằng comments marker + SĐT.
      const response = await fetch(`${kvApiBase()}/customers`, { method: "POST", headers, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          name: profile.shopName || account.fullName,
          contactNumber: account.phoneNorm,
          address: addressParts.join(", ").slice(0, 255),
          email: account.email,
          branchId,
          groupIds: [groupId],
          comments: marker,
        }) });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          clearCreateStarted = true;
          throw new Error("KV_CREATE_VALIDATION_FAILED");
        }
        throw new Error("KV_CREATE_REQUIRES_RECONCILIATION");
      }
      customer = await response.json();
    }

    if (!isValidKvCustomer(customer)) throw new Error("KV_INVALID_CUSTOMER");
    const region = await verifyCustomerRegion(opsDb, customer);
    if (region !== account.siRegion) throw new Error("GROUP_REQUIRES_REVIEW");
    const officialCode = String(customer.code).trim();
    await accounts.updateOne({ ...filter, siStatus: "active", siRegion: account.siRegion }, { $set: {
      kvCustomerId: Number(customer.id), kvCustomerCode: officialCode, kvRetailer: creds.retailer,
      siKvSyncStatus: "synced", siKvSyncedAt: new Date().toISOString(),
      siKvProvisionCode: officialCode,
    }, $unset: { siKvLastError: "", siKvCreateStartedAt: "" }, $push: { siAudit: { id: randomUUID(), action: "kv_synced", at: new Date().toISOString(), customerId: Number(customer.id), customerCode: officialCode } } as any });
    syncBus.publish([SHOP_ACCOUNTS], "si_kv_synced", { ids: [String(account._id)] });
    return { status: "synced", code: officialCode };
  } catch (error: any) {
    // Safe machine reason only: do not retain credentials or KV response bodies.
    const reason = /^[A-Z_]+$/.test(error.message || "") ? error.message : "KV_UNAVAILABLE";
    const patch: Record<string, unknown> = {
      $set: {
        siKvSyncStatus: "reconciling",
        siKvLastError: reason,
        siKvSyncNextAt: new Date(Date.now() + 5 * 60000).toISOString(),
      },
      $inc: { siKvAttempts: 1 },
    };
    if (clearCreateStarted || reason === "KV_CREATE_VALIDATION_FAILED") {
      (patch as any).$unset = { ...(patch as any).$unset, siKvCreateStartedAt: "" };
    }
    await accounts.updateOne(filter, patch);
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
