const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../scripts/report-public-cache-metrics.cjs');
const sample = (startedAt, count, hit) => ({ at: String(count), api: { requests: { startedAt, boundsMs: [10, null], routes: { catalog: { count, errors: 0, totalMs: count * 5, buckets: [count, 0] } } }, groups: { catalog: { hit, miss: 0, bypass: 0 } } } });
test('report uses counter deltas and omits restart intervals', () => {
  const report = summarize([sample('a', 100, 50), sample('a', 110, 60), sample('b', 1, 1), sample('b', 3, 3)]);
  assert.equal(report.totals.catalog.count, 12);
  assert.equal(report.totals.catalog.hit, 12);
  assert.equal(report.totals.catalog.p95UpperMs, 10);
  assert.equal(report.resets, 1);
});
