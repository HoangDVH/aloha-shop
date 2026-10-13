import test from "node:test";
import assert from "node:assert/strict";
import { buildNewPromotion, buildPromotionUpdate } from "../backend/shopPromotions/admin/promotionPayload.js";
import { applyDrawnPercents, publicMystery, isMystery } from "../backend/shopPromotions/mystery.js";
import { promo } from "./helpers/walletFixtures.js";
test("admin cannot create or reenable random vouchers", () => {
  const body = { name: "Voucher", discountType: "percentage", discountValue: 10, mystery: { tiers: [{ percent: 10, weight: 1 }, { percent: 15, weight: 1 }] } };
  assert.equal(buildNewPromotion(body, "admin", new Date().toISOString()).ok, false);
  assert.equal(buildPromotionUpdate(body, promo("P"), "admin", new Date().toISOString()).ok, false);
});
test("converted voucher has no mystery metadata and preserves previously earned percentages", () => {
  const fixed = promo("P", { discountType: "percentage", discountValue: 10, preserveDrawnPercent: true });
  assert.equal(isMystery(fixed), false);
  assert.equal(publicMystery(fixed), undefined);
  assert.equal(applyDrawnPercents([fixed], new Map([["P", 15]]))[0].discountValue, 15);
  assert.equal(applyDrawnPercents([fixed], new Map())[0].discountValue, 10);
  assert.equal(applyDrawnPercents([promo("NORMAL", { discountValue: 5 })], new Map([["NORMAL", 15]]))[0].discountValue, 5);
});
