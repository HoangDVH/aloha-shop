const test = require('node:test');
const assert = require('node:assert/strict');
const kv = (ma, id, extra = {}) => ({ ma, id, source: 'kiotviet', ...extra });
test('identity sync preserves renamed products and ignores retired codes', async () => {
  const { planProductSync } = await import('../tools/thumua-product-plan.mjs');
  const destination = [kv('NEW', 1, { _id: 'one', kvCodeAliases: ['OLD'], videos: ['video'] })];
  assert.equal(planProductSync([kv('OLD', 1)], destination).length, 0);
  const [action] = planProductSync([kv('NEWER', 1)], destination);
  assert.equal(action.existing._id, 'one');
  assert.deepEqual(action.existing.videos, ['video']);
  assert.equal(destination[0].ma, 'NEW');
});
test('collisions and duplicate identities fail before writing', async () => {
  const { planProductSync } = await import('../tools/thumua-product-plan.mjs');
  assert.throws(() => planProductSync([kv('B', 1)], [kv('A', 1), kv('B', 2)]));
  assert.throws(() => planProductSync([kv('A', 2)], [kv('A', 1)]));
  assert.throws(() => planProductSync([kv('A', 1), kv('B', 1)], []));
  assert.throws(() => planProductSync([], [kv('A', 1), kv('B', 1)]));
  assert.equal(planProductSync([kv('OLD', 1)], [kv('OLD', 1, { mergedInto: 'NEW' })]).length, 0);
});
test('sync never overwrites existing video fields', async () => {
  const { readFile } = require('node:fs/promises');
  const src = await readFile('tools/sync_from_thumua_test.mjs', 'utf8');
  const fields = src.match(/const CATALOG_FIELDS = \[([\s\S]*?)\]/)[1];
  assert.ok(!fields.includes("'videos'"));
  assert.ok(!fields.includes("'videoUrl'"));
  assert.ok(src.indexOf('planProductSync(srcProducts, destProducts)') < src.indexOf("collection('categories').updateOne"));
});
