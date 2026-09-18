/**
 * Đồng bộ CK: HĐ KV đã thu → đánh dấu đơn shop paid.
 * Bù khi webhook KiotViet lỗi chữ ký / bị tắt / chậm.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS, ensureShopOrderIndexes } from "./models.js";
import { markShopOrderPaid } from "./markPaid.js";
import { getKvInvoice } from "../shopInvoices/kvInvoiceClient.js";

export type GetShopDb = () => Promise<Db>;
export type GetMainDb = () => Promise<Db>;

function reconcileEnabled(): boolean {
  const v = String(process.env.SHOP_KV_PAY_RECONCILE ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

function reconcileIntervalMs(): number {
  const n = Number(process.env.SHOP_KV_PAY_RECONCILE_MS || 20_000);
  return Number.isFinite(n) && n >= 5_000 ? Math.floor(n) : 20_000;
}

function invoiceReceivedAmount(inv: any): number {
  const totalPayment = Math.round(
    Number(inv?.TotalPayment ?? inv?.totalPayment ?? 0) || 0
  );
  const payments = Array.isArray(inv?.Payments)
    ? inv.Payments
    : Array.isArray(inv?.payments)
      ? inv.payments
      : [];
  const sum = payments.reduce(
    (s: number, p: any) =>
      s + Math.round(Number(p?.Amount ?? p?.amount ?? 0) || 0),
    0
  );
  return Math.max(totalPayment, sum);
}

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Một đơn: lấy HĐ từ KV, đủ tiền → markPaid (không tin webhook body trừ khi API lỗi). */
export async function reconcileShopOrderAgainstKv(opts: {
  shopDb: Db;
  mainDb: Db;
  order: any;
  /** Khi GET KV lỗi — dùng số tiền từ webhook body (nếu có). */
  fallbackReceived?: number;
}): Promise<"paid" | "skip" | "fail"> {
  const order = opts.order;
  const code = String(order?.code || order?.id || "").trim();
  const invId = order?.kvInvoiceId;
  const invCode = String(order?.kvInvoiceCode || "").trim();
  if (!code || ((invId == null || invId === "") && !invCode)) return "skip";

  const status = String(order.paymentStatus || "");
  if (status === "paid" || status === "cod" || status === "cancelled") {
    return "skip";
  }

  const expected = Math.round(Number(order.totalPayment ?? order.total) || 0);
  if (expected <= 0) return "skip";

  let received = 0;
  let fromApi = false;
  try {
    const inv = await getKvInvoice(opts.mainDb, String(invId ?? invCode));
    if (inv) {
      received = invoiceReceivedAmount(inv);
      fromApi = true;
    }
  } catch (e: any) {
    console.warn("[kv-pay-reconcile] get invoice", code, e?.message || e);
    const fb = Math.round(Number(opts.fallbackReceived) || 0);
    if (fb > 0) {
      received = fb;
      console.warn("[kv-pay-reconcile] dùng số tiền webhook body", code, fb);
    } else {
      return "fail";
    }
  }

  if (received < expected) return "skip";

  const result = await markShopOrderPaid({
    shopDb: opts.shopDb,
    mainDb: opts.mainDb,
    orderCode: code,
    source: "kiotqr",
    allowExpired: true,
    confirmedBy: fromApi ? "kiotqr_reconcile" : "kiotqr_webhook_body",
  });
  if (result.ok) {
    console.log("[kv-pay-reconcile] paid", code, {
      received,
      expected,
      hd: invCode,
      fromApi,
    });
    return "paid";
  }
  console.warn("[kv-pay-reconcile] markPaid fail", code, result.error);
  return "fail";
}

/** Quét đơn CK chưa paid có HĐ KV. */
export async function reconcileAwaitingKvPayments(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
): Promise<{ checked: number; paid: number }> {
  if (!reconcileEnabled()) return { checked: 0, paid: 0 };
  if (running) return { checked: 0, paid: 0 };
  running = true;
  let checked = 0;
  let paid = 0;
  try {
    const shopDb = await getShopDb();
    const mainDb = await getMainDb();
    await ensureShopOrderIndexes(shopDb);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await shopDb
      .collection(SHOP_ORDERS)
      .find({
        method: "Transfer",
        paymentStatus: { $in: ["unpaid", "processing", "underpaid", "expired"] },
        kvInvoiceId: { $ne: null },
        createdAt: { $gte: since },
      })
      .sort({ createdAt: -1 })
      .limit(40)
      .toArray();

    for (const order of rows) {
      checked++;
      const r = await reconcileShopOrderAgainstKv({ shopDb, mainDb, order });
      if (r === "paid") paid++;
    }
  } catch (e: any) {
    console.warn("[kv-pay-reconcile]", e?.message || e);
  } finally {
    running = false;
  }
  return { checked, paid };
}

/** Đồng bộ ngay 1 HĐ (từ webhook / admin). */
export async function reconcileByKvInvoiceRef(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ref: {
    kvInvoiceId?: number | string | null;
    kvInvoiceCode?: string | null;
    fallbackReceived?: number;
  }
): Promise<"paid" | "skip" | "fail" | "no_order"> {
  const shopDb = await getShopDb();
  const mainDb = await getMainDb();
  const invId = ref.kvInvoiceId;
  const invCode = String(ref.kvInvoiceCode || "").trim();

  let order: any = null;
  if (invId != null && invId !== "") {
    order = await shopDb.collection(SHOP_ORDERS).findOne({
      kvInvoiceId: { $in: [invId, Number(invId), String(invId)] },
    });
  }
  if (!order && invCode) {
    order = await shopDb.collection(SHOP_ORDERS).findOne({ kvInvoiceCode: invCode });
  }
  if (!order) return "no_order";
  return reconcileShopOrderAgainstKv({
    shopDb,
    mainDb,
    order,
    fallbackReceived: ref.fallbackReceived,
  });
}

export function startKvPaymentReconcile(
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  if (!reconcileEnabled()) {
    console.log("[kv-pay-reconcile] Tắt (SHOP_KV_PAY_RECONCILE=0)");
    return;
  }
  const interval = reconcileIntervalMs();
  const tick = () => {
    void reconcileAwaitingKvPayments(getShopDb, getMainDb)
      .then((r) => {
        if (r.paid > 0) {
          console.log("[kv-pay-reconcile] tick", r);
        }
      })
      .catch((e: any) => {
        console.warn(
          "[kv-pay-reconcile] tick lỗi (Mongo/KV tạm thời?):",
          e?.message || e
        );
      });
  };
  setTimeout(tick, 15_000);
  timer = setInterval(tick, interval);
  console.log(
    `[kv-pay-reconcile] Bật — đối soát HĐ KV mỗi ${Math.round(interval / 1000)}s`
  );
}

export function stopKvPaymentReconcile() {
  if (timer) clearInterval(timer);
  timer = null;
}
