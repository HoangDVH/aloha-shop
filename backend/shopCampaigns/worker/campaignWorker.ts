import crypto from "node:crypto";
import type { Db } from "mongodb";
import { redisAcquireLock, redisReleaseLock } from "../../redis.js";
import { expireUnpaidShopOrders } from "../../shopOrders/markPaid.js";
import { applyDueSchedules } from "../campaignRepo.js";
import { campaignWorkerEnabled, flashSaleEnabled } from "../flags.js";
import { FLASH_COUNTERS_COL } from "../types.js";
import { reconcileFlashCounters, settleOrphanHolds } from "./reconcileCounters.js";
import { saveReconcileReport } from "../admin/opsService.js";
import { resumeHoldOperations } from "../flash/settleOperation.js";

const LOCK_KEY = "aloha:lock:shop-campaign-worker";
/** Khoá dự phòng khi Redis tắt: 1 document trong chính collection bộ đếm. */
const MONGO_LOCK_ID = "lock:shop-campaign-worker";
const TICK_MS = 30_000;
const LOCK_TTL_MS = 25_000;

let timer: ReturnType<typeof setInterval> | null = null;

async function acquireMongoLock(db: Db, owner: string, nowMs: number): Promise<boolean> {
  try {
    await db.collection(FLASH_COUNTERS_COL).updateOne(
      { _id: MONGO_LOCK_ID as any, $or: [{ expiresAt: { $lt: nowMs } }, { owner }] },
      { $set: { kind: "lock", owner, expiresAt: nowMs + LOCK_TTL_MS } },
      { upsert: true }
    );
    return true;
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
}

async function releaseMongoLock(db: Db, owner: string): Promise<void> {
  await db.collection(FLASH_COUNTERS_COL).deleteOne({ _id: MONGO_LOCK_ID as any, owner });
}

/**
 * Chạy `fn` khi giữ được khoá: Redis nếu có, không thì khoá Mongo (upsert có điều kiện,
 * trùng `_id` = tiến trình khác đang giữ). Nhiều tiến trình cùng chạy chỉ 1 nơi xử lý.
 */
export async function withWorkerLock<T>(db: Db, fn: () => Promise<T>, nowMs = Date.now()): Promise<T | null> {
  const owner = crypto.randomUUID();
  const redis = await redisAcquireLock(LOCK_KEY, owner, LOCK_TTL_MS);
  if (redis === false) return null;
  const viaMongo = redis === null;
  if (viaMongo && !(await acquireMongoLock(db, owner, nowMs))) return null;
  try {
    return await fn();
  } finally {
    if (viaMongo) await releaseMongoLock(db, owner).catch(() => undefined);
    else await redisReleaseLock(LOCK_KEY, owner).catch(() => null);
  }
}

/** Một lượt: hẹn giờ áp dụng → hết hạn đơn CK → nhả suất treo → đối soát bộ đếm. */
export async function runCampaignWorkerTick(shopDb: Db, mainDb: Db | undefined, nowMs = Date.now()) {
  const applied = await applyDueSchedules(shopDb, nowMs);
  const expired = await expireUnpaidShopOrders(shopDb, mainDb);
  const resumed = await resumeHoldOperations(shopDb, nowMs);
  const orphans = await settleOrphanHolds(shopDb);
  const counters = await reconcileFlashCounters(shopDb, { nowMs, fix: true });
  await saveReconcileReport(shopDb, { at: new Date(nowMs).toISOString(), ...counters, source: "worker" });
  return { applied: applied.length, expired, resumed, ...orphans, fixed: counters.fixed };
}

export function startCampaignWorker(getShopDb: () => Promise<Db>, getMainDb: () => Promise<Db>): void {
  if (timer) return;
  if (!campaignWorkerEnabled()) {
    console.warn(
      "[campaign-worker] ĐANG TẮT (SHOP_CAMPAIGN_WORKER=0) — suất treo không được nhả tự động;" +
        (process.env.NODE_ENV === "production" ? " giá flash bị khoá trên production." : " chỉ dùng khi dev.")
    );
    return;
  }
  // Vẫn chạy khi tắt cờ chiến dịch: đơn cũ còn giữ suất phải được nhả / chốt đúng.
  const tick = () => {
    void (async () => {
      const shopDb = await getShopDb();
      const mainDb = await getMainDb().catch(() => undefined);
      return withWorkerLock(shopDb, () => runCampaignWorkerTick(shopDb, mainDb));
    })()
      .then((r) => {
        if (r && (r.applied || r.expired || r.resumed || r.released || r.sold || r.fixed)) console.log("[campaign-worker]", r);
      })
      .catch((e) => console.warn("[campaign-worker] tick lỗi, lượt sau thử lại:", e?.message || e));
  };
  setTimeout(tick, 10_000);
  timer = setInterval(tick, TICK_MS);
  console.log(`[campaign-worker] Bật — mỗi ${TICK_MS / 1000}s; flash ${flashSaleEnabled() ? "bật" : "tắt"}`);
}

export function stopCampaignWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
