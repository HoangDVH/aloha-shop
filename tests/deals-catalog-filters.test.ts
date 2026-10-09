import test from "node:test";
import assert from "node:assert/strict";
import { DEALS_TYPE_FILTERS, legacyDealsPriceRange, matchesDealsFilter } from "../frontend/lib/campaign/dealsFilters";

test("campaign tabs contain only offer types; price appears in the shared toolbar", () => {
  assert.deepEqual(DEALS_TYPE_FILTERS.map(f => f.id), ["all", "flash", "deal-hot", "qua-tang"]);
});

test("old price links convert to visible price bounds with their original boundaries", () => {
  for (const id of ["duoi-300k", "300-500k", "tren-500k"] as const) {
    const range = legacyDealsPriceRange(id)!;
    for (const price of [0, 1, 299999, 300000, 500000, 500001]) {
      const inRange = price >= Number(range.minPrice) && (!range.maxPrice || price <= Number(range.maxPrice));
      assert.equal(inRange, matchesDealsFilter({ ma: "x", price, dealHot: false, hasGift: false }, id));
    }
  }
  assert.equal(legacyDealsPriceRange("qua-tang"), null);
});
