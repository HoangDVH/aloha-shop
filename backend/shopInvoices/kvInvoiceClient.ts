/**
 * Client KV invoices — list/get/cancel + tái dùng push từ shopOrders/kvPush.
 */
import type { Db } from "mongodb";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
} from "../services/kvApiClient.js";
import {
  cancelShopInvoiceOnKiotViet,
  cancelShopInvoiceOnKiotVietStrict,
  pushShopInvoiceToKiotViet,
  pushShopOrderToKiotViet,
  type PushShopInvoiceKvResult,
  type PushShopOrderKvInput,
  type PushShopOrderKvResult,
} from "../shopOrders/kvPush.js";
import type { KvInvoiceListParams } from "./types.js";

async function fetchJson(
  url: string,
  init?: RequestInit & { timeout?: number }
): Promise<any> {
  const timeout = init?.timeout ?? 120_000;
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

export async function createKvInvoice(
  db: Db,
  input: PushShopOrderKvInput
): Promise<PushShopInvoiceKvResult> {
  return pushShopInvoiceToKiotViet(db, {
    ...input,
    // Giữ cờ caller (awaiting = HĐ chờ CK / KiotQR)
    awaitingBankTransfer: input.awaitingBankTransfer === true,
  });
}

/** Đặt hàng KV (COD web lúc đặt). */
export async function createKvOrder(
  db: Db,
  input: PushShopOrderKvInput
): Promise<PushShopOrderKvResult> {
  return pushShopOrderToKiotViet(db, input);
}

export async function cancelKvInvoice(
  db: Db,
  kvInvoiceId: number | string
): Promise<boolean> {
  return cancelShopInvoiceOnKiotViet(db, kvInvoiceId);
}

/** Hủy HĐ — ném lỗi message KV nếu thất bại (dùng cho nút admin). */
export async function cancelKvInvoiceStrict(
  db: Db,
  kvInvoiceId: number | string
): Promise<void> {
  return cancelShopInvoiceOnKiotVietStrict(db, kvInvoiceId);
}

/**
 * Thu tiền trên HĐ KV đã có (HĐ chờ CK) — POST /payments.
 * Giữ nguyên mã HĐ, không tạo HĐ mới.
 */
export async function payKvInvoice(
  db: Db,
  opts: {
    invoiceId: number | string;
    amount: number;
    method?: string;
  }
): Promise<{ paymentId?: number | string; paymentCode?: string }> {
  const id = String(opts.invoiceId || "").trim();
  if (!id) throw new Error("Thiếu mã hóa đơn để thu tiền");
  const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
  if (amount <= 0) throw new Error("Số tiền thu phải > 0");

  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("Chưa cấu hình KiotViet");
  const token = await fetchKvAccessToken(creds);
  const api = kvApiBase();
  const accountId = Number(process.env.SHOP_KV_ACCOUNT_ID || 0) || undefined;
  const body: Record<string, unknown> = {
    invoiceId: Number(id) || id,
    amount,
    method: opts.method || "Transfer",
  };
  if (accountId) body.accountId = accountId;

  const json = await fetchJson(`${api}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeout: 60_000,
  });
  const data = json?.data ?? json;
  return {
    paymentId: data?.paymentId ?? data?.id,
    paymentCode: data?.paymentCode ?? data?.code,
  };
}

export async function listKvInvoices(
  db: Db,
  params: KvInvoiceListParams = {}
): Promise<{ data: any[]; total?: number; raw: any }> {
  const creds = await loadKvCreds(db);
  if (!creds) {
    throw new Error("Chưa cấu hình KiotViet (clientId / secret / retailer)");
  }
  const token = await fetchKvAccessToken(creds);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const currentItem = Math.max(0, Number(params.currentItem) || 0);
  const qs = new URLSearchParams();
  qs.set("pageSize", String(pageSize));
  qs.set("currentItem", String(currentItem));
  qs.set("orderBy", params.orderBy || "purchaseDate");
  qs.set("orderDirection", params.orderDirection || "DESC");
  if (params.includePayment !== false) qs.set("includePayment", "true");
  // Một số gian hàng KV trả kèm dòng SP khi bật cờ này
  qs.set("includeInvoiceDetails", "true");
  // Lấy tên kênh bán (saleChannels) — giống sổ HĐ KV
  qs.set("includeSaleChannel", "true");
  if (params.fromPurchaseDate) {
    qs.set("fromPurchaseDate", params.fromPurchaseDate);
  }
  if (params.toPurchaseDate) {
    qs.set("toPurchaseDate", params.toPurchaseDate);
  }
  if (params.status != null && params.status !== "") {
    qs.set("status", String(params.status));
  }
  if (params.code) qs.set("code", String(params.code).trim());

  const api = kvApiBase();
  const json = await fetchJson(`${api}/invoices?${qs.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    },
    timeout: 120_000,
  });
  const data = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
      ? json
      : [];
  const total =
    typeof json?.total === "number"
      ? json.total
      : typeof json?.totalValue === "number"
        ? json.totalValue
        : undefined;
  const enriched = await enrichInvoicesSaleChannel(db, creds, token, data);
  return { data: enriched, total, raw: json };
}

