import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Db } from "mongodb";
import { SHOP_ORDERS, newShopOrderCode, type ShopOrderDetail } from "./models.js";
import { createShopStockHolds, releaseShopStockHolds } from "./stockHold.js";
import { syncBus } from "../syncBus.js";
import {
  redisAcquireLock,
  redisReleaseLock,
  redisRenewLock,
} from "../redis.js";

export const BACKORDER_TERMS_VERSION = "2026-09-23";

const CHECKOUT_LOCK_KEY = "aloha:lock:checkout";

/** Fallback khi không có Redis (local): khóa trong process — cùng semantics TTL. */
const memoryLocks = new Map<string, { owner: string; expiresAt: number }>();

function memoryAcquire(key: string, owner: string, ttlMs: number): boolean {
  const now = Date.now();
  const cur = memoryLocks.get(key);
  if (cur && cur.expiresAt > now && cur.owner !== owner) return false;
  memoryLocks.set(key, { owner, expiresAt: now + ttlMs });
  return true;
}

function memoryRenew(key: string, owner: string, ttlMs: number): boolean {
  const cur = memoryLocks.get(key);
  if (!cur || cur.owner !== owner) return false;
  if (cur.expiresAt <= Date.now()) {
    memoryLocks.delete(key);
    return false;
  }
  cur.expiresAt = Date.now() + ttlMs;
  return true;
}

function memoryRelease(key: string, owner: string): void {
  const cur = memoryLocks.get(key);
  if (cur?.owner === owner) memoryLocks.delete(key);
}

async function acquireCheckoutLock(
  owner: string,
  ttlMs: number,
  maxWaitMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const redis = await redisAcquireLock(CHECKOUT_LOCK_KEY, owner, ttlMs);
    if (redis === true) return true;
    if (redis === null && memoryAcquire(CHECKOUT_LOCK_KEY, owner, ttlMs)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 80)));
  }
  const redis = await redisAcquireLock(CHECKOUT_LOCK_KEY, owner, ttlMs);
  if (redis === true) return true;
  if (redis === null) return memoryAcquire(CHECKOUT_LOCK_KEY, owner, ttlMs);
  return false;
}

async function renewCheckoutLock(owner: string, ttlMs: number): Promise<void> {
  const redis = await redisRenewLock(CHECKOUT_LOCK_KEY, owner, ttlMs);
  if (redis === null) memoryRenew(CHECKOUT_LOCK_KEY, owner, ttlMs);
}

async function releaseCheckoutLockOwned(owner: string): Promise<void> {
  const redis = await redisReleaseLock(CHECKOUT_LOCK_KEY, owner);
  if (redis === null) memoryRelease(CHECKOUT_LOCK_KEY, owner);
}

/**
 * Lock nguyên tử (Redis SET NX PX; fallback memory khi không có REDIS_URL).
 * Lease ngắn — giải phóng sau kiểm tra tồn / soft-hold, không giữ qua gọi KiotViet.
 */
export async function withCheckoutLock<T>(
  _getDb: () => Promise<Db>,
  fn: () => Promise<T>,
  opts?: { maxWaitMs?: number; leaseMs?: number }
): Promise<T> {
  const owner = randomUUID();
  const leaseMs = opts?.leaseMs || 10_000;
  const maxWaitMs = opts?.maxWaitMs || 4_000;
  const ok = await acquireCheckoutLock(owner, leaseMs, maxWaitMs);
  if (!ok) {
    const err: any = new Error("Shop đang cập nhật tồn kho. Vui lòng thử lại sau ít giây.");
    err.code = "checkout_busy";
    err.status = 409;
    throw err;
  }
  try {
    return await fn();
  } finally {
    await releaseCheckoutLockOwned(owner);
  }
}

/** Serialize stock check + reservation across API workers, including ordinary orders. */
export function serializeShopCheckout(_getDb: () => Promise<Db>): RequestHandler {
  return async (_req, res, next) => {
    const owner = randomUUID();
    const leaseMs = 15_000;
    try {
      const acquired = await acquireCheckoutLock(owner, leaseMs, 3_000);
      if (!acquired) {
        res.setHeader("Retry-After", "1");
        res.status(409).json({
          error: "Shop đang cập nhật tồn kho. Vui lòng thử lại sau ít giây.",
          code: "checkout_busy",
        });
        return;
      }

      const timer = setInterval(() => {
        void renewCheckoutLock(owner, leaseMs);
      }, 5_000);
      timer.unref();

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        void releaseCheckoutLockOwned(owner);
      };
      (res as any).releaseCheckoutLock = release;
      res.once("finish", release);
      res.once("close", release);
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
