const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });
async function main() {
  const { publicReadCache } = await import('../backend/cache/readCache.ts');
  const { updateGiftAdmin } = await import('../backend/shopGifts/giftRepo.ts');
  const base = 'http://127.0.0.1:3001';
  const get = async path => {
    const r = await fetch(base + path);
    assert.equal(r.status, 200, path);
    return { body: await r.json(), cache: r.headers.get('x-shop-cache') };
  };
  await publicReadCache.invalidate('appearance');
  const first = await get('/api/shop/appearance'), second = await get('/api/shop/appearance');
  assert.equal(first.cache, 'MISS'); assert.equal(second.cache, 'HIT');
  assert.deepEqual(first.body, second.body);
  assert.ok(!('draft' in second.body) && !('history' in second.body));
  const fakeDb = { collection: () => ({ updateOne: async () => ({ matchedCount: 1 }) }) };
  // Exercise the real write hook against a fake DB; production Mongo is never mutated.
  await updateGiftAdmin(fakeDb, 'nguoi-thuong', {});
  const gifts = await get('/api/shop/gifts'), giftsAgain = await get('/api/shop/gifts');
  assert.equal(gifts.cache, 'MISS'); assert.equal(giftsAgain.cache, 'HIT');
  assert.deepEqual(gifts.body, giftsAgain.body);
  const detail = await get('/api/shop/gifts/nguoi-thuong');
  assert.equal(detail.cache, 'HIT'); assert.ok(Array.isArray(detail.body.data.products));
  let reads = 0;
  await publicReadCache.invalidate('verification');
  await publicReadCache.read('verification', 'ttl', async () => ++reads, 2);
  await publicReadCache.read('verification', 'ttl', async () => ++reads, 2);
  assert.equal(reads, 1);
  await new Promise(r => setTimeout(r, 2300));
  await publicReadCache.read('verification', 'ttl', async () => ++reads, 2);
  assert.equal(reads, 2);
  assert.equal((await fetch(base + '/api/shop/cache/metrics')).status, 401);
  const secret = process.env.CACHE_METRICS_TOKEN || process.env.INTERNAL_SYNC_SECRET;
  if (secret) {
    const r = await fetch(base + '/api/shop/cache/metrics', { headers: { 'x-internal-key': secret } });
    assert.equal(r.status, 200);
    console.log(JSON.stringify({ metrics: (await r.json()).groups }));
  }
  console.log('SMOKE_OK: real Redis HIT, invalidation, TTL, public-only payload, live gift products, protected metrics; Mongo unchanged');
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
