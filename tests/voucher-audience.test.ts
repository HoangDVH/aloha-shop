import test from "node:test";
import assert from "node:assert/strict";
import { voucherMatchesBuyer } from "../shared/voucherAudience.js";
import { resolveVoucherBuyer } from "../backend/shopPromotions/voucherBuyer.js";
import { applyBuyerRules } from "../backend/shopPromotions/wallet/walletRules.js";
import { evaluatePromotions, evaluateShippingPromotions } from "../backend/shopPromotions/evaluator.js";
import { promo } from "./helpers/walletFixtures.js";

test("new/returning audience is exclusive; unresolved identity hides both", () => {
  for (const newBuyer of [true, false, undefined]) {
    const viewer = { newBuyer };
    assert.equal(voucherMatchesBuyer("new_web", viewer), newBuyer === true);
    assert.equal(voucherMatchesBuyer("returning_web", viewer), newBuyer === false);
    assert.equal(voucherMatchesBuyer("all", viewer), true);
  }
});

test("saved opposite-audience vouchers disappear from candidates and notices", () => {
  const list = [promo("NEW", { targetCustomer: "new_web", minOrderThreshold: 0, discountValue: 40000 }), promo("OLD", { targetCustomer: "returning_web", minOrderThreshold: 0, discountValue: 70000 })];
  for (const newBuyer of [true, false]) {
    const result = applyBuyerRules(list, { newBuyer, status: { retail: true, locked: false, isTestBuyer: false }, campaignVoucherIds: new Set(), saved: new Set(["NEW", "OLD"]), walletOn: true });
    assert.deepEqual(result.promotions.map(p => p.id), [newBuyer ? "NEW" : "OLD"]);
    assert.deepEqual(result.notices, []);
    const quote = evaluatePromotions({ promotions: result.promotions, items: [{ ma: "P", price: 1000000, quantity: 1 }], buyer: { isNewWebBuyer: newBuyer, hasSuccessfulWebPurchase: !newBuyer }, now: new Date() });
    assert.equal(quote.discountTotal, newBuyer ? 40000 : 70000);
    assert.equal(quote.finalTotal, newBuyer ? 960000 : 930000);
  }
});

test("contradictory or missing eligibility cannot apply a new-customer voucher", () => {
  for (const buyer of [{}, { isNewWebBuyer: true, hasSuccessfulWebPurchase: true }]) {
    const quote = evaluatePromotions({ promotions: [promo("NEW", { targetCustomer: "new_web", minOrderThreshold: 0 })], items: [{ ma: "P", price: 1000000, quantity: 1 }], buyer, now: new Date() });
    assert.equal(quote.discountTotal, 0);
  }
});

test("held first order stays new audience but cannot redeem another new voucher", async () => {
  const db: any = { collection(name: string) { return { findOne: async (q: any) => name === "aloha_shop_promotion_claims" && q.state === "held" ? { state: "held" } : null }; } };
  assert.deepEqual(await resolveVoucherBuyer(db, { userId: "A" }), { newBuyer: true, hasSuccessfulWebPurchase: false, isNewWebBuyer: false });
});

test("successful purchase uses returning audience immediately", async () => {
  const db: any = { collection(name: string) { assert.equal(name, "aloha_shop_orders"); return { findOne: async () => ({ paymentStatus: "paid" }) }; } };
  assert.deepEqual(await resolveVoucherBuyer(db, { userId: "A" }), { newBuyer: false, hasSuccessfulWebPurchase: true, isNewWebBuyer: false });
});


test("goods and shipping discounts never mix new and returning audiences", () => {
  const list = [true, false].flatMap(newBuyer => ["goods", "shipping"].map(benefitType => promo(`${newBuyer ? "NEW" : "OLD"}-${benefitType}`, { targetCustomer: newBuyer ? "new_web" : "returning_web", benefitType: benefitType as "goods" | "shipping", minOrderThreshold: 0, discountValue: newBuyer ? 30000 : 50000 })));
  for (const newBuyer of [true, false]) {
    const { promotions } = applyBuyerRules(list, { newBuyer, status: { retail: true, locked: false, isTestBuyer: false }, campaignVoucherIds: new Set(), saved: new Set(), walletOn: false });
    const args = { promotions, buyer: { isNewWebBuyer: newBuyer, hasSuccessfulWebPurchase: !newBuyer }, items: [{ ma: "P", price: 1000000, quantity: 1 }], now: new Date() };
    const goods = evaluatePromotions(args);
    const ship = evaluateShippingPromotions({ ...args, deliveryMethod: "giao_tan_noi", shippingFee: 60000, freeShipApplied: false, matchRegion: () => ({ status: "matched", regionId: "all", regionVersion: 1, source: "name" }) });
    assert.equal(goods.applied?.promotionId, `${newBuyer ? "NEW" : "OLD"}-goods`);
    assert.equal(ship.applied?.promotionId, `${newBuyer ? "NEW" : "OLD"}-shipping`);
    assert.equal(goods.finalTotal + 60000 - (ship.applied?.discountAmount || 0), newBuyer ? 1000000 : 960000);
  }
});
