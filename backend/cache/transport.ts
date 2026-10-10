import { createClient } from 'redis';

const budgetMs = 200;
let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<boolean> | null = null;
let retryAt = 0;

function disconnect() {
  if (client?.isOpen) void client.disconnect().catch(() => {});
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('cache deadline')), budgetMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function ready(): Promise<boolean> {
  // The server loads .env after evaluating static imports; read configuration lazily.
  const url = (process.env.CACHE_REDIS_URL || '').trim();
  if (!url || process.env.SHOP_PUBLIC_CACHE_ENABLED === '0') return false;
  if (client?.isReady) return true;
  if (Date.now() < retryAt) return false;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      if (!client) {
        client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: budgetMs, reconnectStrategy: false } });
        client.on('error', () => { retryAt = Date.now() + 5000; });
      }
      if (client.isOpen) await client.disconnect();
      await bounded(client.connect());
      return client.isReady;
    } catch {
      retryAt = Date.now() + 5000;
      disconnect();
      return false;
    } finally { connecting = null; }
  })();
  return connecting;
}

/** A separate Redis instance exclusively for disposable response caches. Never uses REDIS_URL. */
export async function cacheCommand<T>(run: (redis: NonNullable<typeof client>) => Promise<T>): Promise<T | null> {
  if (!await ready() || !client) return null;
  try { return await bounded(run(client)); }
  catch {
    retryAt = Date.now() + 5000;
    disconnect();
    return null;
  }
}
