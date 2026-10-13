import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotions } from "../backend/shopPromotions/evaluator.js";
import { promo } from "./helpers/walletFixtures.js";
import { hasSuccessfulWebPurchase } from "../backend/shopPromotions/returningBuyer.js";
test("saved returning voucher requires successful purchase, not just a held first-order claim", () => {
  const p = promo("OLD", { targetCustomer: "returning_web", discountType: "percentage", discountValue: 7 });
  for (const evidence of [undefined, false, true]) {
    const q = evaluatePromotions({ promotions: [p], items: [{ ma: "P", price: 1000000, quantity: 1 }],
      buyer: { isNewWebBuyer: false, hasSuccessfulWebPurchase: evidence }, now: new Date() });
    assert.equal(Boolean(q.applied), evidence === true);
    if (evidence === true) assert.equal(q.applied?.discountAmount, 70000);
  }
});
test("successful purchase lookup excludes cancelled orders and never reads held voucher claims", async () => {
  let query: any;
  const db: any = { collection(name: string) { assert.equal(name, "aloha_shop_orders"); return { findOne(q: any) { query = q; return Promise.resolve({ _id: "O" }); } }; } };
  assert.equal(await hasSuccessfulWebPurchase(db, {}), false);
  assert.equal(await hasSuccessfulWebPurchase(db, { userId: "A" }), true);
  assert.deepEqual(query.$or, [{ shopAccountId: "A" }]);
  assert.ok(query.$and[0].orderStatus.$nin.includes("da_huy"));
  assert.deepEqual(query.$and[1].$or[0], { paymentStatus: "paid" });
});
