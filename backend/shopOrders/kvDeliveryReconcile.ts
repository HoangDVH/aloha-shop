/**
 * Đối soát giao hàng KV → shop (webhook invoice + poll).
 */
import type { Db } from "mongodb";
import { getKvInvoice } from "../shopInvoices/kvInvoiceClient.js";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
} from "../services/kvApiClient.js";
import { SHOP_ORDERS } from "./models.js";
import { completeShopOrderDelivered } from "./completeDelivered.js";
import { completeShopOrderReturned } from "./completeReturned.js";
import { decideFromKvInvoice, isKvDocumentCancelled } from "./kvDeliveryStatus.js";
import {
  findShopOrderByKvInvoice,
  findShopOrderByKvOrderId,
  findShopOrderByRef,
} from "./findShopOrder.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";
import { syncBus } from "../syncBus.js";

export type GetShopDb = () => Promise<Db>;
export type GetMainDb = () => Promise<Db>;

function deliveryReconcileEnabled(): boolean {
  const v = String(process.env.SHOP_KV_DELIVERY_RECONCILE ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

function deliveryReconcileIntervalMs(): number {
  const n = Number(process.env.SHOP_KV_DELIVERY_RECONCILE_MS || 60_000);
  return Number.isFinite(n) && n >= 15_000 ? Math.min(n, 600_000) : 60_000;
}

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

/** Parse WEB-… từ description HĐ/DH (đơn cũ). */
export function parseWebCodeFromText(text: string): string | null {
  const m = String(text || "")
    .toUpperCase()
    .match(/\bWEB-?\d{6}-[A-Z0-9]{3,8}\b/);
  if (!m) return null;
  const compact = m[0].replace(/-/g, "");
  const mm = compact.match(/^WEB(\d{6})([A-Z0-9]{3,8})$/);
  if (!mm) return null;
  return `WEB-${mm[1]}-${mm[2]}`;
}

export async function resolveShopOrderFromKvInvoice(
  shopDb: Db,
  inv: any
): Promise<Record<string, unknown> | null> {
  const kvInvoiceId = inv?.id ?? inv?.Id ?? inv?.invoiceId;
  const kvInvoiceCode = String(inv?.code || inv?.Code || "").trim();
  let order =
    (await findShopOrderByKvInvoice(shopDb, { kvInvoiceId, kvInvoiceCode })) ||
    null;

  const orderId = inv?.orderId ?? inv?.OrderId;
  const orderCode = String(
    inv?.orderCode || inv?.OrderCode || ""
  ).trim();
  if (!order && orderId != null && orderId !== "") {
    order = await findShopOrderByKvOrderId(shopDb, orderId);
  }
  if (!order && orderCode) {
    order = await findShopOrderByRef(shopDb, orderCode);
  }
  if (!order) {
    const web = parseWebCodeFromText(
      String(inv?.description || inv?.Description || "")
    );
    if (web) order = await findShopOrderByRef(shopDb, web);
  }
  return order;
}

export async function applyKvInvoiceDeliveryToShop(opts: {
  shopDb: Db;
  mainDb: Db;
  inv: any;
  confirmedBy: string;
}): Promise<{ action: string; code?: string; detail?: string }> {
  const { shopDb, mainDb, inv } = opts;
  const order = await resolveShopOrderFromKvInvoice(shopDb, inv);
  if (!order) return { action: "no_order" };

  const code = String(order.code || order.id || "");
  const decision = decideFromKvInvoice(inv);
  const kvInvoiceId = inv?.id ?? inv?.Id ?? null;
  const kvInvoiceCode = String(inv?.code || inv?.Code || "").trim() || null;
  const kvOrderId = inv?.orderId ?? inv?.OrderId ?? order.kvOrderId ?? null;
  const kvOrderCode =
    String(inv?.orderCode || inv?.OrderCode || order.kvOrderCode || "").trim() ||
    null;

  if (decision.action === "return") {
    const r = await completeShopOrderReturned({
      shopDb,
      orderRef: code,
      confirmedBy: opts.confirmedBy,
      reason: decision.reason,
      source: opts.confirmedBy,
    });
    return {
      action: r.skipped ? "return_skip" : r.ok ? "return" : "return_fail",
      code,
      detail: r.error || decision.reason,
    };
  }

  if (decision.action === "complete") {
    const r = await completeShopOrderDelivered({
      shopDb,
      mainDb,
      orderRef: code,
      confirmedBy: opts.confirmedBy,
      kvInvoiceId,
      kvInvoiceCode,
      kvOrderId,
      kvOrderCode,
      skipCreateKvInvoice: true,
    });
    return {
      action: r.skipped ? "complete_skip" : r.ok ? "complete" : "complete_fail",
      code,
      detail: r.error || decision.reason,
    };
  }

  if (
    decision.action === "shipping" &&
    String(order.orderStatus) === "cho_xu_ly"
  ) {
    const now = new Date().toISOString();
    await shopDb.collection(SHOP_ORDERS).updateOne(
      {
        _id: (order as any)._id,
        orderStatus: { $nin: ["hoan_thanh", "huy", "dang_giao"] },
      },
      {
        $set: {
          orderStatus: "dang_giao",
          shippingAt: now,
          updatedAt: now,
          shippingBy: opts.confirmedBy,
        },
      }
    );
    syncBus.publish(["shop_orders"], "mark-shipping", { ids: [code] });
    void notifyOrderStatus(
      shopDb,
      { ...order, orderStatus: "dang_giao" },
      "dang_giao"
    ).catch(() => undefined);
    return { action: "shipping", code, detail: decision.reason };
  }

  return { action: "wait", code, detail: decision.reason };
}

/** Xử lý 1 HĐ từ webhook — GET lại rồi quyết (không tin body). */
export async function reconcileDeliveryByKvInvoiceRef(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ref: { kvInvoiceId?: unknown; kvInvoiceCode?: string | null }
): Promise<string> {
  const shopDb = await getShopDb();
  const mainDb = await getMainDb();
  const idOrCode = String(
    ref.kvInvoiceCode || ref.kvInvoiceId || ""
  ).trim();
  if (!idOrCode) return "no_ref";

  let inv: any;
  try {
    inv = await getKvInvoice(mainDb, idOrCode);
  } catch (e: any) {
    console.warn(
      "[kv-delivery] get invoice",
      idOrCode,
      e?.message || e
    );
    return "get_fail";
  }

  // Bổ sung includeInvoiceDelivery nếu thiếu — list lại theo orderId
  if (
    !(inv?.invoiceDelivery || inv?.InvoiceDelivery || inv?.deliveryDetail) &&
    (inv?.orderId || inv?.OrderId)
  ) {
    try {
      const creds = await loadKvCreds(mainDb);
      if (creds) {
        const token = await fetchKvAccessToken(creds);
        const api = kvApiBase();
        const oid = inv.orderId ?? inv.OrderId;
        const json = await fetchJson(
          `${api}/invoices?orderId=${encodeURIComponent(String(oid))}&includePayment=true&includeInvoiceDelivery=true&pageSize=5`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Retailer: creds.retailer,
            },
            timeout: 60_000,
          }
        );
        const list = Array.isArray(json?.data) ? json.data : [];
        const match =
          list.find(
            (x: any) =>
              String(x?.id) === String(inv?.id) ||
              String(x?.code) === String(inv?.code)
          ) || list[0];
        if (match) inv = { ...inv, ...match };
      }
    } catch {
      /* giữ inv gốc */
    }
  }

  const r = await applyKvInvoiceDeliveryToShop({
    shopDb,
    mainDb,
    inv,
    confirmedBy: "kv_invoice_delivery",
  });
  return `${r.action}:${r.code || ""}:${r.detail || ""}`;
}

