import test from "node:test";
import assert from "node:assert/strict";
import { getPhase } from "../backend/shopCampaigns/campaignPhase.js";
import { buildCampaignPromo } from "../backend/shopCampaigns/campaignPromo.js";
import { checkProducts } from "../backend/shopCampaigns/admin/prepublishChecks.js";
import type { ProductFacts } from "../backend/shopCampaigns/admin/productFacts.js";
import { isInvalidCampaign, validateCampaignContent } from "../backend/shopCampaigns/schema.js";
import type { CampaignProduct } from "../backend/shopCampaigns/types.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";

const withRow = (row: Partial<CampaignProduct>) => {
  const c = daiLeContent();
  c.products.push({ ma: "SP_D", salePrice: 0, quota: 0, perCustomerLimit: 2, ...row });
  return c;
};
const active = (content: ReturnType<typeof daiLeContent>, nowMs: number) => ({
  id: "DAI_LE",
  content,
  phase: getPhase(content.info, nowMs),
  publishedAt: null,
});
const SP_D = { ma: "SP_D", gia: 250_000, webPrice: 250_000 };
const LIVE = vn("2026-10-01T10:00");

test("Giá trước KM > giá web: card gạch 300K, khách vẫn trả giá web 250K (không có giá sale)", () => {
  const p = buildCampaignPromo(active(withRow({ compareAtPrice: 300_000 }), LIVE), SP_D, LIVE, new Map());
  assert.equal(p?.kind, "deal");
  assert.equal(p?.salePrice, null);
  assert.equal(p?.listPrice, 250_000);
  assert.equal(p?.compareAtPrice, 300_000);
});

test("Giá trước KM không cao hơn giá web hoặc chưa tới giờ chạy → không gạch", () => {
  assert.equal(buildCampaignPromo(active(withRow({ compareAtPrice: 250_000 }), LIVE), SP_D, LIVE, new Map()), null);
  const teaser = vn("2026-09-28T10:00");
  assert.equal(buildCampaignPromo(active(withRow({ compareAtPrice: 300_000 }), teaser), SP_D, teaser, new Map()), null);
});

test("Schema: không nhập cùng lúc giá sale và giá trước KM; 0 = bỏ trống", () => {
  const both = validateCampaignContent(withRow({ salePrice: 200_000, quota: 5, compareAtPrice: 300_000 }));
  assert.ok(isInvalidCampaign(both));
  assert.ok(both.fields.some((f) => f.path === "products.3.compareAtPrice"));
  const zero = validateCampaignContent(withRow({ compareAtPrice: 0 }));
  assert.ok(!isInvalidCampaign(zero));
  assert.equal(zero.value.products[3].compareAtPrice, undefined);
});

test("Kiểm tra trước khi bật: giá trước KM ≤ giá web hoặc gấp > 2 lần → cảnh báo, không chặn", () => {
  const facts = new Map<string, ProductFacts>([
    ["SP_A", { ma: "SP_A", ten: "SP_A", listPrice: 200_000, cost: 0, stock: 50, nhomPath: "" }],
    ["SP_B", { ma: "SP_B", ten: "SP_B", listPrice: 500_000, cost: 0, stock: 20, nhomPath: "" }],
    ["SP_C", { ma: "SP_C", ten: "SP_C", listPrice: 80_000, cost: 0, stock: 10, nhomPath: "" }],
    ["QUA_G", { ma: "QUA_G", ten: "QUA_G", listPrice: 30_000, cost: 0, stock: 5, nhomPath: "" }],
    ["SP_D", { ma: "SP_D", ten: "SP_D", listPrice: 250_000, cost: 0, stock: 10, nhomPath: "" }],
  ]);
  const low = checkProducts(withRow({ compareAtPrice: 240_000 }), facts);
  assert.ok(low.some((i) => i.path === "products.3.compareAtPrice" && i.level === "warn"));
  const high = checkProducts(withRow({ compareAtPrice: 600_000 }), facts);
  assert.ok(high.some((i) => i.path === "products.3.compareAtPrice" && i.level === "warn"));
  const ok = checkProducts(withRow({ compareAtPrice: 300_000 }), facts);
  assert.ok(!ok.some((i) => i.path.startsWith("products.3")));
});

