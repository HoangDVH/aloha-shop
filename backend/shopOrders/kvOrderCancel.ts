/**
 * Hủy Đặt hàng KV (khi API cho phép) — không xóa cứng.
 */
import type { Db } from "mongodb";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
} from "../services/kvApiClient.js";

async function fetchJson(
  url: string,
  init?: RequestInit & { timeout?: number }
): Promise<any> {
  const timeout = init?.timeout ?? 60_000;
  const { timeout: _t, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      json?.responseStatus?.message ||
      json?.message ||
      text.slice(0, 400) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
}

export async function cancelShopOrderOnKiotViet(
  db: Db,
  kvOrderId: number | string
): Promise<{ ok: boolean; error?: string }> {
  const raw = String(kvOrderId || "").trim();
  if (!raw) return { ok: false, error: "missing_kv_order_id" };

  try {
    const creds = await loadKvCreds(db);
    if (!creds) return { ok: false, error: "no_kv_creds" };
    const token = await fetchKvAccessToken(creds);
    const api = kvApiBase();
    const headers = {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    };

    const numericId: number | null = /^\d+$/.test(raw) ? Number(raw) : null;
    if (numericId == null || !Number.isFinite(numericId) || numericId <= 0) {
      return { ok: false, error: "kv_order_id_not_numeric" };
    }

    try {
      await fetchJson(`${api}/orders/${numericId}`, {
        method: "DELETE",
        headers,
        timeout: 60_000,
      });
      return { ok: true };
    } catch (e1: any) {
      try {
        await fetchJson(`${api}/orders`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ id: numericId, status: 4 }),
          timeout: 60_000,
        });
        return { ok: true };
      } catch (e2: any) {
        return {
          ok: false,
          error: String(e2?.message || e1?.message || "kv_cancel_failed"),
        };
      }
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e || "kv_cancel_failed") };
  }
}