/** Hủy Đặt hàng KV (order status 4) → returned shop. */
export async function applyKvOrderCancelledToShop(opts: {
  shopDb: Db;
  kvOrderId?: unknown;
  kvOrderCode?: string;
  confirmedBy: string;
}): Promise<string> {
  let order =
    (await findShopOrderByKvOrderId(opts.shopDb, opts.kvOrderId as any)) ||
    (opts.kvOrderCode
      ? await findShopOrderByRef(opts.shopDb, opts.kvOrderCode)
      : null);
  if (!order) return "no_order";
  const code = String(order.code || order.id);
  if (String(order.orderStatus) === "huy") return `skip:${code}`;
  const r = await completeShopOrderReturned({
    shopDb: opts.shopDb,
    orderRef: code,
    confirmedBy: opts.confirmedBy,
    reason: "kv_order_cancelled",
    source: opts.confirmedBy,
  });
  return r.ok ? `return:${code}` : `fail:${code}`;
}

export async function reconcileOpenCodDeliveries(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
): Promise<{ checked: number; acted: number }> {
  if (!deliveryReconcileEnabled()) return { checked: 0, acted: 0 };
  const shopDb = await getShopDb();
  const mainDb = await getMainDb();

  const open = await shopDb
    .collection(SHOP_ORDERS)
    .find({
      paymentStatus: "cod",
      orderStatus: { $in: ["cho_xu_ly", "dang_giao"] },
      kvOrderId: { $ne: null, $exists: true },
      source: "shop_web",
    })
    .sort({ updatedAt: 1 })
    .limit(40)
    .toArray();

  let acted = 0;
  for (const order of open) {
    try {
      const kvOrderId = (order as any).kvOrderId;
      let inv: any = null;

      if ((order as any).kvInvoiceId || (order as any).kvInvoiceCode) {
        try {
          inv = await getKvInvoice(
            mainDb,
            String((order as any).kvInvoiceCode || (order as any).kvInvoiceId)
          );
        } catch {
          /* thử list theo orderId */
        }
      }

      if (!inv && kvOrderId != null) {
        const creds = await loadKvCreds(mainDb);
        if (creds) {
          const token = await fetchKvAccessToken(creds);
          const api = kvApiBase();
          const json = await fetchJson(
            `${api}/invoices?orderId=${encodeURIComponent(String(kvOrderId))}&includePayment=true&includeInvoiceDelivery=true&pageSize=10`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                Retailer: creds.retailer,
              },
              timeout: 60_000,
            }
          );
          const data = Array.isArray(json?.data) ? json.data : [];
          inv =
            data.find((x: any) => !isKvDocumentCancelled(x?.status ?? x?.Status)) ||
            data[0] ||
            null;
        }
      }

      if (!inv) {
        // Kiểm tra Đặt hàng bị hủy
        try {
          const creds = await loadKvCreds(mainDb);
          if (creds && kvOrderId != null) {
            const token = await fetchKvAccessToken(creds);
            const api = kvApiBase();
            const json = await fetchJson(
              `${api}/orders/${encodeURIComponent(String(kvOrderId))}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                  Retailer: creds.retailer,
                },
                timeout: 60_000,
              }
            );
            const ord = json?.data ?? json;
            if (isKvDocumentCancelled(ord?.status ?? ord?.Status)) {
              const r = await applyKvOrderCancelledToShop({
                shopDb,
                kvOrderId,
                kvOrderCode: String(ord?.code || ""),
                confirmedBy: "kv_delivery_reconcile",
              });
              if (r.startsWith("return")) acted++;
            }
          }
        } catch {
          /* ignore */
        }
        continue;
      }

      const r = await applyKvInvoiceDeliveryToShop({
        shopDb,
        mainDb,
        inv,
        confirmedBy: "kv_delivery_reconcile",
      });
      if (r.action === "complete" || r.action === "return" || r.action === "shipping") {
        acted++;
      }
    } catch (e: any) {
      console.warn(
        "[kv-delivery-reconcile]",
        (order as any).code,
        e?.message || e
      );
    }
  }

  return { checked: open.length, acted };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startKvDeliveryReconcile(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
): void {
  if (!deliveryReconcileEnabled()) {
    console.log("[kv-delivery-reconcile] Tắt (SHOP_KV_DELIVERY_RECONCILE=0)");
    return;
  }
  if (timer) return;
  const interval = deliveryReconcileIntervalMs();
  const tick = () => {
    void reconcileOpenCodDeliveries(getShopDb, getMainDb)
      .then((r) => {
        if (r.acted > 0) {
          console.log("[kv-delivery-reconcile] tick", r);
        }
      })
      .catch((e: any) => {
        console.warn(
          "[kv-delivery-reconcile] tick lỗi (Mongo/KV tạm thời?):",
          e?.message || e
        );
      });
  };
  tick();
  timer = setInterval(tick, interval);
  console.log(
    `[kv-delivery-reconcile] Bật — mỗi ${Math.round(interval / 1000)}s`
  );
}

export function stopKvDeliveryReconcile(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
