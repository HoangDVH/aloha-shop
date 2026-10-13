import test from "node:test";
import assert from "node:assert/strict";
import { currentCheckoutError } from "../frontend/lib/checkoutError.js";
import { shippingProgressPromotions } from "../frontend/lib/shippingProgress.js";
import { evaluatePurchasePolicy, defaultPurchasePolicy } from "../backend/shopWholesale/purchasePolicy.js";
import type { AvailablePromotionUI } from "../frontend/lib/promotions.js";

test("increasing from 1 to 31 pots clears a stale minimum-order error, including delayed response", () => {
  const error = { inputKey: "JW:1:65000", message: "Đơn sỉ tỉnh cần thêm 1.935.000đ" };
  assert.equal(currentCheckoutError(error, "JW:1:65000"), error.message);
  assert.equal(currentCheckoutError(error, "JW:31:65000"), "");
  assert.equal(currentCheckoutError(null, "JW:31:65000"), "");
});
test("31 pots at 65k meets TINH rules; one pot produces the exact previous error", () => {
  for (const [quantity, allowed, remaining] of [[1, false, 1935000], [31, true, 0]] as const) {
    const result = evaluatePurchasePolicy({ account: { active: true, roles: ["si"], siStatus: "active", siRegion: "TINH" },
      history: "new", policy: { ...defaultPurchasePolicy, version: "test" }, products: new Map([["JW", { siPurchaseGroup: "pot" }]]),
      lines: [{ productCode: "JW", productName: "Chậu", quantity, price: 65000 }] });
    assert.equal(result.canCheckout, allowed); assert.equal(result.remaining, remaining);
  }
});
test("shipping progress never advertises audience-blocked, unknown or invented vouchers", () => {
  const base: AvailablePromotionUI = { id: "ship50", title: "Hỗ trợ phí ship 50k", type: "auto", benefitType: "shipping", discountType: "fixed", discountValue: 50000, minOrderThreshold: 2000000 };
  assert.deepEqual(shippingProgressPromotions([{ ...base, audienceEligible: false }]), []);
  assert.deepEqual(shippingProgressPromotions([base]), []);
  assert.deepEqual(shippingProgressPromotions([]), []);
  assert.equal(shippingProgressPromotions([{ ...base, audienceEligible: true }]).length, 1);
  assert.deepEqual(shippingProgressPromotions([{ ...base, audienceEligible: true, benefitType: "goods" }]), []);
});
