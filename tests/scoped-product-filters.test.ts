import test from "node:test";
import assert from "node:assert/strict";
import type { ShopProduct } from "../frontend/lib/api";
import { emptyScopedFilters, filterScopedGroups, filterScopedProducts, scopedProductFacets, scopedProductPrice } from "../frontend/components/catalog/scopedProductFilters";

const product = (ma: string, gia: number, extra: Partial<ShopProduct> = {}): ShopProduct => ({
  ma, gia, ten: ma, dvt: "Cây", nhom: "", nhomPath: "", ton: 1, anh: "", images: [], isActive: true, path: "", categorySlug: "", productSlug: "", ...extra,
});

test("price filtering includes matches beyond the first display page without changing the collection", () => {
  const input = Array.from({ length: 30 }, (_, i) => product(String(i), i < 20 ? 500000 : 50000));
  assert.deepEqual(filterScopedProducts(input, { ...emptyScopedFilters(), maxPrice: "100000" }, "price_asc").map(p => p.ma), input.slice(20).map(p => p.ma));
  assert.equal(input.length, 30);
});

test("attribute values use OR within a group and AND across groups; units combine with price", () => {
  const attrs = (size: string, color: string) => [{ attributeName: "Size", attributeValue: size }, { attributeName: "Color", attributeValue: color }];
  const input = [product("a", 100, { attributes: attrs("S", "Green") }), product("b", 200, { attributes: attrs("M", "Green") }), product("c", 150, { attributes: attrs("S", "Red") }), product("d", 100, { dvt: "Thùng", attributes: attrs("S", "Green") })];
  const filters = { ...emptyScopedFilters(), attrs: ["Size:S", "Size:M", "Color:Green"], dvts: ["Cây"], maxPrice: "150" };
  assert.deepEqual(filterScopedProducts(input, filters, "ban_chay").map(p => p.ma), ["a"]);
  assert.deepEqual(scopedProductFacets(input), { dvt: ["Cây", "Thùng"], attributes: { Size: ["S", "M"], Color: ["Green", "Red"] } });
});

test("flash sale price reverts to the card's regular price when exhausted or closed", () => {
  const promo = { kind: "flash", slotOpen: true, salePrice: 50, listPrice: 100, remaining: 1 } as NonNullable<ShopProduct["campaignPromo"]>;
  assert.equal(scopedProductPrice(product("a", 100, { campaignPromo: promo })), 50);
  assert.equal(scopedProductPrice(product("a", 100, { campaignPromo: { ...promo, remaining: 0 } })), 100);
  assert.equal(scopedProductPrice(product("a", 100, { campaignPromo: { ...promo, slotOpen: false } })), 100);
});

test("sorts and clearing preserve the original recommended order without mutating input", () => {
  const input = [product("a", 200), product("b", 100), product("c", 150)];
  assert.deepEqual(filterScopedProducts(input, emptyScopedFilters(), "price_asc").map(p => p.ma), ["b", "c", "a"]);
  assert.deepEqual(filterScopedProducts(input, emptyScopedFilters(), "price_desc").map(p => p.ma), ["a", "c", "b"]);
  assert.deepEqual(filterScopedProducts(input, emptyScopedFilters(), "ban_chay"), input);
  assert.deepEqual(input.map(p => p.ma), ["a", "b", "c"]);
});

test("badge tabs only match labelled products within the supplied page collection", () => {
  const input = [product("featured", 100, { webBadge: "noi_bat" }), product("new", 100, { webBadge: "moi" }), product("best", 100, { webBadge: "ban_chay_sap_het" }), product("legacy", 100, { webBadge: "ban_chay" }), product("sale", 100, { webBadge: "giam_gia" }), product("plain", 100)];
  for (const [badge, expected] of [["noi_bat", ["featured"]], ["moi", ["new"]], ["ban_chay_sap_het", ["best", "legacy"]], ["giam_gia", ["sale"]]] as const) {
    assert.deepEqual(filterScopedProducts(input, emptyScopedFilters(), `badge:${badge}`).map(p => p.ma), expected);
  }
  assert.deepEqual(filterScopedProducts(input.slice(0, 2), emptyScopedFilters(), "badge:giam_gia"), []);
  assert.equal(filterScopedProducts(input, emptyScopedFilters(), "ban_chay").length, 6);
  assert.equal(filterScopedProducts(input, { ...emptyScopedFilters(), minPrice: "200" }, "badge:moi").length, 0);
});

test("multiple gift or campaign groups use OR without expanding the current collection", () => {
  const input = [product("a", 100, { nhom: "A" }), product("b", 100, { nhom: "B" }), product("c", 100, { nhom: "C" })];
  assert.deepEqual(filterScopedGroups(input, ["A", "B"]).map(p => p.ma), ["a", "b"]);
  assert.deepEqual(filterScopedGroups(input, []).map(p => p.ma), ["a", "b", "c"]);
  assert.deepEqual(filterScopedGroups(input.slice(0, 1), ["B"]), []);
});
