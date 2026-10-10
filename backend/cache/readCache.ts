import { createHash, randomUUID } from 'node:crypto';
import { cacheCommand } from './transport.js';

export type CacheResult<T> = { body: T; cache: 'HIT' | 'MISS' | 'BYPASS' };
export interface CacheStore {
  generation(domain: string): Promise<string | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttl: number, domain: string, generation: string): Promise<boolean>;
  invalidate(domain: string): Promise<boolean>;
  lock?(key: string, owner: string): Promise<boolean | null>;
  unlock?(key: string, owner: string): Promise<void>;
}

const namespace = `shop-cache:v1:${process.env.SHOP_STANDALONE_DB || 'aloha_shop_db'}`;
const epochKey = (domain: string) => `${namespace}:epoch:${domain}`;
export const redisCacheStore: CacheStore = {
  async generation(domain) {
    const key = epochKey(domain);
    // Epoch keys may be evicted: a new UUID must never reuse an old cache generation.
    return cacheCommand(async c => {
      await c.set(key, randomUUID(), { NX: true });
      return c.get(key);
    });
  },
  get: key => cacheCommand(c => c.get(key)),
  async put(key, value, ttl, domain, generation) {
    const result = await cacheCommand(c => c.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3]); return 1 end; return 0',
      { keys: [epochKey(domain), key], arguments: [generation, value, String(ttl)] },
    ));
    return result === 1;
  },
  async invalidate(domain) {
    return await cacheCommand(c => c.set(epochKey(domain), randomUUID())) === 'OK';
  },
  async lock(key, owner) {
    const result = await cacheCommand(c => c.set(`${key}:fill`, owner, { NX: true, PX: 3000 }));
    return result === null ? false : result === 'OK';
  },
  async unlock(key, owner) {
    await cacheCommand(c => c.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end; return 0', {
      keys: [`${key}:fill`], arguments: [owner],
    }));
  },
};

type Metric = { hit: number; miss: number; bypass: number; coalesced: number; producerMs: number };
export function createReadCache(store: CacheStore) {
  const inflight = new Map<string, Promise<unknown>>();
  const metrics = new Map<string, Metric>();
  const localEpoch = new Map<string, number>();
  const blockedUntil = new Map<string, number>();
  const metric = (domain: string) => {
    if (!metrics.has(domain)) metrics.set(domain, { hit: 0, miss: 0, bypass: 0, coalesced: 0, producerMs: 0 });
    return metrics.get(domain)!;
  };
  return {
    async read<T>(domain: string, query: string, producer: () => Promise<T>, ttl = 60): Promise<CacheResult<T>> {
      const stats = metric(domain);
      const epoch = localEpoch.get(domain) || 0;
      const generation = ttl > 0 && Date.now() >= (blockedUntil.get(domain) || 0) ? await store.generation(domain) : null;
      if (!generation) { stats.bypass++; return { body: await producer(), cache: 'BYPASS' }; }
      const digest = createHash('sha256').update(query).digest('hex');
      const key = `${namespace}:data:${domain}:${generation}:${digest}`;
      const hit = await store.get(key);
      if (hit !== null) {
        try { const body = JSON.parse(hit) as T; stats.hit++; return { body, cache: 'HIT' }; } catch { /* rebuild corrupted data */ }
      }
      stats.miss++;
      const flightKey = `${key}:${epoch}`;
      let pending = inflight.get(flightKey) as Promise<T> | undefined;
      if (pending) stats.coalesced++;
      else {
        pending = (async () => {
          const started = Date.now();
          const owner = randomUUID();
          const ownsLock = store.lock ? await store.lock(key, owner) : true;
          try {
            if (ownsLock === false) {
              const deadline = Date.now() + 150;
              while (Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 20));
                const filled = await store.get(key);
                if (filled !== null) {
                  try { return JSON.parse(filled) as T; } catch { break; }
                }
              }
            }
            const body = await producer();
            stats.producerMs += Date.now() - started;
            const value = JSON.stringify(body);
            // Never cache oversized data, undefined values, or fills from before an invalidation.
            if (ownsLock !== false && value !== undefined && Buffer.byteLength(value) <= 2_000_000 && epoch === (localEpoch.get(domain) || 0)) {
              const jitteredTtl = Math.max(1, Math.floor(ttl * (0.9 + Math.random() * 0.1)));
              await store.put(key, value, jitteredTtl, domain, generation);
            }
            return body;
          } finally {
            inflight.delete(flightKey);
            if (ownsLock === true) await store.unlock?.(key, owner);
          }
        })();
        if (inflight.size < 512) inflight.set(flightKey, pending);
      }
      return { body: await pending, cache: 'MISS' };
    },
    async invalidate(domain: string) {
      localEpoch.set(domain, (localEpoch.get(domain) || 0) + 1);
      if (!await store.invalidate(domain)) {
        // This process must not reuse stale entries if invalidation happens during an outage.
        blockedUntil.set(domain, Date.now() + 600_000);
      } else blockedUntil.delete(domain);
    },
    metrics: () => Object.fromEntries([...metrics].map(([key, value]) => [key, { ...value }])),
  };
}

export const publicReadCache = createReadCache(redisCacheStore);
