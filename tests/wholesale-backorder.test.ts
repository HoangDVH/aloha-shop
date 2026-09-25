import test from "node:test";
import assert from "node:assert/strict";
import { isActiveWholesale, stockAllocation, normalizeWholesalePhone, wholesaleMinimum } from "../backend/shopWholesale/policy.js";
import { resolveShopPrice, applyPriceBookOverlay } from "../backend/shopCatalog/priceOverlay.js";
import { applyCatalogPrices } from "../backend/shopOrders/orderRouteShared.js";
import { annotatePreOrderDetails, assertStockAvailable } from "../backend/shopOrders/stockApply.js";
import { createBackorderRequest } from "../backend/shopOrders/backorder.js";
import { markShopOrderPaid } from "../backend/shopOrders/markPaid.js";
import { toVariantModel } from "../backend/shopVariantGroup.js";
import { customerRegion } from "../backend/shopWholesale/kvCustomers.js";
import { canonicalAddress, applicationSchema, addressSchema } from "../backend/shopWholesale/schema.js";
import { findAddressMergerSuggestion } from "../frontend/lib/addressMerger.js";
import { requireShopAuth } from "../backend/shopAuth/routes.js";
import { signShopAccessToken } from "../backend/shopAuth/tokens.js";
import { catalogPriceContext, currentPriceMode } from "../backend/shopWholesale/priceContext.js";
import { accountOwnsPhone, decideWholesalePhoneLink, maskShopEmail, wholesalePhoneVariants } from "../backend/shopWholesale/accountLink.js";

const si = { active: true, roles: ["customer", "si"], siStatus: "active", siRegion: "TINH" };
const line = (qty = 1, code = "P1") => ({ productCode: code, productName: "Chậu", quantity: qty, price: 1 });
function fixtureDb(products: any[] = [], held = 0) {
  const rows: Record<string, any[]> = { aloha_products: products };
  const writes: string[] = [];
  const db: any = { collection(name: string) {
    const list = rows[name] ||= [];
    const cursor: any = { project() { return this; }, limit() { return this; }, toArray: async () => list };
    return {
      find: () => cursor,
      findOne: async (query: any) => name === "aloha_products" ? list.find(p => query.$or.some((clause: any) => clause.ma === p.ma)) || null : list.find(p => Object.entries(query).every(([k, v]) => p[k] === v)) || null,
      insertOne: async (doc: any) => { writes.push(name); doc._id = `${name}-${list.length}`; list.push(doc); return { insertedId: doc._id }; },
      insertMany: async (docs: any[]) => { writes.push(name); list.push(...docs); return { insertedCount: docs.length }; },
      updateMany: async () => ({ modifiedCount: 0 }),
      deleteOne: async (query: any) => { const i = list.findIndex(r => r._id === query._id); if (i >= 0) list.splice(i, 1); },
      aggregate: () => ({ toArray: async () => held ? [{ _id: "P1", qty: held }] : [] }),
    };
  } };
  return { db, rows, writes };
}

