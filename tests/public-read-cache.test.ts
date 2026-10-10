import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache, type CacheStore } from '../backend/cache/readCache.js';

function fixture() {
  const epochs = new Map<string, string>();
  const values = new Map<string, string>();
  const ttls: number[] = [];
  let revision = 0;
  const store: CacheStore = {
    async generation(domain) { if (!epochs.has(domain)) epochs.set(domain, String(++revision)); return epochs.get(domain)!; },
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, ttl, domain, epoch) { if (epochs.get(domain) !== epoch) return false; values.set(key, value); ttls.push(ttl); return true; },
    async invalidate(domain) { epochs.set(domain, String(++revision)); return true; },
  };
  return { store, cache: createReadCache(store), values, epochs, ttls };
}

test('cache hit avoids database reads and separates query scopes', async () => {
  const { cache, ttls } = fixture(); let reads = 0;
  const producer = async () => ({ version: ++reads });
  assert.equal((await cache.read('gifts', 'public', producer)).cache, 'MISS');
  assert.equal((await cache.read('gifts', 'public', producer)).cache, 'HIT');
  assert.equal(reads, 1);
  await cache.read('gifts', 'other', producer);
  await cache.read('appearance', 'public', producer);
  assert.equal(reads, 3);
  assert.ok(ttls.every(ttl => ttl >= 54 && ttl <= 60));
});
test('coalesces concurrent requests, does not cache errors, and releases failed fills', async () => {
  const { cache } = fixture(); let reads = 0;
  const producer = async () => { reads++; await new Promise(r => setTimeout(r, 10)); return ['gift']; };
  await Promise.all(Array.from({ length: 20 }, () => cache.read('gifts', 'active', producer)));
  assert.equal(reads, 1);
  await assert.rejects(cache.read('gifts', 'broken', async () => { throw Error('mongo failure'); }));
  assert.deepEqual((await cache.read('gifts', 'broken', producer)).body, ['gift']);
});
test('invalidation rejects a late fill and readers do not join an obsolete request', async () => {
  const { cache } = fixture(); let release!: () => void; let entered!: () => void;
  const started = new Promise<void>(r => { entered = r; });
  const held = new Promise<void>(r => { release = r; });
  const old = cache.read('appearance', 'published', async () => { entered(); await held; return 'old'; });
  await started;
  await cache.invalidate('appearance');
  assert.equal((await cache.read('appearance', 'published', async () => 'new')).body, 'new');
  release(); await old;
  assert.equal((await cache.read('appearance', 'published', async () => 'wrong')).body, 'new');
});
test('another process invalidating during a fill is protected by the shared generation', async () => {
  const { cache, store } = fixture(); const other = createReadCache(store);
  await cache.read('gifts', 'active', async () => { await other.invalidate('gifts'); return 'old'; });
  assert.equal((await other.read('gifts', 'active', async () => 'new')).body, 'new');
});
test('evicted generation keys cannot resurrect old cached responses', async () => {
  const { cache, epochs } = fixture();
  await cache.read('gifts', 'active', async () => 'old'); epochs.delete('gifts');
  assert.equal((await cache.read('gifts', 'active', async () => 'new')).body, 'new');
});
test('Redis outage bypasses cache; failed invalidation does not serve stale data after recovery', async () => {
  const { cache, store } = fixture();
  await cache.read('gifts', 'active', async () => 'old');
  const original = store.generation; store.generation = async () => null;
  assert.equal((await cache.read('gifts', 'active', async () => 'fresh')).cache, 'BYPASS');
  store.invalidate = async () => false; await cache.invalidate('gifts'); store.generation = original;
  assert.equal((await cache.read('gifts', 'active', async () => 'fresh')).body, 'fresh');
});
test('oversized results and explicit bypass never enter Redis', async () => {
  const { cache, values } = fixture();
  await cache.read('gifts', 'big', async () => 'x'.repeat(2_000_001));
  await cache.read('gifts', 'disabled', async () => 'private', 0);
  assert.equal(values.size, 0);
});

test('two API processes share a fill lock instead of duplicating a fast DB read', async () => {
  const { store } = fixture(); const locks = new Map<string, string>();
  store.lock = async (key, owner) => { if (locks.has(key)) return false; locks.set(key, owner); return true; };
  store.unlock = async (key, owner) => { if (locks.get(key) === owner) locks.delete(key); };
  const one = createReadCache(store), two = createReadCache(store); let reads = 0;
  const producer = async () => { reads++; await new Promise(r => setTimeout(r, 30)); return 'published'; };
  const results = await Promise.all([one.read('appearance', 'published', producer), two.read('appearance', 'published', producer)]);
  assert.equal(reads, 1); assert.ok(results.every(r => r.body === 'published')); assert.equal(locks.size, 0);
});
