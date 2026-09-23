import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Db } from "mongodb";
import { SHOP_ORDERS, newShopOrderCode, type ShopOrderDetail } from "./models.js";
import { createShopStockHolds, releaseShopStockHolds } from "./stockHold.js";
import { syncBus } from "../syncBus.js";

export const BACKORDER_TERMS_VERSION = "2026-09-23";

/** Serialize stock check + reservation across API workers, including ordinary orders. */
export function serializeShopCheckout(getDb: () => Promise<Db>): RequestHandler {
  return async (_req, res, next) => {
    const owner = randomUUID();
    try {
      const db = await getDb();
      const col = db.collection<{ _id: string; owner: string; expiresAt: Date }>("aloha_shop_checkout_lock");
      try {
        await col.updateOne({ _id: "checkout", expiresAt: { $lte: new Date() } },
          { $set: { owner, expiresAt: new Date(Date.now() + 180000) } }, { upsert: true });
      } catch (error: any) {
        if (error.code === 11000) {
          res.setHeader("Retry-After", "2");
          res.status(409).json({ error: "Shop đang cập nhật tồn kho. Vui lòng thử lại sau ít giây.", code: "checkout_busy" });
          return;
        }
        throw error;
      }
      const timer = setInterval(() => {
        void col.updateOne({ _id: "checkout", owner }, { $set: { expiresAt: new Date(Date.now() + 180000) } })
          .catch(() => { /* lease expires if the database becomes unavailable */ });
      }, 30000);
      timer.unref();
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        void col.deleteOne({ _id: "checkout", owner }).catch(() => {});
      };
      res.once("finish", release);
      // Keep the lease until the handler finishes, even if the client disconnects.
      res.once("close", () => {
        if (res.writableFinished) release();
        else clearInterval(timer); // Disconnected requests cannot renew forever.
      });
      next();
    } catch {
      res.status(503).json({ error: "Chưa kiểm tra được tồn kho. Vui lòng thử lại." });
    }
  };
}

export async function createBackorderRequest(db: Db, input: {
  userId: string; account: any; body: any; details: ShopOrderDetail[];
}) {
  const { body, account, userId, details } = input;
  const hasPreOrder = details.some(d => d.preOrder);
  if (hasPreOrder && body.backorderAccepted !== true) {
    return { status: 409, body: { code: "backorder_confirmation_required",
      error: "Số lượng có sẵn đã thay đổi. Vui lòng đồng ý chờ Aloha kiểm tra và liên hệ xác nhận.",
      details } };
  }
  const key = String(body.idempotencyKey || "").trim().slice(0, 80);
  if (!key) return { status: 400, body: { error: "Thiếu mã chống đặt trùng" } };
  const previous = await db.collection(SHOP_ORDERS).findOne({ shopAccountId: userId, idempotencyKey: key });
  if (previous) return { status: 200, body: { ok: true, reused: true, data: previous } };
  const code = newShopOrderCode();
  const now = new Date();
  const subtotal = details.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const holdExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const doc = {
    id: code, code, revision: 0, shopAccountId: userId, customerName: String(body.customerName).slice(0, 120),
    customerPhone: String(body.customerPhone).slice(0, 30), customerEmail: account?.email || null,
    deliveryMethod: body.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi",
    shippingAddress: String(body.shippingAddress || body.detail || "").slice(0, 300),
    province: String(body.province || "").slice(0, 120), ward: String(body.ward || "").slice(0, 120),
    district: String(body.district || "").slice(0, 120),
    customerNote: String(body.customerNote || "").slice(0, 500),
    orderDetails: details, subtotal, total: subtotal, shippingFee: 0, shippingFeePending: true,
    totalPayment: 0, paidAmount: 0, paymentStatus: "unpaid", method: "Pending", usingCod: false,
    orderStatus: "cho_xac_nhan", status: "cho_xac_nhan", statusValue: "Chờ Aloha xác nhận",
    hasPreOrder, backorderStatus: "pending_confirmation", backorderAcceptedAt: hasPreOrder ? now.toISOString() : null,
    backorderTermsVersion: BACKORDER_TERMS_VERSION, idempotencyKey: key,
    stockApplied: false, stockHeld: true, holdExpiresAt, expiresAt: null,
    kvCustomerId: account?.kvCustomerId || null, kvPushStatus: account?.siStatus === "active" && !account.kvCustomerId ? "awaiting_customer_link" : "awaiting_confirmation",
    priceMode: account?.siStatus === "active" && account?.roles?.includes("si") ? "si" : "web",
    siRegion: account?.siRegion || null,
    source: "shop_web", createdAt: now.toISOString(), updatedAt: now.toISOString(),
    purchaseDate: now.toISOString(), done: false,
  };
  const inserted = await db.collection(SHOP_ORDERS).insertOne(doc);
  try {
    await createShopStockHolds({ shopDb: db, orderId: code, orderCode: code,
      details: details.filter(d => (d.availableQty || 0) > 0).map(d => ({ ...d, preOrder: false, quantity: d.availableQty! })),
      expiresAt: holdExpiresAt });
  } catch (error) {
    await releaseShopStockHolds(db, code);
    await db.collection(SHOP_ORDERS).deleteOne({ _id: inserted.insertedId });
    throw error;
  }
  syncBus.publish(["shop_orders"], "shop-backorder-request", { ids: [code] });
  return { status: 201, body: { ok: true, data: doc } };
}
