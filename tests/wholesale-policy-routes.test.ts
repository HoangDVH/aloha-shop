import test from "node:test";
import assert from "node:assert/strict";
import { registerShopCartQuote } from "../backend/shopWholesale/quote.js";
import { registerPurchasePolicyRoutes } from "../backend/shopWholesale/purchaseAdmin.js";
import { defaultPurchasePolicy } from "../backend/shopWholesale/purchasePolicy.js";

function fixture() {
  const handlers = new Map<string, any[]>();
  let config: any = null;
  const account = { _id: "buyer", active: true, roles: ["si"], siStatus: "active", siRegion: "TINH" };
  const product = { ma: "P", ten: "Cây thành phẩm", giaSi: 500000, siPurchaseGroup: "finished" };
  const db: any = { collection(name: string) {
    return { findOne: async () => name === "aloha_shop_purchase_policy" ? config : name === "aloha_shop_accounts" ? account : name === "aloha_products" ? product : null,
      find: () => ({ project() { return this; }, limit() { return this; }, toArray: async () => name === "aloha_products" ? [product] : [] }),
      createIndex: async () => "index", updateOne: async (filter: any, update: any) => {
        if (name === "aloha_shop_purchase_policy") {
          if (config && filter.version !== config.version) throw Object.assign(new Error("duplicate"), { code: 11000 });
          config = { ...update.$set }; return { modifiedCount: 1 };
        }
        return { matchedCount: 1 };
      } };
  } };
  const app: any = { use() {}, get(path: string, ...fns: any[]) { handlers.set(`GET ${path}`, fns); },
    post(path: string, ...fns: any[]) { handlers.set(`POST ${path}`, fns); }, patch(path: string, ...fns: any[]) { handlers.set(`PATCH ${path}`, fns); } };
  registerShopCartQuote(app, async () => db, async () => db);
  registerPurchasePolicyRoutes(app, async () => db, async () => db);
  async function call(method: string, path: string, body: any = {}) {
    let status = 200; let data: any;
    const req = { body, headers: {}, params: {}, ip: "policy-fixture", shopAuth: { userId: "buyer" }, auth: { userId: "admin" } };
    const res = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: any) { data = value; }, sendStatus(value: number) { status = value; } };
    await handlers.get(`${method} ${path}`)!.at(-1)(req, res);
    return { status, data };
  }
  return { call, handlers, product, account };
}

test("shop and admin APIs return identical purchase issues for the same priced cart", async () => {
  const h = fixture();
  const items = [{ productCode: "P", quantity: 4 }];
  const shop = await h.call("POST", "/api/shop/cart/quote", { items });
  const admin = await h.call("POST", "/api/shop/admin/wholesale-policy/check", { items, accountId: "buyer" });
  assert.equal(shop.status, 200);
  assert.equal(admin.status, 200);
  assert.equal(shop.data.canCheckout, false);
  assert.deepEqual(shop.data.issues, admin.data.issues);
  assert.equal(shop.data.issues[0].code, "quantity");
  assert.equal(h.handlers.get("POST /api/shop/admin/wholesale-policy/check")!.length, 4);
  assert.equal((await h.call("POST", "/api/shop/cart/quote", { items: [{ productCode: "P", quantity: 5 }] })).data.canCheckout, true);
});

test("policy saved in admin is immediately used by shop and public policy; stale updates rejected", async () => {
  const h = fixture();
  const before = await h.call("GET", "/api/shop/wholesale-policy");
  const saved = await h.call("PATCH", "/api/shop/admin/wholesale-policy", { version: before.data.version, rules: { ...defaultPurchasePolicy, finishedQuantity: 6 } });
  assert.equal(saved.status, 200);
  assert.equal((await h.call("GET", "/api/shop/wholesale-policy")).data.finishedQuantity, 6);
  assert.equal((await h.call("POST", "/api/shop/cart/quote", { items: [{ productCode: "P", quantity: 5 }] })).data.canCheckout, false);
  assert.equal((await h.call("PATCH", "/api/shop/admin/wholesale-policy", { version: before.data.version, rules: defaultPurchasePolicy })).status, 409);
});

test("shop and admin retain full destination and consistently enforce old HCM boundary", async () => {
  const h = fixture(); h.account.siRegion = "HCM";
  for (const ward of ["Bến Thành", "Lái Thiêu"]) {
    const input = { items: [{ productCode: "P", quantity: 5 }], deliveryMethod: "giao_tan_noi", province: "Hồ Chí Minh", ward };
    const shop = await h.call("POST", "/api/shop/cart/quote", input);
    const admin = await h.call("POST", "/api/shop/admin/wholesale-policy/check", { ...input, accountId: "buyer" });
    assert.equal(shop.status, 200); assert.equal(admin.status, 200);
    assert.equal(shop.data.canCheckout, ward === "Bến Thành");
    assert.deepEqual(shop.data.issues, admin.data.issues);
  }
});
