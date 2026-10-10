import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurePublicRequests, recordRequest, requestMetrics } from '../backend/cache/requestMetrics.js';
test('histogram preserves counts, errors and overflow; snapshot is detached', () => {
  recordRequest('test', 15, 200);
  recordRequest('test', 6000, 503);
  const row = requestMetrics().routes.test;
  assert.equal(row.count, 2);
  assert.equal(row.errors, 1);
  assert.equal(row.totalMs, 6015);
  assert.equal(row.buckets.reduce((a, b) => a + b), 2);
  row.buckets.fill(0);
  assert.equal(requestMetrics().routes.test.buckets.at(-1), 1);
});
test('middleware ignores private routes and collapses gift identifiers', () => {
  let listener: (() => void) | undefined;
  const response = { statusCode: 200, once: (_event: string, cb: () => void) => { listener = cb; } };
  const invoke = (path: string) => measurePublicRequests({ method: 'GET', path } as any, response as any, () => {});
  invoke('/api/shop/auth/me');
  assert.equal(listener, undefined);
  invoke('/api/shop/gifts/private-looking-slug');
  listener!();
  assert.equal(requestMetrics().routes.gifts.count, 1);
  assert.equal(requestMetrics().routes['private-looking-slug'], undefined);
});
