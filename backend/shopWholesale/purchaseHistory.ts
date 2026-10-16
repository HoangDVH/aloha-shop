import type { Db } from "mongodb";
import { loadKvCreds, fetchKvAccessToken, kvApiBase } from "../services/kvApiClient.js";
import { SHOP_ORDERS } from "../shopOrders/models.js";

export function completedKvPurchase(row: any, customerId: number): boolean {
  return Number(row.customerId) === customerId && Number(row.status) === 1 && Number(row.total) > 0
    && ![4, 5, 6].includes(Number(row.invoiceDelivery?.status));
}
export async function purchaseHistory(shopDb: Db, opsDb: Db, account: any, excludeCode?: string, signal?: AbortSignal): Promise<"returning" | "new" | "unknown"> {
  signal ??= AbortSignal.timeout(5_000);
  const previous = await shopDb.collection(SHOP_ORDERS).findOne({ shopAccountId: String(account._id),
    orderStatus: "hoan_thanh", isTest: { $ne: true }, paymentStatus: { $ne: "cancelled" },
    ...(excludeCode ? { code: { $ne: excludeCode } } : {}) });
  if (previous) return "returning";
  const customerId = Number(account.kvCustomerId);
  if (!(Number.isSafeInteger(customerId) && customerId > 0)) return account.siLookupResult === "existing_si_candidate" ? "unknown" : "new";
  try {
    const creds = await loadKvCreds(opsDb);
    if (!creds || !account.kvRetailer || creds.retailer !== account.kvRetailer) return "unknown";
    const token = await fetchKvAccessToken(creds, signal);
    for (let offset = 0; offset < 1000; offset += 100) {
      const qs = new URLSearchParams({ customerIds: String(customerId), status: "1", includeInvoiceDelivery: "true", pageSize: "100", currentItem: String(offset) });
      const response = await fetch(`${kvApiBase()}/invoices?${qs}`, { headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer }, signal });
      if (!response.ok) return "unknown";
      const body: any = await response.json();
      if (!Array.isArray(body.data)) return "unknown";
      if (body.data.some((row: any) => completedKvPurchase(row, customerId))) return "returning";
      if (body.data.length < 100 || Number(body.total) <= offset + 100) return "new";
    }
  } catch { /* A lookup outage never silently grants a first-order exemption. */ }
  return "unknown";
}
