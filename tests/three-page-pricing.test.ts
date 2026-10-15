import test from "node:test";
import assert from "node:assert/strict";
import { calculateTierPrice } from "../frontend/lib/volumePricing.js";
import { evaluatePromotions, evaluateShippingPromotions } from "../backend/shopPromotions/evaluator.js";
import { applyBuyerRules } from "../backend/shopPromotions/wallet/walletRules.js";
import { promo } from "./helpers/walletFixtures.js";
const now = new Date("2026-10-15T03:00:00.000Z");
const region = () => ({ status: "matched" as const, regionId: "all", regionVersion: 1, source: "name" as const });
let cases = 0;
test("quantity, customer voucher, saved wallet and shipping matrix agrees with independent arithmetic", () => {
  for (const base of [150000, 268000, 530000]) for (const qty of [1, 4, 5, 9, 10, 15, 20])
  for (const returning of [false, true]) for (const saved of [false, true]) for (const fee of [0, 18000, 45000, 119400]) {
    cases++;
    const percent = qty >= 10 ? 10 : qty >= 5 ? 5 : 0;
    const unit = Math.round(base * (100 - percent) / 100);
    const subtotal = unit * qty;
    const tier = calculateTierPrice(base, qty);
    assert.equal(tier.unitPrice, unit);
    const goods = promo("CUSTOMER", { targetCustomer: returning ? "returning_web" : "new_web", discountType: "percentage",
      discountValue: returning ? 7 : 5, maxDiscountVnd: returning ? undefined : 300000, minOrderThreshold: 0, claimRequired: true });
    const ship30 = promo("SHIP30", { benefitType: "shipping", discountValue: 30000, minOrderThreshold: 1000000, regionId: "all", claimRequired: true });
    const ship50 = { ...ship30, id: "SHIP50", discountValue: 50000, minOrderThreshold: 2000000 };
    const rules = applyBuyerRules([goods, ship30, ship50], { status: { retail: true, locked: false, isTestBuyer: false },
      account: { roles: ["customer"], active: true }, newBuyer: !returning, campaignVoucherIds: new Set([goods.id, ship30.id, ship50.id]),
      saved: new Set(saved ? [goods.id, ship30.id, ship50.id] : []), walletOn: true });
    const buyer = { isWholesale: false, isNewWebBuyer: !returning, hasSuccessfulWebPurchase: returning };
    const items = [{ ma: "P", price: unit, quantity: qty }];
    const quote = evaluatePromotions({ promotions: rules.promotions, items, buyer, now });
    const expectedGoodsDiscount = saved ? Math.min(Math.round(subtotal * (returning ? 7 : 5) / 100), returning ? Infinity : 300000) : 0;
    assert.equal(quote.discountTotal, expectedGoodsDiscount);
    const shipping = evaluateShippingPromotions({ promotions: rules.promotions, items, buyer, now,
      shippingFee: fee, freeShipApplied: false, deliveryMethod: "giao_tan_noi", matchRegion: region });
    const expectedShipDiscount = saved ? Math.min(fee, subtotal >= 2000000 ? 50000 : subtotal >= 1000000 ? 30000 : 0) : 0;
    assert.equal(shipping.applied?.discountAmount || 0, expectedShipDiscount);
    const pdp = quote.finalTotal;
    const cart = subtotal - expectedGoodsDiscount;
    const checkout = pdp + fee - expectedShipDiscount;
    assert.equal(pdp, cart);
    assert.equal(base * qty - tier.savedAmount - expectedGoodsDiscount + fee - expectedShipDiscount, checkout);
    assert.equal(evaluateShippingPromotions({ promotions: rules.promotions, items, buyer, now, shippingFee: null,
      freeShipApplied: false, deliveryMethod: "giao_tan_noi", matchRegion: region }).applied, undefined);
  }
  assert.equal(cases, 336);
});
test("shipping threshold uses discounted unit price before goods voucher, and exact thresholds qualify", () => {
  const ship = promo("SHIP", { benefitType: "shipping", discountValue: 30000, minOrderThreshold: 1000000, regionId: "all" });
  const base = { promotions: [ship], buyer: { isWholesale: false }, now, shippingFee: 45000, freeShipApplied: false, deliveryMethod: "giao_tan_noi", matchRegion: region };
  assert.equal(evaluateShippingPromotions({ ...base, items: [{ ma: "P", quantity: 1, price: 1000000 }] }).applied?.discountAmount, 30000);
  assert.equal(evaluateShippingPromotions({ ...base, items: [{ ma: "P", quantity: 1, price: 999999 }] }).applied, undefined);
  assert.equal(evaluateShippingPromotions({ ...base, deliveryMethod: "nhan_cua_hang", items: [{ ma: "P", quantity: 1, price: 1000000 }] }).applied, undefined);
});
