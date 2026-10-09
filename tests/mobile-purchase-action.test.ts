import test from "node:test";
import assert from "node:assert/strict";
import { mobilePurchaseAction } from "../frontend/components/pdp/purchaseAction";
const ready = { needPick: false, variantsLoading: false, purchaseDisabled: false, quantityExceedsStock: false };
test("ready product buys directly; missing selection or invalid quantity opens picker", () => {
 assert.equal(mobilePurchaseAction(ready), "buy");
 assert.equal(mobilePurchaseAction({ ...ready, needPick: true, purchaseDisabled: true }), "choose");
 assert.equal(mobilePurchaseAction({ ...ready, variantsLoading: true }), "choose");
 assert.equal(mobilePurchaseAction({ ...ready, quantityExceedsStock: true }), "choose");
});
test("unavailable or pending-price product cannot bypass purchase guards", () => {
 assert.equal(mobilePurchaseAction({ ...ready, purchaseDisabled: true }), "blocked");
});
