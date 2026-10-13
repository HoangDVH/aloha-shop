/**
 * Đồng bộ CK: HĐ KV đã thu → đánh dấu đơn shop paid.
 * Bù khi webhook KiotViet lỗi chữ ký / bị tắt / chậm.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS, ensureShopOrderIndexes } from "./models.js";
import { markShopOrderPaid } from "./markPaid.js";
import { getKvInvoice } from "../shopInvoices/kvInvoiceClient.js";
import { syncBus } from "../syncBus.js";

export type GetShopDb = () => Promise<Db>;
export type GetMainDb = () => Promise<Db>;

function reconcileEnabled(): boolean {
  const v = String(process.env.SHOP_KV_PAY_RECONCILE ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

function reconcileIntervalMs(): number {
  const n = Number(process.env.SHOP_KV_PAY_RECONCILE_MS || 5_000);
  return Number.isFinite(n) && n >= 3_000 ? Math.floor(n) : 5_000;
}

/** Exported cho GET /orders/me/:id throttle đối soát theo cùng env. */
export function kvPayReconcileThrottleMs(): number {
  return reconcileIntervalMs();
}

function invoiceReceivedAmount(inv: any): number {
  // Aggregate received amount from the API, not individual cancelled payment rows.
  const amount = Number(inv?.TotalPayment ?? inv?.totalPayment ?? inv?.PaidAmount ?? inv?.paidAmount);
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(amount)) ? Math.round(amount) : NaN;
}

async function recordVerificationPending(db: Db, order: any, reason: string) {
  const at = new Date().toISOString();
  await db.collection(SHOP_ORDERS).updateOne({ _id: order._id, paymentStatus: { $in: ["unpaid", "processing", "underpaid", "expired", "failed"] } }, {
    $set: { "kvPaymentVerification.state": "pending", "kvPaymentVerification.reason": reason, "kvPaymentVerification.lastAttemptAt": at },
    $inc: { "kvPaymentVerification.attempts": 1 },
    $push: { kvPaymentVerificationHistory: { $each: [{ at, reason }], $slice: -20 } } as any,
  });
  syncBus.publish(["shop_orders"], "kv-payment-verification", { ids: [String(order.code)] });
}

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** API-only verification: a lookup failure must never authorize a payment. */
export async function reconcileShopOrderAgainstKv(opts: {
  shopDb: Db;
  mainDb: Db;
  order: any;
}, deps = { getInvoice: getKvInvoice, markPaid: markShopOrderPaid }): Promise<"paid" | "skip" | "fail"> {
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
  if (!Number.isSafeInteger(expected) || expected <= 0) return "skip";

  let received = 0;
  const fail = async (reason: string) => { await recordVerificationPending(opts.shopDb, order, reason); return "fail" as const; };
  try {
    const inv = await deps.getInvoice(opts.mainDb, String(invId ?? invCode));
    if (!inv) return await fail("invoice_unavailable");
    if ((invId != null && String(inv.id ?? inv.Id) !== String(invId)) ||
      (invCode && String(inv.code ?? inv.Code) !== invCode) ||
      (order.kvCustomerId != null && String(inv.customerId ?? inv.CustomerId) !== String(order.kvCustomerId))) return await fail("invoice_mismatch");
    if (Number(inv.status ?? inv.Status) !== 1 || [4, 5, 6].includes(Number(inv.invoiceDelivery?.status ?? inv.InvoiceDelivery?.Status))) return await fail("invoice_not_completed");
    received = invoiceReceivedAmount(inv);
    if (!Number.isSafeInteger(received)) return await fail("invalid_received_amount");
  } catch (e: any) {
    console.warn("[kv-pay-reconcile] get invoice", code, e?.message || e);
    return await fail("api_unavailable");
  }

  if (received < expected) { await recordVerificationPending(opts.shopDb, order, "insufficient_received_amount"); return "skip"; }

  const result = await deps.markPaid({
    shopDb: opts.shopDb,
    mainDb: opts.mainDb,
    orderCode: code,
    source: "kiotqr",
    allowExpired: true,
    confirmedBy: "kiotqr_reconcile",
    kvPaymentProof: { invoiceId: String(invId ?? ""), invoiceCode: invCode, expected, received },
  });
  if (result.ok) {
    console.log("[kv-pay-reconcile] paid", code, {
      received,
      expected,
      hd: invCode,
    });
    return "paid";
  }
  console.warn("[kv-pay-reconcile] markPaid fail", code, result.error);
  await recordVerificationPending(opts.shopDb, order, "order_changed_or_processing_failed");
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
        paymentStatus: { $in: ["unpaid", "processing", "underpaid", "expired", "failed"] },
        $and: [
          { $or: [{ kvInvoiceId: { $ne: null } }, { kvInvoiceCode: { $type: "string", $ne: "" } }] },
          { $or: [{ createdAt: { $gte: since } }, { "kvPaymentVerification.state": "pending" }] },
        ],
      })
      .sort({ "kvPaymentVerification.lastAttemptAt": 1, createdAt: 1 })
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
