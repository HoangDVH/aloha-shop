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
let subConnecting: Promise<void> | null = null;

/** Backoff reconnect strategy (1s -> 2s -> 4s -> max 10s) */
const reconnectStrategy = (retries: number) => {
  const delay = Math.min(10000, 1000 * Math.pow(1.5, Math.min(retries, 10)));
  return delay;
};

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
      if (client?.isOpen) {
        ready = true;
        return true;
      }
      if (!client) {
        client = createClient({
          url: REDIS_URL,
          socket: { reconnectStrategy },
        });
        client.on("error", (e) => {
          console.warn("[redis]", (e as Error)?.message || e);
          ready = false;
        });
        client.on("ready", () => {
          ready = true;
          console.log("[redis] connection ready");
          void ensureSubClient();
        });
        client.on("reconnecting", () => {
          ready = false;
          console.warn("[redis] reconnecting...");
        });
      }
      if (!client.isOpen) {
        await client.connect();
      }
      ready = true;
      console.log("[redis] connected", REDIS_URL.replace(/\/\/.*@/, "//***@"));
      void ensureSubClient();
      return true;
    } catch (e) {
      console.warn("[redis] unavailable — fallback Mongo/RAM cache:", (e as Error)?.message || e);
      ready = false;
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

async function ensureSubClient(): Promise<void> {
  if (skipped || !handlers.size) return;
  if (subClient?.isOpen) return;
  if (subConnecting) return subConnecting;

  subConnecting = (async () => {
    try {
      if (!client || !client.isOpen) return;
      if (!subClient) {
        subClient = client.duplicate();
        subClient.on("error", (e) => {
          console.warn("[redis-sub]", (e as Error)?.message || e);
        });
        subClient.on("ready", () => {
          console.log("[redis-sub] subscription ready");
        });
      }
      if (!subClient.isOpen) {
        await subClient.connect();
      }
      await subClient.subscribe(CHANNEL, (message) => {
        try {
          const data = JSON.parse(message) as {
            collections?: string[];
            at?: number;
            source?: string;
            ids?: string[];
            origin?: string;
            eventId?: string;
          };
          const payload = {
            collections: Array.isArray(data.collections) ? data.collections : [],
            at: data.at || Date.now(),
            source: data.source,
            origin: data.origin,
            eventId: data.eventId,
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
    } finally {
      subConnecting = null;
    }
  })();
  return subConnecting;
}

export async function redisPublishChange(
  collections: string[],
  source?: string,
  extra?: { ids?: string[]; origin?: string; eventId?: string }
): Promise<void> {
  if (!(await connectMain()) || !client) return;
  try {
    const ids = (extra?.ids || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 200);
    const payload = JSON.stringify({
      collections,
      at: Date.now(),
      source: source || "api",
      origin: extra?.origin,
      eventId: extra?.eventId,
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
  origin?: string;
  eventId?: string;
}) => void;

const handlers = new Set<ChangeHandler>();

/** Subscribe pub/sub một lần; gọi handler mỗi tin; tự động phục hồi khi redis reconnect. */
export async function redisSubscribeChanges(handler: ChangeHandler): Promise<() => void> {
  handlers.add(handler);
  void ensureSubClient();
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
  // 1. Luôn xóa bộ nhớ đệm RAM cho danh sách sản phẩm + cây nhóm
  memoryCacheClear("shop:products:");
  memoryCacheClear("shop:category-tree");
  memoryCacheClear("shop:categories");
  if (targetMa) {
    const norm = String(targetMa).trim().toLowerCase();
    memoryCacheClear(`shop:product:${norm}`);
  }

  // 2. Xóa trên Redis (nếu có kết nối)
  if (!(await connectMain()) || !client) return;
  try {
    // Xóa toàn bộ key danh sách catalog sản phẩm + category tree
    for (const match of [
      "shop:products:*",
      "shop:category-tree*",
      "shop:categories*",
    ]) {
      for await (const key of client.scanIterator({ MATCH: match, COUNT: 80 })) {
        await client.del(key);
      }
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
