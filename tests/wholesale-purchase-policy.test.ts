import test from "node:test";
import assert from "node:assert/strict";
import { defaultPurchasePolicy, evaluatePurchasePolicy, purchaseGroup, purchasePolicySchema } from "../backend/shopWholesale/purchasePolicy.js";
import { completedKvPurchase, purchaseHistory } from "../backend/shopWholesale/purchaseHistory.js";
import { checkWholesalePurchase } from "../backend/shopWholesale/purchaseCheck.js";
import { checkShippingQuote } from "../backend/shopOrders/create/shippingQuoteCheck.js";

const policy = { ...defaultPurchasePolicy, version: "test" };
const account = { _id: "customer", active: true, roles: ["si"], siStatus: "active", siRegion: "TINH" };
function check(region: string, amount: number, history: "new" | "returning" | "unknown" = "new") {
  return evaluatePurchasePolicy({ account: { ...account, siRegion: region }, policy, history,
    products: new Map([["P", { siPurchaseGroup: "other" }]]), lines: [{ productCode: "P", productName: "P", price: amount, quantity: 1 }] });
}
test("HCM first purchase: below minimum blocked, exact threshold allowed; returning exempt", () => {
  assert.equal(check("HCM", 1999999).canCheckout, false);
  assert.equal(check("HCM", 2000000).canCheckout, true);
  assert.equal(check("HCM", 1000, "returning").canCheckout, true);
  assert.equal(check("HCM", 1000, "unknown").issues.some(i => i.code === "history"), true);
  assert.equal(check("HCM", 2000000, "unknown").canCheckout, true);
});

test("HCM first order of 2,030,000 to District 8 Ward 2 passes both amount and destination checks", () => {
  const result = evaluatePurchasePolicy({ account: { ...account, siRegion: "HCM" }, policy, history: "new",
    products: new Map([["P", { siPurchaseGroup: "other" }]]),
    lines: [{ productCode: "P", productName: "P", price: 2030000, quantity: 1 }],
    delivery: { deliveryMethod: "giao_tan_noi", province: "Hồ Chí Minh", district: "Quận 8", ward: "Phường 2" } });
  assert.equal(result.remaining, 0);
  assert.deepEqual(result.issues, []);
  assert.equal(result.canCheckout, true);
});
test("TINH: every order needs minimum, including returning customers; no carton exception", () => {
  assert.equal(check("TINH", 1999999, "returning").canCheckout, false);
  assert.equal(check("TINH", 2000000).canCheckout, true);
});
for (const [group, price, minimum] of [["finished", 50000, 5], ["raw", 20000, 10], ["pot", 14999, 5], ["pot", 15000, 1], ["other", 1000, 1]] as const) {
  test(`${group} at ${price}: per-code minimum is ${minimum}`, () => {
    for (const quantity of [minimum - 1, minimum]) {
      if (!quantity) continue;
      const result = evaluatePurchasePolicy({ account, policy, history: "new", products: new Map([["A", { siPurchaseGroup: group }], ["B", { siPurchaseGroup: "other" }]]),
        lines: [{ productCode: "A", productName: "A", price, quantity }, { productCode: "B", productName: "B", price: 2000000, quantity: 1 }] });
      assert.equal(result.canCheckout, quantity >= minimum);
    }
  });
}
test("duplicate SKU lines aggregate, distinct colors/sizes with different codes do not", () => {
  const run = (codes: string[]) => evaluatePurchasePolicy({ account, policy, history: "new",
    products: new Map([["A", { siPurchaseGroup: "finished" }], ["C", { siPurchaseGroup: "finished" }], ["B", { siPurchaseGroup: "other" }]]),
    lines: [...codes.map((productCode, i) => ({ productCode, productName: productCode, price: 100000, quantity: i === 0 ? 2 : 3 })), { productCode: "B", productName: "B", price: 2000000, quantity: 1 }] });
  assert.equal(run(["A", "A"]).canCheckout, true);
  assert.equal(run(["A", "C"]).issues.filter(i => i.code === "quantity").length, 2);
});
test("gift quantities and values cannot satisfy policy; unknown classifications block", () => {
  const result = evaluatePurchasePolicy({ account, policy, history: "new", products: new Map([["A", { siPurchaseGroup: "finished" }]]),
    lines: [{ productCode: "A", productName: "A", price: 10000, quantity: 1 }, { productCode: "A", productName: "Gift", price: 2000000, quantity: 10, isGift: true }] });
  assert.equal(result.subtotal, 10000);
  assert.equal(result.issues.some(i => i.code === "quantity"), true);
  assert.equal(purchaseGroup({ ten: "Cây thô", categoryName: "Chưa phân loại" }), null);
  assert.equal(purchaseGroup({ ancestor: ["CÂY THÀNH PHẨM"], categoryName: "Sen đá" }), "finished");
  assert.equal(purchaseGroup({ ancestor: ["Chậu"], categoryName: "Chậu nhựa" }), "pot");
  assert.equal(purchaseGroup({ ancestor: ["CÂY CẢNH ĐỦ LOẠI", "CÂY THÀNH PHẨM TRỒNG SẴN"] }), "finished");
  assert.equal(purchaseGroup({ ancestor: ["CÂY CẢNH ĐỦ LOẠI"], categoryName: "SEN ĐÁ" }), "raw");
  assert.equal(purchaseGroup({ ancestor: ["PHỤ KIỆN TRANG TRÍ", "PHỤ KIỆN TIỂU CẢNH"] }), "pot");
});

