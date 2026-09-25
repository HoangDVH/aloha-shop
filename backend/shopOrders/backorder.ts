import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Db } from "mongodb";
import { SHOP_ORDERS, newShopOrderCode, type ShopOrderDetail } from "./models.js";
import { createShopStockHolds, releaseShopStockHolds } from "./stockHold.js";
import { syncBus } from "../syncBus.js";

export const BACKORDER_TERMS_VERSION = "2026-09-23";

/**
 * Lock nguyên tử cho bước kiểm tra tồn và tạo soft-hold / insert đơn.
 * Khóa có lease ngắn hạn (mặc định 10s), tự giải phóng sau khi xong bước kiểm tra và ghi nhận đơn,
 * không giữ trong suốt quá trình gọi API bên ngoài (như KiotViet) để tránh gây nghẽn (checkout_busy) cho các khách hàng khác.
 */
export async function withCheckoutLock<T>(
  getDb: () => Promise<Db>,
  fn: () => Promise<T>,
  opts?: { maxWaitMs?: number; leaseMs?: number }
): Promise<T> {
  const db = await getDb();
  const col = db.collection<{ _id: string; owner: string; expiresAt: Date }>("aloha_shop_checkout_lock");
  const owner = randomUUID();
  const leaseMs = opts?.leaseMs || 10_000;
  const maxWaitMs = opts?.maxWaitMs || 4_000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const now = new Date();
      const res = await col.updateOne(
        { _id: "checkout", $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
        { $set: { owner, expiresAt: new Date(Date.now() + leaseMs) } },
        { upsert: true }
      );
      if (res.upsertedCount > 0 || res.modifiedCount > 0) {
        break;
      }
    } catch (error: any) {
      if (error.code !== 11000) throw error;
    }
    // Chờ một khoảng nhỏ với jitter trước khi thử lại
    const sleep = 50 + Math.floor(Math.random() * 80);
    await new Promise((r) => setTimeout(r, sleep));
  }

  // Xác nhận đã giữ khóa
  const current = await col.findOne({ _id: "checkout" });
  if (current?.owner !== owner || (current.expiresAt && current.expiresAt.getTime() <= Date.now())) {
    const err: any = new Error("Shop đang cập nhật tồn kho. Vui lòng thử lại sau ít giây.");
    err.code = "checkout_busy";
    err.status = 409;
    throw err;
  }

  try {
    return await fn();
  } finally {
    await col.deleteOne({ _id: "checkout", owner }).catch(() => {});
  }
}

/** Serialize stock check + reservation across API workers, including ordinary orders. */
export function serializeShopCheckout(getDb: () => Promise<Db>): RequestHandler {
  return async (_req, res, next) => {
    const owner = randomUUID();
    try {
      const db = await getDb();
      const col = db.collection<{ _id: string; owner: string; expiresAt: Date }>("aloha_shop_checkout_lock");
      let acquired = false;
      const start = Date.now();
      // Retry tối đa 3 giây trước khi báo busy
      while (Date.now() - start < 3000) {
        try {
          const now = new Date();
          const r = await col.updateOne(
            { _id: "checkout", $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
            { $set: { owner, expiresAt: new Date(Date.now() + 15000) } },
            { upsert: true }
          );
          if (r.upsertedCount > 0 || r.modifiedCount > 0) {
            acquired = true;
            break;
          }
        } catch (error: any) {
          if (error.code !== 11000) throw error;
        }
        await new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 60)));
      }

      if (!acquired) {
        const cur = await col.findOne({ _id: "checkout" });
        if (cur?.owner !== owner) {
          res.setHeader("Retry-After", "1");
          res.status(409).json({ error: "Shop đang cập nhật tồn kho. Vui lòng thử lại sau ít giây.", code: "checkout_busy" });
          return;
        }
      }

      const timer = setInterval(() => {
        void col.updateOne({ _id: "checkout", owner }, { $set: { expiresAt: new Date(Date.now() + 15000) } })
          .catch(() => {});
      }, 5000);
      timer.unref();

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        void col.deleteOne({ _id: "checkout", owner }).catch(() => {});
      };
      (res as any).releaseCheckoutLock = release;
      res.once("finish", release);
      res.once("close", () => {
        if (res.writableFinished) release();
        else clearInterval(timer);
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
    orderStatus: "cho_xac_nhan", status: "cho_xac_nhan", statusValue: "Chờ Aloha gửi ảnh",
    policyAcceptedAt: body.policyAccepted === true ? now.toISOString() : null,
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