export async function getKvInvoice(
  db: Db,
  idOrCode: string
): Promise<any> {
  const id = String(idOrCode || "").trim();
  if (!id) throw new Error("Thiếu mã hóa đơn");
  const creds = await loadKvCreds(db);
  if (!creds) {
    throw new Error("Chưa cấu hình KiotViet (clientId / secret / retailer)");
  }
  const token = await fetchKvAccessToken(creds);
  const api = kvApiBase();
  const headers = {
    Authorization: `Bearer ${token}`,
    Retailer: creds.retailer,
  };

  // 1) Theo id số
  if (/^\d+$/.test(id)) {
    try {
      const json = await fetchJson(
        `${api}/invoices/${encodeURIComponent(id)}?includeSaleChannel=true&includePayment=true&includeInvoiceDetails=true&includeInvoiceDelivery=true`,
        {
          method: "GET",
          headers,
          timeout: 60_000,
        }
      );
      const data = json?.data ?? json;
      if (data?.id != null || data?.code) {
        const [one] = await enrichInvoicesSaleChannel(db, creds, token, [data]);
        return one;
      }
    } catch {
      /* thử theo mã */
    }
  }

  // 2) Theo mã HĐ — endpoint chuẩn KV
  try {
    const json = await fetchJson(
      `${api}/invoices/code/${encodeURIComponent(id)}?includeSaleChannel=true&includePayment=true&includeInvoiceDetails=true&includeInvoiceDelivery=true`,
      { method: "GET", headers, timeout: 60_000 }
    );
    const data = json?.data ?? json;
    if (data?.id != null || data?.code) {
      const [one] = await enrichInvoicesSaleChannel(db, creds, token, [data]);
      return one;
    }
  } catch {
    /* fallback list */
  }

  // 3) Thử path /invoices/{code} (một số proxy)
  try {
    const json = await fetchJson(`${api}/invoices/${encodeURIComponent(id)}`, {
      method: "GET",
      headers,
      timeout: 60_000,
    });
    const data = json?.data ?? json;
    if (data?.id != null || data?.code) {
      const [one] = await enrichInvoicesSaleChannel(db, creds, token, [data]);
      return one;
    }
  } catch {
    /* ignore */
  }

  throw new Error(`Không tìm thấy hóa đơn «${id}»`);
}

type KvCredsLite = { retailer: string; clientId?: string; clientSecret?: string };

let saleChannelCache: { at: number; map: Map<string, string> } | null = null;

async function loadSaleChannelNameMap(
  creds: KvCredsLite,
  token: string
): Promise<Map<string, string>> {
  const now = Date.now();
  if (saleChannelCache && now - saleChannelCache.at < 10 * 60_000) {
    return saleChannelCache.map;
  }
  const api = kvApiBase();
  const map = new Map<string, string>();
  try {
    const json = await fetchJson(`${api}/salechannel`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Retailer: creds.retailer,
      },
      timeout: 30_000,
    });
    const channels = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];
    for (const c of channels) {
      const id = c?.id != null ? String(c.id) : "";
      const name = String(c?.name || "").trim();
      if (id && name) map.set(id, name);
    }
  } catch {
    /* giữ map rỗng */
  }
  saleChannelCache = { at: now, map };
  return map;
}

/** Gắn saleChannelName + chuẩn hoá soldByName từ dữ liệu KV. */
export async function enrichInvoicesSaleChannel(
  _db: Db,
  creds: KvCredsLite | null,
  token: string | null,
  invoices: any[]
): Promise<any[]> {
  if (!Array.isArray(invoices) || !invoices.length) return invoices;
  let map = new Map<string, string>();
  if (creds && token) {
    map = await loadSaleChannelNameMap(creds, token);
  } else {
    try {
      const c = await loadKvCreds(_db);
      if (c) {
        const t = await fetchKvAccessToken(c);
        map = await loadSaleChannelNameMap(c, t);
      }
    } catch {
      /* ignore */
    }
  }

  return invoices.map((inv) => {
    const saleChannelId =
      inv?.saleChannelId ??
      inv?.SaleChannelId ??
      (Array.isArray(inv?.saleChannels) && inv.saleChannels[0]?.id != null
        ? inv.saleChannels[0].id
        : undefined);
    const fromEmbedded = (() => {
      const channels = Array.isArray(inv?.saleChannels) ? inv.saleChannels : [];
      if (!channels.length) {
        const sc = inv?.saleChannel;
        if (sc && typeof sc === "object") return String(sc.name || "").trim();
        return String(inv?.saleChannelName || "").trim();
      }
      if (saleChannelId != null && saleChannelId !== "") {
        const hit = channels.find(
          (c: any) => String(c?.id) === String(saleChannelId)
        );
        if (hit?.name) return String(hit.name).trim();
      }
      return String(channels[0]?.name || "").trim();
    })();
    const saleChannelName =
      fromEmbedded ||
      (saleChannelId != null ? map.get(String(saleChannelId)) || "" : "") ||
      "";

    const soldByName = String(
      inv?.soldByName || inv?.SoldByName || ""
    ).trim();

    return {
      ...inv,
      soldByName: soldByName || inv?.soldByName,
      saleChannelId: saleChannelId ?? inv?.saleChannelId ?? null,
      saleChannelName: saleChannelName || null,
      createdByName: inv?.createdByName || inv?.CreatedByName || null,
      orderCode: inv?.orderCode || inv?.OrderCode || null,
      priceBookName:
        inv?.priceBookName ||
        inv?.PriceBookName ||
        inv?.priceBook?.name ||
        null,
    };
  });
}

/** Cập nhật ghi chú HĐ (nếu KV cho phép PUT). */
export async function updateKvInvoiceDescription(
  db: Db,
  invoiceId: number | string,
  description: string
): Promise<any> {
  const id = String(invoiceId || "").trim();
  if (!id) throw new Error("Thiếu mã hóa đơn");
  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("Chưa cấu hình KiotViet");
  const token = await fetchKvAccessToken(creds);
  const api = kvApiBase();
  const json = await fetchJson(`${api}/invoices/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: Number(id) || id,
      description: String(description || "").slice(0, 500),
    }),
    timeout: 60_000,
  });
  return json?.data ?? json;
}
