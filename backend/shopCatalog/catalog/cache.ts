/**
 * Single-instance cache coalescing and JSON caching for shop catalog.
 * INVARIANT: inflightProducers must only be instantiated once in this module.
 */
import {
  redisGet,
  redisSet,
  redisReady,
  memoryCacheGet,
  memoryCacheSet,
} from "../../redis.js";
import { currentPriceMode } from "../../shopWholesale/priceContext.js";

export const TTL_SEC = Number(process.env.SHOP_CATALOG_TTL_SEC || 300); // 5 phút (fallback tự hết hạn kể cả khi lỡ event)

/** Singleflight / Request coalescing cho cachedJson để triệt tiêu cache stampede khi cache miss */
export const inflightProducers = new Map<string, Promise<unknown>>();

export async function cachedJson(
  key: string,
  producer: () => Promise<unknown>,
  ttlSec: number = TTL_SEC
): Promise<{ body: unknown; cache: "HIT" | "MISS" | "SKIP" | "BYPASS" }> {
  key += `|pm=${currentPriceMode()}`;
  if (ttlSec <= 0) {
    return { body: await producer(), cache: "BYPASS" };
  }
  const ok = await redisReady();
  if (ok) {
    const hit = await redisGet(key);
    if (hit) {
      try {
        return { body: JSON.parse(hit), cache: "HIT" };
      } catch {
        /* fall through */
      }
    }
  } else {
    // RAM Memory Cache Fallback khi Redis không khả dụng
    const memHit = memoryCacheGet(key);
    if (memHit) {
      try {
        return { body: JSON.parse(memHit), cache: "HIT" };
      } catch {
        /* fall through */
      }
    }
  }

  // Request coalescing: Nếu đang có request cùng key chạy producer, các request đến sau chờ chung 1 Promise
  let p = inflightProducers.get(key);
  if (!p) {
    p = (async () => {
      try {
        const res = await producer();
        const strVal = JSON.stringify(res);
        if (ok) {
          await redisSet(key, strVal, ttlSec);
        } else {
          memoryCacheSet(key, strVal, ttlSec);
        }
        return res;
      } finally {
        inflightProducers.delete(key);
      }
    })();
    inflightProducers.set(key, p);
  }

  const body = await p;
  return { body, cache: "MISS" };
}