for (const status of ["cho_duyet", "tu_choi", "khoa", undefined]) test(`SI-A: status ${status} cannot authorize wholesale`, () => assert.equal(isActiveWholesale({ ...si, siStatus: status }), false));
test("SI-A: CTV alone cannot authorize wholesale; active si+ctv can", () => {
  assert.equal(isActiveWholesale({ ...si, roles: ["ctv"] }), false);
  assert.equal(isActiveWholesale({ ...si, roles: ["ctv", "si"] }), true);
  assert.equal(isActiveWholesale({ ...si, active: false }), false);
});
test("SI-B: wholesale never falls back to retail", () => {
  const p = { giaWeb: 80000, giaBan: 85000, basePrice: 100000 };
  assert.deepEqual(resolveShopPrice(p, "si"), { gia: 0, priceKind: "si_missing" });
  assert.deepEqual(resolveShopPrice(p, "web"), { gia: 80000, priceKind: "web" });
  assert.deepEqual(resolveShopPrice({ ...p, giaSi: 50000 }, "si"), { gia: 50000, priceKind: "si" });
});
test("SI-B: overlay and embedded price books reach variants", () => {
  const p = applyPriceBookOverlay({ ma: "P1", ten: "Chậu", giaWeb: 80000 }, { giaSi: 45000 });
  assert.equal(resolveShopPrice(p, "si").gia, 45000);
  assert.equal(resolveShopPrice({ priceBooks: [{ priceBookName: "Giá sỉ", price: 46000 }] }, "si").gia, 46000);
  const variant = toVariantModel(p, () => ({ ma: "P1", ten: "Chậu", dvt: "cái", ...resolveShopPrice(p, "si"), ton: 1, anh: "", images: [], path: "/sp/p1", allowBackorder: true }));
  assert.equal(variant.priceKind, "si"); assert.equal(variant.allowBackorder, true);
});
for (const [qty, stock, available, pending] of [[10, 1, 1, 9], [5, 0, 0, 5], [1, -2, 0, 1], [3, 3, 3, 0], [2, 5, 2, 0]]) {
  test(`BO-1: request ${qty}, stock ${stock}: ready ${available}, pending ${pending}`, () => {
    const result = stockAllocation(qty, stock);
    assert.equal(result.availableQty, available); assert.equal(result.pendingQty, pending); assert.equal(result.preOrder, pending > 0);
  });
}
for (const qty of [0, -1, 1.5, 10001, NaN, Infinity]) test(`BO-2: rejects invalid quantity ${qty}`, () => assert.throws(() => stockAllocation(qty, 1)));
test("SI-C: minimum uses wholesale subtotal, inclusive threshold, HCM has no minimum", async () => {
  const { db } = fixtureDb([{ ma: "P1", ten: "Chậu", giaSi: 50000, giaWeb: 100000 }]);
  assert.equal(wholesaleMinimum("HCM"), 0);
  assert.equal((await applyCatalogPrices(db, [line(39)], { account: si })).ok, false);
  assert.equal((await applyCatalogPrices(db, [line(40)], { account: si })).ok, true);
  assert.equal((await applyCatalogPrices(db, [line(1)], { account: { ...si, siRegion: "HCM" } })).ok, true);
  const quote = await applyCatalogPrices(db, [line(39)], { account: si, quoteOnly: true });
  assert.equal(quote.ok, true); if (quote.ok) assert.equal(quote.details[0].price, 50000);
});
test("SI-C: missing price blocks order but is explicit in read-only quote", async () => {
  const { db } = fixtureDb([{ ma: "P1", ten: "Chậu", giaWeb: 100000 }]);
  assert.equal((await applyCatalogPrices(db, [line(50)], { account: si })).ok, false);
  const quote = await applyCatalogPrices(db, [line(50)], { account: si, quoteOnly: true });
  assert.equal(quote.ok, true); if (quote.ok) assert.equal(quote.details[0].priceKind, "si_missing");
});
test("BO-3: allocation subtracts active holds and repeated SKU lines", async () => {
  const { db } = fixtureDb([{ ma: "P1", ton: 5, allowBackorder: true }], 2);
  const result = await annotatePreOrderDetails(db, [line(2), line(4)], db);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.details.map(d => [d.availableQty, d.pendingQty]), [[2, 0], [1, 3]]);
  assert.equal((await assertStockAvailable(db, [line(2), line(2)], db)).ok, false);
});
test("BO-4: per-SKU prohibition and inactive products cannot be ordered", async () => {
  for (const product of [{ ma: "P1", ton: 1, allowBackorder: false }, { ma: "P1", ton: 100, isActive: false }]) {
    const { db } = fixtureDb([product]);
    assert.equal((await annotatePreOrderDetails(db, [line(10)], db)).ok, false);
  }
});
test("BO-5: consent required; draft request reserves ready units only; no invoice or payment", async () => {
  const { db, rows, writes } = fixtureDb();
  const details = [{ ...line(10), price: 10000, availableQty: 1, pendingQty: 9, preOrder: true }];
  const input = { userId: "U1", account: { email: "fixture@example.invalid" }, body: { idempotencyKey: "same-attempt", customerName: "Fixture", customerPhone: "0900000000" }, details };
  assert.equal((await createBackorderRequest(db, input)).status, 409);
  assert.equal(writes.length, 0);
  const result = await createBackorderRequest(db, { ...input, body: { ...input.body, backorderAccepted: true } });
  assert.equal(result.status, 201);
  const order = rows.aloha_shop_orders[0];
  assert.equal(order.method, "Pending"); assert.equal(order.totalPayment, 0); assert.equal(order.paymentStatus, "unpaid");
  assert.equal(order.backorderStatus, "pending_confirmation"); assert.equal(order.kvInvoiceId, undefined);
  assert.equal(rows.aloha_shop_stock_holds[0].qty, 1);
  assert.deepEqual(writes, ["aloha_shop_orders", "aloha_shop_stock_holds"]);
  const retry = await createBackorderRequest(db, { ...input, body: { ...input.body, backorderAccepted: true } });
  assert.equal(retry.status, 200); assert.equal(rows.aloha_shop_orders.length, 1); assert.equal(rows.aloha_shop_stock_holds.length, 1);
});
test("BO-6: awaiting KV link is saved without an anonymous KV invoice", async () => {
  const { db, rows } = fixtureDb();
  const result = await createBackorderRequest(db, { userId: "U1", account: si, body: { idempotencyKey: "link", customerName: "Fixture", customerPhone: "0900000000" }, details: [{ ...line(40), price: 50000, availableQty: 40, pendingQty: 0 }] });
  assert.equal(result.status, 201); assert.equal(rows.aloha_shop_orders[0].kvPushStatus, "awaiting_customer_link");
});
test("BO-7: hold failure rolls back the order", async () => {
  const f = fixtureDb(); const original = f.db.collection;
  f.db.collection = (name: string) => { const col = original(name); if (name === "aloha_shop_stock_holds") col.insertMany = async () => { throw new Error("fixture unavailable"); }; return col; };
  await assert.rejects(() => createBackorderRequest(f.db, { userId: "U1", account: si, body: { idempotencyKey: "fail", backorderAccepted: true }, details: [{ ...line(2), price: 10, availableQty: 1, pendingQty: 1, preOrder: true }] }));
  assert.equal(f.rows.aloha_shop_orders.length, 0);
});
for (const status of ["pending_confirmation", "awaiting_customer", "awaiting_payment", "deposit_received"]) test(`BO-8: legacy paid action cannot bypass ${status}`, async () => {
  const db: any = { collection: () => ({ findOne: async () => ({ _id: "1", code: "WEB-X", backorderStatus: status, method: "Pending", paymentStatus: "unpaid" }) }) };
  const result = await markShopOrderPaid({ shopDb: db, mainDb: db, orderCode: "WEB-X", source: "admin" });
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "backorder_manual_review");
});
test("SI-D: phone normalization, address house numbers and mandatory terms", () => {
  assert.equal(normalizeWholesalePhone("+84 912 345 678"), "0912345678");
  assert.notEqual(canonicalAddress({ province: "HCM", ward: "A", detail: "12/3 Lê Lợi" }), canonicalAddress({ province: "HCM", ward: "A", detail: "123 Lê Lợi" }));
  assert.equal(applicationSchema.safeParse({ phone: "0912345678", province: "HCM", ward: "AA", detail: "123", fullName: "Fixture", lookupId: "878e0d09-7b4e-4699-865b-91c55a550321", acceptedTerms: false }).success, false);
});
test("SI-D: KV group IDs and groups string both resolve wholesale region", () => {
  process.env.KV_GROUP_ID_SI_HCM = "13004";
  process.env.KV_GROUP_ID_SI_TINH = "22";
  assert.equal(customerRegion({ customerGroupDetails: [{ id: 999, groupId: 13004 }] }), "HCM");
  assert.equal(customerRegion({ groups: "KHÁCH SỈ - HCM" }), "HCM");
  assert.equal(customerRegion({ groups: "KHÁCH SỈ - TỈNH" }), "TINH");
  assert.equal(customerRegion({ groups: "XÓA 3|SÀN THƯƠNG MẠI" }), null);
  assert.equal(customerRegion({ confirmedGroupIds: [13004, 22] }), null);
  assert.equal(customerRegion({ groups: "KHÁCH SỈ - HCM", confirmedGroupIds: ["22"] }), null);
});
test("SI-D: normalizeWholesalePhone covers +84 and spaced input used by KV lookup", () => {
  assert.equal(normalizeWholesalePhone("+84 337 095 980"), "0337095980");
  assert.equal(normalizeWholesalePhone("0337-095-980"), "0337095980");
  assert.equal(normalizeWholesalePhone(""), "");
});
test("SI-E: password reset invalidates an existing access token", async () => {
  const token = signShopAccessToken({ sub: "u", roles: ["customer"], email: "fixture@example.invalid" });
  const db: any = { collection: () => ({ findOne: async () => ({ ...si, authInvalidBefore: Math.floor(Date.now() / 1000) + 10 }) }) };
  let status = 0, next = false;
  const res: any = { status(code: number) { status = code; return this; }, json() { return this; } };
  await requireShopAuth(async () => db)({ cookies: { shop_access: token }, headers: {} } as any, res, () => { next = true; });
  assert.equal(status, 401); assert.equal(next, false);
});
test("SI-F: simultaneous web and si requests keep pricing contexts isolated", async () => {
  const token = signShopAccessToken({ sub: "u", roles: ["si"], email: "fixture@example.invalid" });
  const db: any = { collection: () => ({ findOne: async () => si }) };
  const modes = await Promise.all([true, false, true, false].map((privateMode, index) => new Promise<string>((resolve, reject) => {
    const res: any = { setHeader() { return this; }, vary() {} };
    void catalogPriceContext(async () => db)({ cookies: privateMode ? { shop_access: token } : {} } as any, res, () => {
      setTimeout(() => resolve(currentPriceMode()), 12 - index);
    }).catch(reject);
  })));
  assert.deepEqual(modes, ["si", "web", "si", "web"]);
});
test("SI-G: address canonicalization normalizes tone marks and casing", () => {
  assert.equal(canonicalAddress({ province: "Hồ Chí Minh", ward: "Xã Phong Phú", detail: "Ấp 4" }),
    canonicalAddress({ province: "ho chi minh", ward: "xa phong phu", detail: "ap 4" }));
});
test("SI-H: addressSchema accepts optional district and validates phone", () => {
  const parsed = addressSchema.parse({
    phone: "0909609521",
    province: "Bình Dương",
    district: "Thành phố Thuận An",
    ward: "Phường Lái Thiêu",
    detail: "16/A Bình Hòa",
  });
  assert.equal(parsed.district, "Thành phố Thuận An");
  assert.equal(parsed.phone, "0909609521");
});
test("SI-I: administrative merger detection detects old merger divisions", () => {
  // Test Quận 2, Quận 9, Quận Thủ Đức -> Thành Phố Thủ Đức
  const suggestion = findAddressMergerSuggestion({
    province: "Hồ Chí Minh",
    district: "Quận 2",
    detail: "16/A Thảo Điền",
  });
  assert.ok(suggestion);
  assert.equal(suggestion?.effectiveDate, "01/01/2021");
  assert.equal(suggestion?.suggest.displayText, "Thành Phố Thủ Đức - Thành phố Hồ Chí Minh");
});

