/**
 * Isolated cache for shop catalog, with generation-guarded invalidation and coalescing.
 */
import { publicReadCache } from "../../cache/readCache.js";
import { currentPriceMode } from "../../shopWholesale/priceContext.js";

export const TTL_SEC = Number(process.env.SHOP_CATALOG_TTL_SEC || 300); // 5 phút (fallback tự hết hạn kể cả khi lỡ event)

/** Singleflight / Request coalescing cho cachedJson để triệt tiêu cache stampede khi cache miss */

export async function cachedJson(
  key: string,
  producer: () => Promise<unknown>,
  ttlSec: number = TTL_SEC
): Promise<{ body: unknown; cache: "HIT" | "MISS" | "SKIP" | "BYPASS" }> {
  return publicReadCache.read('catalog', `${key}|pm=${currentPriceMode()}`, producer, ttlSec);
}
