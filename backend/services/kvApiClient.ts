/**
 * Gọi KiotViet — mặc định URL chính thức.
 * Có thể dùng proxy nội bộ (/kv-auth, /kv-api) qua KV_AUTH_URL / KV_API_URL (Windows SSL).
 */
import type { Db } from "mongodb";

export type KvCreds = {
  clientId: string;
  clientSecret: string;
  retailer: string;
};

const PAGE = 100;
const PRODUCT_QUERY =
  "&includePricebook=true&includeInventory=true&includeImages=true&includeMaterial=true";

function portBase(): string {
  const port =
    Number(process.env.SHOP_SERVER_PORT) ||
    Number(process.env.PORT) ||
    3001;
  return `http://127.0.0.1:${port}`;
}

export function kvAuthUrl(): string {
  if (process.env.KV_AUTH_URL) return String(process.env.KV_AUTH_URL);
  // Standalone/VPS: gọi thẳng KV. Dev Windows có thể set KV_USE_LOCAL_PROXY=1.
  if (process.env.KV_USE_LOCAL_PROXY === "1") {
    return `${portBase()}/kv-auth/connect/token`;
  }
  return "https://id.kiotviet.vn/connect/token";
}

export function kvApiBase(): string {
  if (process.env.KV_API_URL) {
    return String(process.env.KV_API_URL).replace(/\/$/, "");
  }
  if (process.env.KV_USE_LOCAL_PROXY === "1") {
    return `${portBase()}/kv-api`;
  }
  return "https://public.kiotapi.com";
}