test("inactive or unapproved account cannot pass wholesale checker", () => {
  const result = evaluatePurchasePolicy({ account: { ...account, active: false }, policy, history: "returning", products: new Map(), lines: [] });
  assert.equal(result.canCheckout, false);
  assert.equal(result.issues[0].code, "account");
});

test("accounts with uncertain addresses see prices but require region confirmation before checkout", () => {
  const result = evaluatePurchasePolicy({ account: { ...account, siRegion: null }, policy, history: "new",
    products: new Map([["P", { siPurchaseGroup: "other" }]]),
    lines: [{ productCode: "P", productName: "P", price: 3000000, quantity: 1 }] });
  assert.equal(result.canCheckout, false);
  assert.equal(result.minimum, 0);
  assert.deepEqual(result.issues.map(issue => issue.code), ["region"]);
});

test("customer-arranged HCM transport does not require carrier quote or charge carrier fee", () => {
  const result = checkShippingQuote({ body: { shippingFee: 50000 }, customerArranged: true, deliveryMethod: "giao_tan_noi",
    orderDetails: [], subtotal: 2000000, province: "Hồ Chí Minh", district: "", ward: "Bến Thành" });
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.shippingFee, 0); assert.equal(result.shippingCarrier, undefined); }
});
test("HCM pickup allowed, outside HCM delivery blocked; local address allowed", () => {
  for (const [deliveryMethod, province, allowed] of [["nhan_cua_hang", "", true], ["giao_tan_noi", "Đồng Nai", false], ["giao_tan_noi", "Thành phố Hồ Chí Minh", true]] as const) {
    const result = evaluatePurchasePolicy({ account: { ...account, siRegion: "HCM" }, policy, history: "returning", products: new Map(), lines: [], delivery: { deliveryMethod, province, ward: "Bến Thành" } });
    assert.equal(result.canCheckout, allowed);
  }
});

test("HCM destination uses the old boundary, rejecting merged provinces and ambiguous names", () => {
  const run = (delivery: any) => evaluatePurchasePolicy({ account: { ...account, siRegion: "HCM" },
    policy, history: "returning", products: new Map(), lines: [], delivery });
  for (const ward of ["Lái Thiêu", "Dĩ An", "Vũng Tàu", "Thanh An"]) {
    const result = run({ deliveryMethod: "giao_tan_noi", province: "Hồ Chí Minh", ward });
    assert.equal(result.canCheckout, false, ward);
    assert.ok(result.issues.some(issue => issue.code === "delivery"));
  }
  assert.equal(run({ deliveryMethod: "giao_tan_noi", province: "Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" }).canCheckout, true);
  assert.equal(run({ deliveryMethod: "giao_tan_noi", province: "Hồ Chí Minh", ward: "Bến Thành" }).canCheckout, true);
  assert.equal(run({ deliveryMethod: "nhan_cua_hang", province: "Bình Dương", ward: "Lái Thiêu" }).canCheckout, true);
});
test("KiotViet purchase requires exact customer, completed status, excludes returned/cancelled", () => {
  assert.equal(completedKvPurchase({ customerId: 1, status: 1, total: 10000 }, 1), true);
  for (const row of [{ customerId: 2, status: 1, total: 10000 }, { customerId: 1, status: 2, total: 10000 }, { customerId: 1, status: 1, total: 10000, invoiceDelivery: { status: 5 } }]) assert.equal(completedKvPurchase(row, 1), false);
});
test("web history uses completed non-test orders and excludes the reviewed order", async () => {
  let filter: any;
  const db: any = { collection: () => ({ findOne: async (value: any) => { filter = value; return {}; } }) };
  assert.equal(await purchaseHistory(db, db, account, "CURRENT"), "returning");
  assert.equal(filter.orderStatus, "hoan_thanh");
  assert.deepEqual(filter.isTest, { $ne: true });
  assert.deepEqual(filter.code, { $ne: "CURRENT" });
});
test("shop/admin shared checker reads changed policy and server product groups", async () => {
  const db: any = { collection: (name: string) => ({ findOne: async () => name === "aloha_shop_purchase_policy" ? { rules: { ...policy, tinhMinimum: 3000000 }, version: "changed" } : null,
    find: () => ({ project() { return this; }, toArray: async () => [{ ma: "P", siPurchaseGroup: "other" }] }) }) };
  const result = await checkWholesalePurchase(db, db, account, [{ productCode: "P", productName: "P", price: 2500000, quantity: 1 }]);
  assert.equal(result.canCheckout, false);
  assert.equal(result.remaining, 500000);
  assert.equal(result.policyVersion, "changed");
  assert.equal(purchasePolicySchema.safeParse({ ...policy, finishedQuantity: 0 }).success, false);
});
