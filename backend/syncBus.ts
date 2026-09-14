/**
 * Bus đồng bộ đa máy — RAM + Redis pub/sub (nếu có).
 */
import { EventEmitter } from "events";
import { redisPublishChange, redisInvalidateCollection, redisInvalidateShopCache } from "./redis.js";

export type SyncChangePayload = {
  collections: string[];
  at: number;
  source?: string;
  ids?: string[];
};

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
    const payload: SyncChangePayload = {
      collections: [...new Set(list)],
      at: Date.now(),
      source,
      ...(ids.length ? { ids } : {}),
    };
    this.emit("change", payload);
    void Promise.all(
      payload.collections.map((c) => redisInvalidateCollection(c))
    ).then(async () => {
      if (payload.collections.some((c) => c === "aloha_products" || c.includes("product"))) {
        const targetMa = payload.ids?.[0];
        await redisInvalidateShopCache(targetMa);
      }
      await redisPublishChange(payload.collections, source, { ids });
    });
  }
}

export const syncBus = new SyncBus();