async function fetchJson(
  url: string,
  init?: RequestInit & { timeout?: number }
): Promise<any> {
  const timeout = init?.timeout ?? 120_000;
  const { timeout: _t, ...rest } = init || {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e: any) {
    throw new Error(`fetch failed ${url}: ${e?.message || e}`);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url} ${text.slice(0, 200)}`);
  }
  return json;
}

function credsFromFlat(flat: Record<string, unknown> | null | undefined): KvCreds | null {
  if (!flat) return null;
  const clientId = String(flat.clientId || flat.client_id || "").trim();
  const clientSecret = String(flat.clientSecret || flat.client_secret || "").trim();
  const retailer = String(flat.retailer || "").trim();
  if (!clientId || !clientSecret || !retailer) return null;
  return { clientId, clientSecret, retailer };
}

async function readKvCredsFromDb(db: Db): Promise<KvCreds | null> {
  try {
    const doc =
      (await db.collection("config").findOne({ id: "kiotviet" })) ||
      (await db.collection("config").findOne({ _id: "kiotviet" as any }));
    const flat: Record<string, unknown> = {
      ...(doc || {}),
      ...(((doc as any)?.value || {}) as object),
      ...(((doc as any)?.data || {}) as object),
    };
    return credsFromFlat(flat);
  } catch {
    return null;
  }
}

/**
 * Đọc clientId/secret/retailer từ env, rồi Mongo config.
 * Shop standalone: catalog ở aloha_shop_db; config KV thường nằm aloha_thumua
 * → fallback cùng cluster qua KV_CONFIG_DB (mặc định aloha_thumua).
 */
export async function loadKvCreds(db: Db): Promise<KvCreds | null> {
  const fromEnv =
    process.env.KV_CLIENT_ID &&
    process.env.KV_CLIENT_SECRET &&
    process.env.KV_RETAILER
      ? {
          clientId: String(process.env.KV_CLIENT_ID),
          clientSecret: String(process.env.KV_CLIENT_SECRET),
          retailer: String(process.env.KV_RETAILER),
        }
      : null;
  if (fromEnv) return fromEnv;

  const primary = await readKvCredsFromDb(db);
  if (primary) return primary;

  const fallbackName = String(
    process.env.KV_CONFIG_DB || process.env.OPS_KV_DB || "aloha_thumua"
  ).trim();
  if (fallbackName && fallbackName !== db.databaseName) {
    try {
      const client = (db as Db & { client?: { db: (n: string) => Db } }).client;
      if (client?.db) {
        const alt = await readKvCredsFromDb(client.db(fallbackName));
        if (alt) return alt;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function fetchKvAccessToken(creds: KvCreds): Promise<string> {
  const body = new URLSearchParams({
    scopes: "PublicApi.Access",
    scope: "PublicApi.Access",
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const json = await fetchJson(kvAuthUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    timeout: 60_000,
  });
  if (!json?.access_token) {
    throw new Error("Không lấy được access_token từ KiotViet");
  }
  return String(json.access_token);
}

function kvHeaders(creds: KvCreds, token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Retailer: creds.retailer,
    "Content-Type": "application/json",
  };
}

/**
 * Kéo SP từ KV — delta theo lastModifiedFrom (null = quét hết, dùng full sync tuần).
 */
export async function fetchKvProducts(
  creds: KvCreds,
  token: string,
  opts?: { lastModifiedFrom?: string | null }
): Promise<any[]> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  const since =
    opts?.lastModifiedFrom != null && opts.lastModifiedFrom !== ""
      ? `&lastModifiedFrom=${encodeURIComponent(opts.lastModifiedFrom)}`
      : "";
  const out: any[] = [];
  let currentItem = 0;
  for (;;) {
    const url = `${api}/products?pageSize=${PAGE}&currentItem=${currentItem}${PRODUCT_QUERY}${since}`;
    const json = await fetchJson(url, { headers, timeout: 180_000 });
    const page = Array.isArray(json?.data) ? json.data : [];
    if (!page.length) break;
    out.push(...page);
    currentItem += page.length;
    if (page.length < PAGE) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

/** ── Chuyển hàng (KV Public API /transfers) ── */

export type KvTransferListParams = {
  toBranchIds?: number[];
  fromBranchIds?: number[];
  status?: number[];
  pageSize?: number;
  currentItem?: number;
  fromReceivedDate?: string;
  toReceivedDate?: string;
  fromTransferDate?: string;
  toTransferDate?: string;
};

function kvTransferQuery(params: KvTransferListParams): string {
  const q = new URLSearchParams();
  if (params.pageSize != null) q.set("pageSize", String(params.pageSize));
  if (params.currentItem != null) q.set("currentItem", String(params.currentItem));
  if (params.fromTransferDate) q.set("fromTransferDate", params.fromTransferDate);
  if (params.toTransferDate) q.set("toTransferDate", params.toTransferDate);
  if (params.fromReceivedDate) q.set("fromReceivedDate", params.fromReceivedDate);
  if (params.toReceivedDate) q.set("toReceivedDate", params.toReceivedDate);
  for (const id of params.fromBranchIds || []) q.append("fromBranchIds", String(id));
  for (const id of params.toBranchIds || []) q.append("toBranchIds", String(id));
  for (const s of params.status || []) q.append("status", String(s));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchKvTransfers(
  creds: KvCreds,
  token: string,
  params: KvTransferListParams = {}
): Promise<{ total: number; pageSize: number; data: any[] }> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  const url = `${api}/transfers${kvTransferQuery(params)}`;
  const json = await fetchJson(url, { headers, timeout: 120_000 });
  return {
    total: Number(json?.total ?? 0) || 0,
    pageSize: Number(json?.pageSize ?? params.pageSize ?? 20) || 20,
    data: Array.isArray(json?.data) ? json.data : [],
  };
}

/** Kéo toàn bộ phiếu chuyển (backfill / ?sync=1). */
export async function fetchKvTransfersAll(
  creds: KvCreds,
  token: string,
  params: Omit<KvTransferListParams, "pageSize" | "currentItem"> = {}
): Promise<any[]> {
  const out: any[] = [];
  let currentItem = 0;
  for (;;) {
    const page = await fetchKvTransfers(creds, token, {
      ...params,
      pageSize: PAGE,
      currentItem,
    });
    if (!page.data.length) break;
    out.push(...page.data);
    currentItem += page.data.length;
    if (page.data.length < PAGE) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}

export async function fetchKvTransferById(
  creds: KvCreds,
  token: string,
  id: number | string
): Promise<any> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  return fetchJson(`${api}/transfers/${encodeURIComponent(String(id))}`, {
    headers,
    timeout: 120_000,
  });
}

export async function createKvTransfer(
  creds: KvCreds,
  token: string,
  body: Record<string, unknown>
): Promise<any> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  return fetchJson(`${api}/transfers`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    timeout: 120_000,
  });
}

export async function updateKvTransfer(
  creds: KvCreds,
  token: string,
  id: number | string,
  body: Record<string, unknown>
): Promise<any> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  return fetchJson(`${api}/transfers/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    timeout: 120_000,
  });
}

export async function deleteKvTransfer(
  creds: KvCreds,
  token: string,
  id: number | string
): Promise<any> {
  const api = kvApiBase();
  const headers = kvHeaders(creds, token);
  return fetchJson(`${api}/transfers/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    headers,
    timeout: 120_000,
  });
}
