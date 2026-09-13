/**
 * Tìm đơn shop theo mã hiện tại, legacyCodes (WEB- cũ), hoặc kvOrderId / HĐ KV.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";

export async function findShopOrderByRef(
  shopDb: Db,
  ref: string | number | null | undefined
): Promise<Record<string, unknown> | null> {
  const raw = String(ref ?? "").trim();
  if (!raw) return null;
  const doc = await shopDb.collection(SHOP_ORDERS).findOne({
    $or: [
      { code: raw },
      { id: raw },
      { kvOrderCode: raw },
      { kvInvoiceCode: raw },
      { legacyCodes: raw },
    ],
  });
  return doc as Record<string, unknown> | null;
}

export async function findShopOrderByKvOrderId(
  shopDb: Db,
  kvOrderId: string | number | null | undefined
): Promise<Record<string, unknown> | null> {
  if (kvOrderId == null || kvOrderId === "") return null;
  const n = Number(kvOrderId);
  const or: Record<string, unknown>[] = [{ kvOrderId }];
  if (Number.isFinite(n) && n > 0) {
    or.push({ kvOrderId: n });
    or.push({ kvOrderId: String(n) });
  }
  const doc = await shopDb.collection(SHOP_ORDERS).findOne({ $or: or });
  return doc as Record<string, unknown> | null;
}

export async function findShopOrderByKvInvoice(
  shopDb: Db,
  opts: {
    kvInvoiceId?: string | number | null;
    kvInvoiceCode?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  const or: Record<string, unknown>[] = [];
  const id = opts.kvInvoiceId;
  const code = String(opts.kvInvoiceCode || "").trim();
  if (id != null && id !== "") {
    or.push({ kvInvoiceId: id });
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) {
      or.push({ kvInvoiceId: n });
      or.push({ kvInvoiceId: String(n) });
    }
  }
  if (code) or.push({ kvInvoiceCode: code });
  if (!or.length) return null;
  const doc = await shopDb.collection(SHOP_ORDERS).findOne({ $or: or });
  return doc as Record<string, unknown> | null;
}

/** Query tìm đơn theo mã khách gõ (kể cả WEB- trong legacyCodes). */
export function shopOrderLookupFilter(ref: string): Record<string, unknown> {
  const id = String(ref || "").trim();
  return {
    $or: [{ id }, { code: id }, { kvOrderCode: id }, { legacyCodes: id }],
  };
}
