import test from "node:test";
import assert from "node:assert/strict";
import { checkShippingQuote } from "../backend/shopOrders/create/shippingQuoteCheck.js";
import { buildOrderDoc, type OrderDocInput } from "../backend/shopOrders/create/orderDoc.js";
import { hashQuoteItems, signQuoteToken } from "../backend/shopShipping/quoteToken.js";

const details = [{ productCode: "A", productName: "Plant", quantity: 2, price: 250000 }];
const address = { province: "Province", district: "District", ward: "Ward" };
function token(fee: number | null, freeShipApplied = false) {
  return signQuoteToken({ ...address, itemsKey: hashQuoteItems(details), fee,
    subtotal: 500000, totalWeightGram: 1000, freeShipApplied,
    shippingEstimateStatus: fee == null ? "needs_confirmation" : "estimated" });
}
function check(body: Record<string, unknown>, overrides = {}) {
  return checkShippingQuote({ body, deliveryMethod: "giao_tan_noi", orderDetails: details, subtotal: 500000, ...address, ...overrides });
}
function optionalQuote(run: () => void) {
  const previous = process.env.SHOP_REQUIRE_SHIPPING_QUOTE;
  process.env.SHOP_REQUIRE_SHIPPING_QUOTE = "0";
  try { run(); } finally {
    if (previous == null) delete process.env.SHOP_REQUIRE_SHIPPING_QUOTE;
    else process.env.SHOP_REQUIRE_SHIPPING_QUOTE = previous;
  }
}
function orderInput(quote: Extract<ReturnType<typeof check>, { ok: true }>, shipDiscount = 0): OrderDocInput {
  return { code: "TEST", accountId: "buyer", user: {}, isTest: true, addressId: "address",
    customerName: "Test", customerPhone: "0900000000", deliveryMethod: "giao_tan_noi", ...address,
    shippingAddress: "1 Street", orderDetails: details, ctvCodes: [], subtotal: 500000, discount: 25000,
    total: 475000 + quote.shippingFee - shipDiscount, shippingFeeCharged: quote.shippingFee - shipDiscount,
    shippingFeeOriginal: quote.shippingFee, shippingDiscount: shipDiscount, shippingPromotion: null,
    shippingPromotionPending: null, shippingCarrier: quote.shippingCarrier, freeShipApplied: quote.freeShipApplied,
    totalWeightGram: quote.totalWeightGram, quoteToken: quote.quoteToken, quoteVerified: quote.quoteVerified,
    appliedPromotion: null, method: "Pending", usingCod: false, hasPreOrder: false, customerNoteStored: "",
    reviewFirst: true, isTransfer: false, reviewKvDescription: "", idempotencyKey: "", bodyHash: "",
    now: new Date().toISOString() };
}

test("a supplied valid quote is charged and persisted even when quotes are optional", () => optionalQuote(() => {
  const result = check({ quoteToken: token(40700), shippingFee: 40700 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.shippingFee, 40700);
  const doc = buildOrderDoc(orderInput(result));
  assert.equal(doc.total, 515700);
  assert.equal(doc.shippingFee, 40700);
  assert.equal(doc.shippingFeePending, false);
  assert.equal((doc.shippingEstimate as any).status, "estimated");
}));
test("shipping discounts are applied once and a fully subsidized fee is still resolved", () => optionalQuote(() => {
  const result = check({ quoteToken: token(40700), shippingFee: 40700 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const discounted = buildOrderDoc(orderInput(result, 20000));
  assert.equal(discounted.total, 495700);
  assert.equal(discounted.shippingFee, 20700);
  assert.equal(discounted.shippingFeeOriginal, 40700);
  const covered = buildOrderDoc(orderInput(result, 40700));
  assert.equal(covered.shippingFee, 0);
  assert.equal(covered.shippingFeePending, false);
}));

test("unlinked wholesale HCM/TINH review orders retain charged shipping and its subsidy", () => optionalQuote(() => {
  const result = check({ quoteToken: token(40700), shippingFee: 40700 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const siRegion of ["HCM", "TINH"]) {
    const input = orderInput(result, 20000);
    const doc = buildOrderDoc({ ...input, user: { roles: ["si"], siStatus: "active", siRegion } });
    assert.equal(doc.kvPushStatus, "queued");
    assert.equal(doc.kvCustomerId, null);
    assert.equal(doc.shippingFeeOriginal, 40700);
    assert.equal(doc.shippingDiscount, 20000);
    assert.equal(doc.shippingFee, 20700);
    assert.equal(doc.shippingFeePending, false);
    assert.equal(doc.total, 495700);
    assert.equal(doc.paidAmount, 0);
  }
}));
test("unknown shipping stays pending; an optional absent quote preserves the legacy flow", () => optionalQuote(() => {
  for (const body of [{}, { quoteToken: token(null), shippingFee: 0 }]) {
    const result = check(body);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const doc = buildOrderDoc(orderInput(result));
    assert.equal(doc.total, 475000);
    assert.equal(doc.shippingFeePending, true);
  }
}));
test("optional quotes still reject tampered fees, invalid signatures, changed items and changed addresses", () => optionalQuote(() => {
  const signed = token(40700);
  for (const [body, overrides] of [
    [{ quoteToken: signed, shippingFee: 1 }, {}],
    [{ quoteToken: "invalid", shippingFee: 40700 }, {}],
    [{ quoteToken: signed, shippingFee: 40700 }, { ward: "Other ward" }],
    [{ quoteToken: signed, shippingFee: 40700 }, { orderDetails: [{ ...details[0], quantity: 3 }] }],
  ] as const) assert.equal(check(body, overrides).ok, false);
}));
test("pickup and customer-arranged transport continue to bypass carrier fees", () => optionalQuote(() => {
  for (const overrides of [{ deliveryMethod: "nhan_cua_hang" }, { customerArranged: true }]) {
    const result = check({ shippingFee: 40700, quoteToken: token(40700) }, overrides);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.shippingFee, 0);
  }
}));
test("required shipping quotes remain required", () => {
  const previous = process.env.SHOP_REQUIRE_SHIPPING_QUOTE;
  process.env.SHOP_REQUIRE_SHIPPING_QUOTE = "1";
  try { assert.equal(check({}).ok, false); } finally {
    if (previous == null) delete process.env.SHOP_REQUIRE_SHIPPING_QUOTE;
    else process.env.SHOP_REQUIRE_SHIPPING_QUOTE = previous;
  }
});
