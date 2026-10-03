import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignDealOff,
  sortPublicItems,
  type CatalogDealInfo,
} from "../backend/shopCatalog/catalog/publicProduct.js";

const item = (ma: string, ten: string, gia: number, webBadge?: string) =>
  ({ ma, ten, gia, webBadge }) as any;

test("SD01: sort Giảm giá đưa SP chiến dịch lên trước SP gắn nhãn tay và SP thường", () => {
  const items = [
    item("A", "An", 100_000),
    item("B", "Bình", 200_000, "giam_gia"),
    item("C", "Cúc", 300_000),
    item("D", "Dứa", 150_000),
  ];
  const deals = new Map<string, CatalogDealInfo>([
    ["C", { salePrice: 0, compareAtPrice: 400_000, hasGift: true }],
    ["D", { salePrice: 100_000, compareAtPrice: 0, hasGift: false }],
  ]);
  const order = sortPublicItems(items, "giam_gia", undefined, "", deals).map((p) => p.ma);
  assert.deepEqual(order, ["D", "C", "B", "A"]);
});

test("SD02: SP chiến dịch chỉ có quà vẫn đứng trên SP thường; cùng % thì SP có quà trước", () => {
  const items = [item("X", "Xoài", 100_000), item("G", "Gừng", 100_000), item("H", "Hồng", 100_000)];
  const deals = new Map<string, CatalogDealInfo>([
    ["G", { salePrice: 0, compareAtPrice: 0, hasGift: true }],
    ["H", { salePrice: 0, compareAtPrice: 0, hasGift: false }],
  ]);
  const order = sortPublicItems(items, "giam_gia", undefined, "", deals).map((p) => p.ma);
  assert.deepEqual(order, ["G", "H", "X"]);
});

test("SD03: không có chiến dịch thì giữ cách cũ (nhãn giam_gia trước)", () => {
  const items = [item("A", "An", 1), item("B", "Bình", 1, "giam_gia")];
  assert.deepEqual(sortPublicItems(items, "giam_gia", undefined, "").map((p) => p.ma), ["B", "A"]);
});

test("SD04: tỉ lệ giảm — giá sale ưu tiên, giá gạch phải cao hơn giá web", () => {
  assert.equal(campaignDealOff(100, undefined), -1);
  assert.equal(campaignDealOff(100, { salePrice: 80, compareAtPrice: 0, hasGift: false }), 0.2);
  assert.equal(campaignDealOff(300, { salePrice: 0, compareAtPrice: 400, hasGift: true }), 0.25);
  assert.equal(campaignDealOff(300, { salePrice: 0, compareAtPrice: 200, hasGift: true }), 0);
  assert.equal(campaignDealOff(100, { salePrice: 120, compareAtPrice: 0, hasGift: false }), 0);
});
