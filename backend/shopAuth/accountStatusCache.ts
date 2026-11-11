import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "./models.js";

const cache = new Map<string, { value: string | null; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

/**
 * Coalesces concurrent SSE account-change lookups for the same sync eventId and
 * projects only ctvStatus to avoid N full-document Mongo reads across tabs.
 */
export async function getCoalescedShopCtvStatus(
  getShopDb: () => Promise<Db>,
  userId: string,
  eventId?: string,
): Promise<string | null> {
  const key = eventId ? `${userId}:${eventId}` : userId;
  const now = Date.now();
  if (eventId) {
    const hit = cache.get(key);
    if (hit && hit.exp > now) return hit.value;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const req = (async () => {
    try {
      const db = await getShopDb();
      const user = await db.collection(SHOP_ACCOUNTS).findOne(
        shopAccountIdQuery(userId),
        { projection: { _id: 0, ctvStatus: 1 } },
      );
      const value = (user?.ctvStatus as string | null | undefined) ?? null;
      if (eventId) {
        if (cache.size > 300) cache.clear();
        cache.set(key, { value, exp: Date.now() + 5000 });
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, req);
  return req;
}
