/**
 * Redis trên VPS (localhost) — đệm + pub/sub.
 * Mất Redis → mọi hàm trả null/false, app vẫn chạy bằng Mongo.
 */
import { createClient, type RedisClientType } from "redis";

/** Chỉ nối Redis khi .env có REDIS_URL. Máy local không đặt → không thử 6379 (tránh spam ECONNREFUSED / lag). */
const REDIS_URL = (process.env.REDIS_URL || "").trim();
const CHANNEL = "aloha:change";

let client: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let ready = false;
let skipped = !REDIS_URL;
let connecting: Promise<boolean> | null = null;
let loggedSkip = false;

async function connectMain(): Promise<boolean> {
  if (skipped) {
    if (!loggedSkip) {
      loggedSkip = true;
      console.log("[redis] bỏ qua (không có REDIS_URL) — dùng Mongo");
    }
    return false;
  }
  if (ready && client?.isOpen) return true;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      client = createClient({
        url: REDIS_URL,
        socket: { reconnectStrategy: false },
      });
      client.on("error", (e) => {
        console.warn("[redis]", (e as Error)?.message || e);
        ready = false;
        skipped = true;
      });
      await client.connect();
      ready = true;
      console.log("[redis] connected", REDIS_URL.replace(/\/\/.*@/, "//***@"));
      return true;
    } catch (e) {
      console.warn("[redis] unavailable — fallback Mongo only:", (e as Error)?.message || e);
      ready = false;
      skipped = true;
      client = null;
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function redisReady(): Promise<boolean> {
  return connectMain();
}

export function isRedisReady(): boolean {
  return ready && !!client?.isOpen;
}

export async function redisGet(key: string): Promise<string | null> {
  if (!(await connectMain()) || !client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSec = 60
): Promise<boolean> {
  if (!(await connectMain()) || !client) return false;
  try {
    await client.set(key, value, { EX: Math.max(5, ttlSec) });
    return true;
  } catch {
    return false;
  }
}

export async function redisDel(...keys: string[]): Promise<void> {
  if (!(await connectMain()) || !client || !keys.length) return;
  try {
    await client.del(keys);
  } catch {
    /* ignore */
  }
}

/** Xóa mọi key cache theo prefix collection (SCAN nhẹ). */
export async function redisInvalidateCollection(coll: string): Promise<void> {
  if (!(await connectMain()) || !client) return;
  const prefix = `aloha:cache:${coll}:`;
  try {
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 50 })) {
      await client.del(key);
    }
    await client.incr(`aloha:rev:${coll}`);
  } catch {
    /* ignore */
  }
}

export async function redisPublishChange(
  collections: string[],
  source?: string,
  extra?: { ids?: string[] }
): Promise<void> {
  if (!(await connectMain()) || !client) return;
  try {
    const ids = (extra?.ids || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 200);
    const payload = JSON.stringify({
      collections,
      at: Date.now(),
      source: source || "api",
      ...(ids.length ? { ids } : {}),
    });
    await client.publish(CHANNEL, payload);
  } catch {
    /* ignore */
  }
}

type ChangeHandler = (payload: {
  collections: string[];
  at: number;
  source?: string;
  ids?: string[];
}) => void;

const handlers = new Set<ChangeHandler>();

/** Subscribe pub/sub một lần; gọi handler mỗi tin. */
export async function redisSubscribeChanges(handler: ChangeHandler): Promise<() => void> {
  handlers.add(handler);
  if (!subClient) {
    try {
      if (!(await connectMain()) || !client) {
        handlers.delete(handler);
        return () => handlers.delete(handler);
      }
      subClient = client.duplicate();
      subClient.on("error", (e) => {
        console.warn("[redis-sub]", (e as Error)?.message || e);
      });
      await subClient.connect();
      await subClient.subscribe(CHANNEL, (message) => {
        try {
          const data = JSON.parse(message) as {
            collections?: string[];
            at?: number;
            source?: string;
            ids?: string[];
          };
          const payload = {
            collections: Array.isArray(data.collections) ? data.collections : [],
            at: data.at || Date.now(),
            source: data.source,
            ...(Array.isArray(data.ids) && data.ids.length ? { ids: data.ids } : {}),
          };
          for (const h of handlers) {
            try {
              h(payload);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      });
      console.log("[redis] subscribed", CHANNEL);
    } catch (e) {
      console.warn("[redis] subscribe failed:", (e as Error)?.message || e);
      subClient = null;
    }
  }
  return () => {
    handlers.delete(handler);
  };
}

export function cacheKeyForCollection(coll: string, query = ""): string {
  return `aloha:cache:${coll}:${query || "all"}`;
}

/** Bộ nhớ đệm RAM dự phòng nhẹ khi Redis offline hoặc chạy local không bật Redis */
type MemoryCacheEntry = { value: string; expiresAt: number };
const memoryCache = new Map<string, MemoryCacheEntry>();

export function memoryCacheGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function memoryCacheSet(key: string, value: string, ttlSec = 60): void {
  if (memoryCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of memoryCache) {
      if (v.expiresAt <= now) memoryCache.delete(k);
    }
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export function memoryCacheClear(pattern = "shop:"): void {
  for (const k of memoryCache.keys()) {
    if (k.startsWith(pattern) || k.includes(pattern)) {
      memoryCache.delete(k);
    }
  }
}

/** Xóa cache web bán (Cấp độ 1: Danh sách sản phẩm + chi tiết sản phẩm cụ thể nếu có). */
export async function redisInvalidateShopCache(targetMa?: string): Promise<void> {
  // 1. Luôn xóa bộ nhớ đệm RAM cho danh sách sản phẩm
  memoryCacheClear("shop:products:");
  if (targetMa) {
    const norm = String(targetMa).trim().toLowerCase();
    memoryCacheClear(`shop:product:${norm}`);
  }

  // 2. Xóa trên Redis (nếu có kết nối)
  if (!(await connectMain()) || !client) return;
  try {
    // Xóa toàn bộ key danh sách catalog sản phẩm
    for await (const key of client.scanIterator({ MATCH: "shop:products:*", COUNT: 80 })) {
      await client.del(key);
    }
    // Nếu có mã sản phẩm cụ thể, xóa thêm key liên quan sản phẩm đó
    if (targetMa) {
      const norm = String(targetMa).trim().toLowerCase();
      for await (const key of client.scanIterator({ MATCH: `shop:product:*${norm}*`, COUNT: 80 })) {
        await client.del(key);
      }
    }
  } catch {
    /* ignore */
  }
}
