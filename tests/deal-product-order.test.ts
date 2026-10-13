import test from "node:test";
import assert from "node:assert/strict";
import { placeDealPins } from "../frontend/lib/campaign/dealProductOrder.js";
import { arrangeByAbsolutePin } from "../backend/shopCatalog/pinArrange.js";
import { filterScopedProducts, emptyScopedFilters } from "../frontend/components/catalog/scopedProductFilters.js";

test("offer hub and home use the server's absolute pin order, not campaign input order", () => {
  const input = [
    { ma: "A", gia: 300000 }, { ma: "B", gia: 200000, webBadge: "uu_dai", webPin: 1 },
    { ma: "C", gia: 100000, webBadge: "uu_dai", webPin: 3 },
    { ma: "D", gia: 400000, webBadge: "noi_bat", webPin: 1 },
  ];
  const ordered = placeDealPins(input);
  assert.deepEqual(ordered.map(p => p.ma), ["B", "A", "C", "D"]);
  assert.deepEqual(ordered, arrangeByAbsolutePin(input, () => 0, "uu_dai"));
  assert.deepEqual(input.map(p => p.ma), ["A", "B", "C", "D"]);
  assert.deepEqual(filterScopedProducts(ordered as any, emptyScopedFilters(), "price_asc").map(p => p.ma), ["C", "B", "A", "D"]);
  assert.deepEqual(filterScopedProducts(ordered as any, emptyScopedFilters(), "ban_chay").map(p => p.ma), ["B", "A", "C", "D"]);
});

test("duplicates, missing positions and out-of-range pins match existing server behavior", () => {
  for (const pins of [[1, 1, 0, 3], [0, 10, 2, 0], [3, 0, 1, 0], [0, 0, 0, 0]]) {
    const input = pins.map((webPin, i) => ({ ma: String(i), webBadge: "uu_dai", webPin }));
    assert.deepEqual(placeDealPins(input), arrangeByAbsolutePin(input, () => 0, "uu_dai"));
  }
});
