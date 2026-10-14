import test from "node:test";
import assert from "node:assert/strict";
import { pdpApplicableVouchers, pdpDefaultVouchers } from "../frontend/lib/pdpVouchers.js";
import type { AvailablePromotionUI } from "../frontend/lib/promotions.js";
import type { ShopProduct } from "../frontend/lib/api.js";

const now = Date.parse("2026-10-14T10:00:00Z");
const product = { ma: "GSDL", categoryId: "plants", categorySlug: "sen-da" } as ShopProduct;
const voucher = (id: string, overrides: Partial<AvailablePromotionUI> = {}): AvailablePromotionUI => ({
  id, title: id, type: "auto", benefitType: "goods", discountType: "percentage", discountValue: 5,
  audienceEligible: true, scope: "all", ...overrides,
});
const offers = [
  voucher("20/10", { targetCustomer: "retail", discountValue: 10, maxDiscountVnd: 200000, claimRequired: true }),
  voucher("new", { targetCustomer: "new_web", maxDiscountVnd: 300000 }),
  voucher("returning", { targetCustomer: "returning_web", maxDiscountVnd: 100000 }),
  voucher("ship", { benefitType: "shipping", discountType: "fixed", discountValue: 30000, minOrderThreshold: 1000000 }),
];

for (const newBuyer of [true, false]) test(`PDP keeps ${newBuyer ? "new" : "returning"} voucher and ship while campaign stays in full list`, () => {
  const viewer = { newBuyer };
  const matched = pdpApplicableVouchers(offers, product, viewer, false, now);
  assert.deepEqual(matched.map(p => p.id), ["20/10", newBuyer ? "new" : "returning", "ship"]);
  assert.deepEqual(pdpDefaultVouchers(matched, viewer).map(p => p.id), [newBuyer ? "new" : "returning", "ship"]);
});

test("PDP never fills missing customer or shipping slots with campaign vouchers", () => {
  assert.deepEqual(pdpDefaultVouchers([offers[0]], { newBuyer: false }), []);
  assert.deepEqual(pdpDefaultVouchers([offers[0], offers[2]], { newBuyer: false }).map(p => p.id), ["returning"]);
  assert.deepEqual(pdpDefaultVouchers(offers, undefined).map(p => p.id), ["ship"]);
});

test("PDP excludes blocked, unknown eligibility, expired, future and out-of-scope offers", () => {
  const invalid = [
    voucher("blocked", { audienceEligible: false }), voucher("unknown", { audienceEligible: undefined }),
    voucher("expired", { endDate: "2026-10-14T10:00:00Z" }),
    voucher("future", { startDate: "2026-10-15T10:00:00Z" }),
    voucher("other", { scope: "product", productMas: ["OTHER"] }),
    voucher("empty-products", { scope: "product", productMas: [] }),
    voucher("empty-categories", { scope: "category", categoryIds: [] }),
    voucher("other-category", { scope: "category", categoryIds: ["OTHER"] }),
    voucher("wholesale", { targetCustomer: "wholesale" }),
  ];
  assert.deepEqual(pdpApplicableVouchers(invalid, product, { newBuyer: true }, false, now), []);
  assert.equal(pdpApplicableVouchers([voucher("product", { scope: "product", productMas: [" gsdl "] }),
    voucher("category", { scope: "category", categoryIds: ["plants"] })], product, {}, false, now).length, 2);
});

test("explicit server eligibility permits wholesale shipping but never retail goods", () => {
  assert.deepEqual(pdpApplicableVouchers([
    voucher("goods", { targetCustomer: "retail" }),
    voucher("ship", { targetCustomer: "retail", benefitType: "shipping" }),
    voucher("blocked-ship", { targetCustomer: "retail", benefitType: "shipping", audienceEligible: false }),
  ], product, {}, true, now).map(p => p.id), ["ship"]);
});