test("thanh giá gạch: theo tồn kho thật, không có % đã bán", async () => {
  const { anchorDealProgress } = await import("../frontend/lib/campaign/dealProgress.js");
  const promo = { salePrice: null, listPrice: 250000, compareAtPrice: 300000 } as never;
  assert.deepEqual(anchorDealProgress(promo, 12, true), { left: "Ưu đãi đang diễn ra", right: "Còn 12", pct: 0, soldOut: false, state: "live" });
  assert.equal(anchorDealProgress(promo, 3, true)?.state, "low");
  assert.equal(anchorDealProgress(promo, 0, true)?.right, "Nhận đặt trước");
  assert.equal(anchorDealProgress(promo, 0, false), null);
  assert.equal(anchorDealProgress({ salePrice: 200000, listPrice: 250000, compareAtPrice: null } as never, 12, true), null);
});

test("Giá gạch có số suất: thanh ghi theo giai đoạn từ số đã bán giá web", async () => {
  const { isAnchorRow } = await import("../backend/shopCampaigns/anchorSales.js");
  const row = { ma: "SP_D", salePrice: 0, compareAtPrice: 300_000, quota: 10, perCustomerLimit: 2 };
  assert.equal(isAnchorRow(row), true);
  assert.equal(isAnchorRow({ ...row, quota: 0 }), false);
  assert.equal(isAnchorRow({ ...row, salePrice: 200_000 }), false);
  const lookup = (p: CampaignProduct) => (isAnchorRow(p) ? { remaining: 7, soldPct: 30, sold: 3 } : null);
  const p = buildCampaignPromo(active(withRow({ compareAtPrice: 300_000, quota: 10 }), LIVE), SP_D, LIVE, new Map(), lookup);
  assert.deepEqual([p?.remaining, p?.soldPct, p?.soldQty], [7, 30, 3]);

  const { anchorDealProgress } = await import("../frontend/lib/campaign/dealProgress.js");
  const ui = { salePrice: null, listPrice: 250_000, compareAtPrice: 300_000 };
  const bar = (over: object, stock = 12) => anchorDealProgress({ ...ui, ...over } as never, stock, true);
  assert.deepEqual(bar({ remaining: 10, soldPct: 0, soldQty: 0 }), { left: "Vừa mở bán", right: "", pct: 0, soldOut: false, state: "fresh" });
  assert.deepEqual(bar({ remaining: 9, soldPct: 10, soldQty: 1 }), { left: "Đã bán 1", right: "", pct: 10, soldOut: false, state: "selling" });
  assert.deepEqual([bar({ remaining: 4, soldPct: 60, soldQty: 6 })?.left, bar({ remaining: 4, soldPct: 60, soldQty: 6 })?.right], ["Đang bán chạy", "Đã bán 6"]);
  assert.equal(bar({ remaining: 2, soldPct: 80, soldQty: 8 })?.left, "Chỉ còn 2 suất cuối!");
  assert.equal(bar({ remaining: 8, soldPct: 20, soldQty: 2 }, 3)?.left, "Chỉ còn 3 suất cuối!");
  const full = bar({ remaining: 0, soldPct: 100, soldQty: 13 });
  assert.deepEqual([full?.left, full?.right, full?.soldOut], ["Bán chạy", "Đã bán 13", false]);
});

test("Giảm giá sản phẩm ở checkout = (giá trước KM − giá khách trả) × SL; bỏ quà, flash, trước giờ chạy", async () => {
  const { anchorSavingsOf } = await import("../backend/shopCampaigns/anchorSales.js");
  const content = withRow({ compareAtPrice: 300_000 });
  const line = (over: object = {}) => ({ productCode: "SP_D", productName: "SP_D", quantity: 2, price: 250_000, ...over });
  assert.equal(anchorSavingsOf(active(content, LIVE), [line()], LIVE), 100_000);
  assert.equal(anchorSavingsOf(active(content, LIVE), [line({ productCode: "sp_d" })], LIVE), 100_000);
  assert.equal(anchorSavingsOf(active(content, LIVE), [line({ isGift: true, price: 0 })], LIVE), 0);
  assert.equal(anchorSavingsOf(active(content, LIVE), [line({ price: 320_000 })], LIVE), 0);
  assert.equal(anchorSavingsOf(active(content, LIVE), [line({ price: 0 })], LIVE), 0);
  const teaser = vn("2026-09-28T10:00");
  assert.equal(anchorSavingsOf(active(content, teaser), [line()], teaser), 0);
});