test("SI-J: lookup recognizes existing KV wholesale customer vs non-si vs new", async () => {
  process.env.KV_GROUP_ID_SI_HCM = "13004";
  process.env.KV_GROUP_ID_SI_TINH = "22";

  // Mock dữ liệu khách hàng từ KiotViet
  const kvOldWholesaleCustomer = {
    id: 1001,
    code: "KH001",
    name: "Đại lý Cây Cảnh Xanh",
    contactNumber: "0909123456",
    address: "123 Nguyễn Huệ",
    locationName: "Quận 1, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Nghé",
    groups: "KHÁCH SỈ - HCM",
  };

  const kvRetailCustomer = {
    id: 1002,
    code: "KH002",
    name: "Khách lẻ",
    contactNumber: "0909999888",
    address: "456 Lê Lợi",
    locationName: "Quận 1, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Nghé",
    groups: "SÀN THƯƠNG MẠI",
  };

  // Helper mô phỏng logic phân loại kết quả lookup trong backend/shopWholesale/routes.ts
  function evaluateLookup(foundCustomers: any[], inputAddress: { province: string; ward: string; detail: string }) {
    if (!foundCustomers.length) return "not_found";
    if (foundCustomers.length !== 1) return "manual_review";
    const candidate = foundCustomers[0];
    const isWholesale = customerRegion(candidate) !== null;
    return !isWholesale ? "existing_non_si" : "existing_si_candidate";
  }

  // TH 1: Khách sỉ cũ có SĐT thuộc nhóm sỉ trên KiotViet -> Nhận diện ngay là khách sỉ cũ (kể cả địa chỉ kho nhập khác format)
  const res1 = evaluateLookup([kvOldWholesaleCustomer], {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Bến Nghé",
    detail: "123 Nguyễn Huệ",
  });
  assert.equal(res1, "existing_si_candidate");

  // TH 2: Khách sỉ cũ trên KiotViet dù nhập địa chỉ kho mới -> Vẫn nhận diện là khách sỉ cũ dựa trên SĐT & nhóm sỉ KV
  const res2 = evaluateLookup([kvOldWholesaleCustomer], {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Đa Kao",
    detail: "789 Hai Bà Trưng",
  });
  assert.equal(res2, "existing_si_candidate");

  // TH 3: Khách có trên KiotViet nhưng là khách lẻ, chưa từng vào nhóm sỉ
  const res3 = evaluateLookup([kvRetailCustomer], {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Bến Nghé",
    detail: "456 Lê Lợi",
  });
  assert.equal(res3, "existing_non_si");

  // TH 4: Khách hoàn toàn mới, chưa từng có trên KiotViet
  const res4 = evaluateLookup([], {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Bến Nghé",
    detail: "100 Đồng Khởi",
  });
  assert.equal(res4, "not_found");
});

