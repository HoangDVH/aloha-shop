import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { linesMoneyKey, mapKvOrderDetails, syncShopOrderMoneyFromKv } from "../backend/shopOrders/kvOrderMoneySync.js";
import { kvOrderIdsFromWebhook } from "../backend/shopOrders/kvOrderEditSync.js";
import { SHOP_ORDERS, type ShopOrderDetail } from "../backend/shopOrders/models.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

const line = (productCode: string, price: number, quantity = 1, extra: Partial<ShopOrderDetail> = {}): ShopOrderDetail => ({
  productCode,
  productName: productCode,
  price,
  quantity,
  ...extra,
});

test("KE01: giảm giá dòng KV (theo đơn vị) gộp vào giá bán", () => {
  const { details } = mapKvOrderDetails(
    { orderDetails: [{ productCode: "TPTTCT", price: 850_000, discount: 90_000, quantity: 2 }] },
    []
  );
  assert.equal(details[0].price, 760_000);
  assert.equal(details[0].quantity, 2);
});

test("KE02: phí ship lấy từ orderDelivery.price", () => {
  const { shippingFee } = mapKvOrderDetails(
    { orderDetails: [{ productCode: "A", price: 100_000, quantity: 1 }], orderDelivery: { price: 35_000 } },
    []
  );
  assert.equal(shippingFee, 35_000);
});

test("KE03: chỉ giữ nhãn Flash Sale khi giá KV vẫn đúng giá sale", () => {
  const flash = { campaignId: "c1", counterId: "c1:ALLDAY:A", listPrice: 200_000, salePrice: 150_000 };
  const prev = [line("A", 150_000, 1, { flash })];
  const same = mapKvOrderDetails({ orderDetails: [{ productCode: "A", price: 150_000, quantity: 1 }] }, prev);
  assert.deepEqual(same.details[0].flash, flash);
  const repriced = mapKvOrderDetails({ orderDetails: [{ productCode: "A", price: 200_000, quantity: 1 }] }, prev);
  assert.equal(repriced.details[0].flash, undefined);
});

test("KE04: so dòng không phụ thuộc thứ tự", () => {
  assert.equal(linesMoneyKey([line("A", 1, 2), line("B", 5)]), linesMoneyKey([line("B", 5), line("A", 1, 2)]));
  assert.notEqual(linesMoneyKey([line("A", 1, 2)]), linesMoneyKey([line("A", 1, 3)]));
});

test("KE05: id đơn từ payload webhook order.update, tối đa 50", () => {
  const body = { Notifications: [{ Action: "order.update", Data: [{ Id: 11, Code: "DH1" }, { Id: 12 }, { Id: 11 }] }] };
  assert.deepEqual(kvOrderIdsFromWebhook(body), ["11", "12"]);
  const many = { Notifications: [{ Data: Array.from({ length: 80 }, (_, i) => ({ Id: i + 1 })) }] };
  assert.equal(kvOrderIdsFromWebhook(many).length, 50);
  assert.deepEqual(kvOrderIdsFromWebhook({}), []);
});

let t: TestDb;
let restoreFetch: () => void = () => undefined;

before(async () => {
  if (TEST_MONGO_SKIP) return;
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("kv_order_edit");
});
after(async () => {
  restoreFetch();
  await t?.close();
});
beforeEach(async () => {
  if (TEST_MONGO_SKIP) return;
  await t.db.collection(SHOP_ORDERS).deleteMany({});
});

const baseOrder = (extra: Record<string, unknown> = {}) => ({
  code: "WEB-T1",
  id: "WEB-T1",
  kvOrderId: 501,
  orderStatus: "cho_xac_nhan",
  paymentStatus: "unpaid",
  orderDetails: [line("A", 100_000, 1), line("B", 50_000, 2)],
  subtotal: 200_000,
  discount: 0,
  shippingFee: 0,
  total: 200_000,
  ...extra,
});
const kvOrder = (ship: number, details = [
  { productCode: "B", price: 50_000, quantity: 2 },
  { productCode: "A", price: 100_000, quantity: 1 },
]) => ({ id: 501, discount: 0, orderDetails: details, orderDelivery: { price: ship } });

const sync = (kv: any) =>
  syncShopOrderMoneyFromKv({ shopDb: t.db, mainDb: t.db, orderRef: "WEB-T1", kvOrder: kv, source: "poll" });
const load = () => t.db.collection(SHOP_ORDERS).findOne({ code: "WEB-T1" }) as Promise<any>;

test("KE10: NV đổi phí ship trên KV → đơn web cập nhật + ghi lịch sử", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(SHOP_ORDERS).insertOne(baseOrder());
  const r = await sync(kvOrder(30_000));
  assert.equal(r.changed, true);
  const o = await load();
  assert.equal(o.shippingFee, 30_000);
  assert.equal(o.total, 230_000);
  assert.equal(o.moneyChanges.length, 1);
  assert.deepEqual(o.moneyChanges[0].shippingFee, { from: 0, to: 30_000 });
  assert.equal(o.moneyChanges[0].linesChanged, false);
});

test("KE11: KV trả dòng khác thứ tự, tiền y nguyên → không ghi", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(SHOP_ORDERS).insertOne(baseOrder());
  const r = await sync(kvOrder(0));
  assert.equal(r.skipped, true);
  assert.equal((await load()).moneyChanges, undefined);
});

test("KE12: đơn đã thanh toán, tổng KV khác → không đổi, đánh dấu xung đột", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(SHOP_ORDERS).insertOne(baseOrder({ paymentStatus: "paid", paidAmount: 200_000 }));
  const r = await sync(kvOrder(30_000));
  assert.equal(r.conflict, true);
  const o = await load();
  assert.equal(o.total, 200_000);
  assert.equal(o.shippingFee, 0);
  assert.equal(o.kvMoneyConflict.kvTotal, 230_000);
  // NV sửa lại khớp → xoá cờ xung đột
  await sync(kvOrder(0));
  assert.equal((await load()).kvMoneyConflict, undefined);
});

test("KE13: web đang đẩy/sửa đơn lên KV → bỏ qua", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(SHOP_ORDERS).insertOne(baseOrder({ kvEditLeaseUntil: new Date(Date.now() + 60_000) }));
  const r = await sync(kvOrder(30_000));
  assert.equal(r.skipped, true);
  assert.equal((await load()).shippingFee, 0);
});

test("KE14: đơn hoàn thành / huỷ → bỏ qua", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(SHOP_ORDERS).insertOne(baseOrder({ orderStatus: "hoan_thanh" }));
  const r = await sync(kvOrder(30_000));
  assert.equal(r.skipped, true);
  assert.equal((await load()).total, 200_000);
});
