import type { Db } from "mongodb";
import { fetchKvAccessToken, loadKvCreds, kvApiBase } from "../services/kvApiClient.js";
import { normalizeWholesalePhone } from "./policy.js";

/** Canonical wholesale group labels on retailer alohanguyen (API returns `groups` as a string). */
export const KV_SI_GROUP_NAME_HCM = "KHÁCH SỈ - HCM";
export const KV_SI_GROUP_NAME_TINH = "KHÁCH SỈ - TỈNH";

function configuredGroupId(envKey: "KV_GROUP_ID_SI_HCM" | "KV_GROUP_ID_SI_TINH"): string | null {
  const raw = String(process.env[envKey] || "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Normalize KV group labels for stable matching (case / accents / punctuation). */
export function normalizeKvGroupLabel(raw: unknown): string {
  return stripDiacritics(String(raw || ""))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function regionFromGroupName(raw: unknown): "HCM" | "TINH" | null {
  const n = normalizeKvGroupLabel(raw);
  if (!n) return null;
  const looksWholesale = /\bKHACH SI\b/.test(n) || n.includes("KHACHSI");
  if (!looksWholesale) return null;
  if (/\bHCM\b/.test(n) || n.includes("HO CHI MINH")) return "HCM";
  if (/\bTINH\b/.test(n)) return "TINH";
  return null;
}

function collectGroupIds(customer: any): string[] {
  const bags = [customer?.customerGroupDetails, customer?.confirmedGroupIds, customer?.groupIds];
  const ids: string[] = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const entry of bag) {
      const id = entry?.groupId ?? entry?.id ?? entry;
      if (id != null && String(id).trim() !== "") ids.push(String(id));
    }
  }
  return [...new Set(ids)];
}

function collectGroupNames(customer: any): string[] {
  const names: string[] = [];
  const raw = customer?.groups;
  if (typeof raw === "string" && raw.trim()) {
    for (const part of raw.split(/[|,;/]+/)) {
      const t = part.trim();
      if (t) names.push(t);
    }
  } else if (Array.isArray(raw)) {
    for (const entry of raw) {
      const t = String(entry?.name ?? entry?.groupName ?? entry ?? "").trim();
      if (t) names.push(t);
    }
  }
  if (Array.isArray(customer?.customerGroupDetails)) {
    for (const entry of customer.customerGroupDetails) {
      const t = String(entry?.name ?? entry?.groupName ?? "").trim();
      if (t) names.push(t);
    }
  }
  return names;
}

/**
 * Resolve wholesale region for a KV customer.
 * On alohanguyen, `includeCustomerGroup=true` usually returns `groups` as a string
 * (e.g. "KHÁCH SỈ - HCM") and rarely fills `customerGroupDetails`. Match both
 * configured group IDs and canonical names; conflict → null (manual review).
 */
export function customerRegion(customer: any): "HCM" | "TINH" | null {
  const hcmId = configuredGroupId("KV_GROUP_ID_SI_HCM");
  const tinhId = configuredGroupId("KV_GROUP_ID_SI_TINH");
  const ids = collectGroupIds(customer);
  const idHit = hcmId && ids.includes(hcmId) ? "HCM" : tinhId && ids.includes(tinhId) ? "TINH" : null;
  if (hcmId && tinhId && ids.includes(hcmId) && ids.includes(tinhId)) return null;

  const nameHits = new Set<"HCM" | "TINH">();
  for (const name of collectGroupNames(customer)) {
    const region = regionFromGroupName(name);
    if (region) nameHits.add(region);
  }
  const nameHit = nameHits.size === 1 ? [...nameHits][0]! : nameHits.size > 1 ? null : null;
  if (nameHits.size > 1) return null;

  if (idHit && nameHit && idHit !== nameHit) return null;
  return idHit || nameHit;
}

export async function lookupKvCustomers(db: Db, phone: string) {
  const phoneNorm = normalizeWholesalePhone(phone);
  if (!phoneNorm) throw new Error("KV_INVALID_PHONE");
  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("KV_NOT_CONFIGURED");
  const token = await fetchKvAccessToken(creds);
  const result: any[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const response = await fetch(
      `${kvApiBase()}/customers?contactNumber=${encodeURIComponent(phoneNorm)}&includeCustomerGroup=true&pageSize=100&currentItem=${offset}`,
      {
        headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) throw new Error("KV_LOOKUP_UNAVAILABLE");
    const body = (await response.json()) as any;
    if (!Array.isArray(body.data)) throw new Error("KV_INVALID_RESPONSE");
    result.push(
      ...body.data.filter(
        (row: any) => normalizeWholesalePhone(row.contactNumber) === phoneNorm
      )
    );
    if (body.data.length < 100 || Number(body.total) <= offset + 100) {
      return { customers: result, retailer: creds.retailer };
    }
  }
  throw new Error("KV_LOOKUP_REQUIRES_REVIEW");
}

async function refreshCustomerWithGroups(
  creds: { retailer: string },
  token: string,
  customer: any
): Promise<any> {
  const id = Number(customer?.id);
  if (Number.isSafeInteger(id) && id > 0) {
    const byId = await fetch(`${kvApiBase()}/customers/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer },
      signal: AbortSignal.timeout(8000),
    });
    if (byId.ok) {
      const body: any = await byId.json();
      const row = body?.data ?? body;
      if (row && Number(row.id) === id) return { ...customer, ...row };
    }
  }
  const code = String(customer?.code || "").trim();
  if (!code) return customer;
  const query = new URLSearchParams({
    code,
    includeCustomerGroup: "true",
    pageSize: "20",
  });
  const response = await fetch(`${kvApiBase()}/customers?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("KV_GROUP_LOOKUP_UNAVAILABLE");
  const body: any = await response.json();
  if (!Array.isArray(body.data)) throw new Error("KV_INVALID_RESPONSE");
  const hit =
    body.data.find((row: any) => String(row.id) === String(customer.id)) ||
    body.data.find((row: any) => String(row.code) === code);
  return hit ? { ...customer, ...hit } : customer;
}

/** Prefer direct payload, then refresh, then groupId membership filter when configured. */
export async function verifyCustomerRegion(db: Db, customer: any): Promise<"HCM" | "TINH" | null> {
  const direct = customerRegion(customer);
  if (direct) return direct;

  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("KV_NOT_CONFIGURED");
  const token = await fetchKvAccessToken(creds);
  const refreshed = await refreshCustomerWithGroups(creds, token, customer);
  const afterRefresh = customerRegion(refreshed);
  if (afterRefresh) return afterRefresh;

  const confirmed: string[] = [];
  for (const groupId of [
    configuredGroupId("KV_GROUP_ID_SI_HCM"),
    configuredGroupId("KV_GROUP_ID_SI_TINH"),
  ]) {
    if (!groupId) continue;
    const query = new URLSearchParams({
      code: String(customer.code || ""),
      groupId,
      pageSize: "100",
      includeCustomerGroup: "true",
    });
    if (!query.get("code")) continue;
    const response = await fetch(`${kvApiBase()}/customers?${query}`, {
      headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("KV_GROUP_LOOKUP_UNAVAILABLE");
    const body: any = await response.json();
    if (!Array.isArray(body.data)) throw new Error("KV_INVALID_RESPONSE");
    if (body.data.some((row: any) => String(row.id) === String(customer.id))) {
      confirmed.push(groupId);
    }
  }
  return customerRegion({ ...refreshed, confirmedGroupIds: confirmed });
}