test("SI-K: phone variants and ownership", () => {
  assert.deepEqual(wholesalePhoneVariants("0337095980"), ["0337095980", "84337095980", "+84337095980"]);
  assert.equal(accountOwnsPhone({ phone: "+84337095980" }, "0337095980"), true);
  assert.equal(accountOwnsPhone({ phone: "0900000000" }, "0337095980"), false);
  assert.equal(maskShopEmail("dauvuhoang01@gmail.com"), "d***@gmail.com");
});

test("SI-K: logged-in phone owner keeps the same account", () => {
  assert.deepEqual(decideWholesalePhoneLink({
    sessionAccountId: "acc-1",
    ownerIds: ["acc-1"],
    maskedEmail: "d***@gmail.com",
  }), { action: "use_current" });
});

test("SI-K: logged-out visitor must sign in to the account that already owns the phone", () => {
  assert.deepEqual(decideWholesalePhoneLink({
    sessionAccountId: null,
    ownerIds: ["acc-1"],
    maskedEmail: "d***@gmail.com",
  }), { action: "login_required", maskedEmail: "d***@gmail.com" });
});

test("SI-K: a different logged-in account cannot take the phone", () => {
  assert.deepEqual(decideWholesalePhoneLink({
    sessionAccountId: "acc-2",
    ownerIds: ["acc-1"],
    maskedEmail: "d***@gmail.com",
  }), { action: "switch_account", maskedEmail: "d***@gmail.com" });
});

test("SI-K: a free phone creates an account only when nobody is logged in", () => {
  assert.equal(decideWholesalePhoneLink({ sessionAccountId: null, ownerIds: [], maskedEmail: null }).action, "create");
  assert.equal(decideWholesalePhoneLink({ sessionAccountId: "acc-2", ownerIds: [], maskedEmail: null }).action, "use_current");
});




