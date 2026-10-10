import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POPULAR_SEARCHES } from '../frontend/lib/popularSearches';

// Explicit integration check against a running shop; no Mongo writes or stock changes.
const base = process.env.SHOP_TEST_API_BASE;
for (const suggestion of POPULAR_SEARCHES) {
  test(`popular suggestion ${suggestion.label} resolves to actual sellable Aloha inventory`, { skip: !base }, async () => {
    const params = new URLSearchParams({ q: suggestion.query, inStock: '1', limit: '48' });
    const response = await fetch(`${base}/api/shop/products?${params}`, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200);
    const body = await response.json() as { total: number; items: { ma: string; ton: number; gia: number; nhomPath?: string }[] };
    assert.ok(body.total > 0, suggestion.label);
    assert.ok(body.items.some(product => product.ma && product.ton > 0 && product.gia > 0 &&
      (!suggestion.label.startsWith('Chậu') || product.nhomPath?.startsWith('CHẬU TRỒNG CÂY'))),
    `${suggestion.label} must have a real product of the correct kind with stock and public price`);
  });
}
