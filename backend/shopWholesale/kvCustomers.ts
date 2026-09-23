import type { Db } from "mongodb";
import { fetchKvAccessToken, loadKvCreds, kvApiBase } from "../services/kvApiClient.js";
import { normalizeWholesalePhone } from "./policy.js";

export async function lookupKvCustomers(db: Db, phone: string) {
  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("KV_NOT_CONFIGURED");
  const token = await fetchKvAccessToken(creds);
  const result: any[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const response = await fetch(`${kvApiBase()}/customers?contactNumber=${encodeURIComponent(phone)}&includeCustomerGroup=true&pageSize=100&currentItem=${offset}`, {
      headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("KV_LOOKUP_UNAVAILABLE");
    const body = await response.json() as any;
    if (!Array.isArray(body.data)) throw new Error("KV_INVALID_RESPONSE");
    result.push(...body.data.filter((row: any) => normalizeWholesalePhone(row.contactNumber) === phone));
    if (body.data.length < 100 || Number(body.total) <= offset + 100) return { customers: result, retailer: creds.retailer };
  }
  throw new Error("KV_LOOKUP_REQUIRES_REVIEW");
}

export function customerRegion(customer: any): "HCM" | "TINH" | null {
  const groups = [customer.groups, customer.customerGroupDetails, customer.confirmedGroupIds].filter(Array.isArray).flat();
  const ids = groups.map((g: any) => String(g.groupId ?? g.id ?? g));
  const hcm = Boolean(process.env.KV_GROUP_ID_SI_HCM && ids.includes(process.env.KV_GROUP_ID_SI_HCM));
  const tinh = Boolean(process.env.KV_GROUP_ID_SI_TINH && ids.includes(process.env.KV_GROUP_ID_SI_TINH));
  return hcm === tinh ? null : hcm ? "HCM" : "TINH";
}

/** Group names are not IDs. Resolve ambiguous list responses using KV's groupId filter. */
export async function verifyCustomerRegion(db: Db, customer: any): Promise<"HCM" | "TINH" | null> {
  const direct = customerRegion(customer);
  if (direct) return direct;
  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("KV_NOT_CONFIGURED");
  const token = await fetchKvAccessToken(creds);
  const confirmed: string[] = [];
  for (const groupId of [process.env.KV_GROUP_ID_SI_HCM, process.env.KV_GROUP_ID_SI_TINH]) {
    if (!groupId || !/^\d+$/.test(groupId)) continue;
    const query = new URLSearchParams({ code: String(customer.code), groupId, pageSize: "100" });
    const response = await fetch(`${kvApiBase()}/customers?${query}`, { headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("KV_GROUP_LOOKUP_UNAVAILABLE");
    const body: any = await response.json();
    if (!Array.isArray(body.data)) throw new Error("KV_INVALID_RESPONSE");
    if (body.data.some((row: any) => String(row.id) === String(customer.id))) confirmed.push(groupId);
  }
  return customerRegion({ confirmedGroupIds: confirmed });
}
