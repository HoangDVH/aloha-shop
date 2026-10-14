import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicSharePreview } from "../backend/shopPromotions/publicSharePreview.js";
import type { PromotionDoc } from "../backend/shopPromotions/types.js";
import type { ActiveCampaign } from "../backend/shopCampaigns/currentCampaign.js";
const now = new Date("2026-10-14T10:00:00Z");
const quote = { items: [{ ma: "GSDL", price: 250000, quantity: 1, categoryId: "CAT" }], lines: [], flashSavings: 0, volumeSavings: 0, anchorSavings: 94000, notices: [] };
const promo = { id: "TEN", title: "Đặt trước 10%", status: "active", type: "auto", discountType: "percentage", discountValue: 10,
  maxDiscountVnd: 200000, scope: "product", productMas: ["GSDL"], targetCustomer: "retail", claimRequired: true,
  usedCount: 0, heldCount: 0, budgetUsed: 0, budgetHeld: 0, priority: 0 } as PromotionDoc;
const active = { phase: "live", content: { info: { name: "20/10", endAt: "2026-10-20T16:59:59Z" }, voucherIds: ["TEN"], products: [] } } as unknown as ActiveCampaign;
test("one unit combines product savings with only the best eligible voucher", () => {
  const newVoucher = { ...promo, id: "NEW", claimRequired: false, discountValue: 5, targetCustomer: "new_web" } as PromotionDoc;
  const r = buildPublicSharePreview(quote, [promo, newVoucher], active, true, now);
  assert.equal(r.reference, 344000);
  assert.equal(r.finalPrice, 225000);
  assert.equal(r.campaignName, "20/10");
  assert.equal(r.voucher?.title, promo.title);
  assert.equal(buildPublicSharePreview(quote, [newVoucher], null, false, now).voucher?.targetCustomer, "new_web");
});
test("scope, thresholds, caps, exhausted and private offers are respected", () => {
  const invalid: Partial<PromotionDoc>[] = [{ productMas: ["OTHER"] }, { excludedProductMas: ["GSDL"] },
    { scope: "category", categoryIds: ["WRONG"] }, { minOrderThreshold: 250000, thresholdOperator: ">" },
    { endDate: "2026-10-13T00:00:00Z" }, { startDate: "2026-10-15T00:00:00Z" }, { status: "paused" },
    { isPublic: false }, { type: "code" }, { benefitType: "shipping" }, { targetCustomer: "wholesale" },
    { usageLimitTotal: 1, usedCount: 1 }, { budgetTotal: 24999 }, { claimLimitTotal: 1, claimedCount: 1 },
    { claimStartDate: "2026-10-15T00:00:00Z" }];
  for (const change of invalid) assert.equal(buildPublicSharePreview(quote, [{ ...promo, ...change }], active, true, now).finalPrice, 250000, JSON.stringify(change));
  assert.equal(buildPublicSharePreview(quote, [promo], active, false, now).finalPrice, 250000);
  assert.equal(buildPublicSharePreview(quote, [promo], null, true, now).finalPrice, 250000);
  assert.equal(buildPublicSharePreview({ ...quote, items: [{ ...quote.items[0], flash: true }] }, [{ ...promo, excludeFlash: true }], active, true, now).finalPrice, 250000);
  assert.equal(buildPublicSharePreview(quote, [{ ...promo, maxDiscountVnd: 10000, minOrderThreshold: 250000, thresholdOperator: ">=" }], active, true, now).finalPrice, 240000);
});
