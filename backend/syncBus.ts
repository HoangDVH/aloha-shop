/**
 * Bus đồng bộ đa máy — RAM + Redis pub/sub (nếu có).
 */
import { EventEmitter } from "events";
import { randomUUID } from "node:crypto";
import { redisPublishChange, redisInvalidateCollection, redisInvalidateShopCache } from "./redis.js";

export type SyncChangePayload = {
  collections: string[];
  at: number;
  source?: string;
  ids?: string[];
  origin?: string;
  eventId?: string;
};

export const PROCESS_ID = randomUUID();

// Lọc trùng lặp event ID trong 60 giây
const seenEvents = new Map<string, number>();
function isDuplicateEvent(eventId?: string): boolean {
  if (!eventId) return false;
  const now = Date.now();
  // Dọn dẹp cache event cũ > 60s
  if (seenEvents.size > 2000) {
    for (const [id, ts] of seenEvents) {
      if (now - ts > 60_000) seenEvents.delete(id);
    }
  }
  if (seenEvents.has(eventId)) return true;
  seenEvents.set(eventId, now);
  return false;
}

class SyncBus extends EventEmitter {
  publish(collections: string | string[], source?: string, extra?: { ids?: string[] }) {
    const list = (Array.isArray(collections) ? collections : [collections])
      .map((c) => String(c || "").trim())
      .filter(Boolean);
    if (!list.length) return;
    const ids = (extra?.ids || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 200);
    const eventId = randomUUID();
    isDuplicateEvent(eventId);

    const payload: SyncChangePayload = {
      collections: [...new Set(list)],
      at: Date.now(),
      source,
      origin: PROCESS_ID,
      eventId,
      ...(ids.length ? { ids } : {}),
    };

    // Phát local cho process hiện tại
    this.emit("change", payload);

    void Promise.all(
      payload.collections.map((c) => redisInvalidateCollection(c))
    ).then(async () => {
      if (payload.collections.some((c) => c === "aloha_products" || c.includes("product"))) {
        const targetMa = payload.ids?.[0];
        await redisInvalidateShopCache(targetMa);
      }
      await redisPublishChange(payload.collections, source, {
        ids,
        origin: PROCESS_ID,
        eventId,
      });
    });
  }

  /** Xử lý event nhận từ Redis: bỏ qua nếu là chính process này phát ra hoặc event đã xử lý */
  handleRemoteChange(payload: SyncChangePayload) {
    if (payload.origin === PROCESS_ID) return; // Loại bỏ echo
    if (payload.eventId && isDuplicateEvent(payload.eventId)) return; // Dedupe
    this.emit("change", payload);
  }
}

export const syncBus = new SyncBus();
