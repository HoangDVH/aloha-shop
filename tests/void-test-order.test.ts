import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { voidTestBlockReason, voidTestOrder } from "../backend/shopOrders/voidTestOrder.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { SHOP_COMMISSIONS } from "../backend/shopOrders/commissionModels.js";
import { TEST_MONGO_SKIP, openTestDb, type TestDb } from "./helpers/testMongo.js";

test("VT01: đơn chưa thanh toán / COD / đã huỷ đều huỷ test được", () => {
  for (const paymentStatus of ["unpaid", "cod", "expired", "failed", "cancelled"]) {
    assert.equal(voidTestBlockReason({ paymentStatus, orderStatus: "cho_xac_nhan" }), null, paymentStatus);
  }
});

test("VT02: đã nhận tiền hoặc hàng đã đi thì chặn", () => {
  assert.match(String(voidTestBlockReason({ paymentStatus: "paid" })), /nhận tiền/);
  assert.match(String(voidTestBlockReason({ paymentStatus: "underpaid" })), /nhận tiền/);
  assert.match(String(voidTestBlockReason({ paymentStatus: "unpaid", paidAt: "2026-10-01T00:00:00Z" })), /nhận tiền/);
  assert.match(String(voidTestBlockReason({ paymentStatus: "cod", orderStatus: "dang_giao" })), /giao/);
  assert.match(String(voidTestBlockReason({ paymentStatus: "cod", orderStatus: "hoan_thanh" })), /giao/);
  assert.match(String(voidTestBlockReason({ paymentStatus: "cod", shipment: { status: "created" } })), /vận đơn/);
});

test("VT03: đơn đã huỷ test thì không huỷ lại", () => {
  assert.match(String(voidTestBlockReason({ paymentStatus: "cancelled", voidedTestAt: "x" })), /Đã huỷ/);
});

const KV = "http://kv.mock";
const ENV_KEYS = ["KV_API_URL", "KV_AUTH_URL", "KV_CLIENT_ID", "KV_CLIENT_SECRET", "KV_RETAILER"] as const;
let t: TestDb;
let savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let kvCalls: string[] = [];
let kvFail = false;

before(async () => {
  if (TEST_MONGO_SKIP) return;
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    KV_API_URL: KV,
    KV_AUTH_URL: `${KV}/token`,
    KV_CLIENT_ID: "test",
    KV_CLIENT_SECRET: "test",
    KV_RETAILER: "test",
  });
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (!url.startsWith(KV)) throw new Error(`[test] Chặn request ra ngoài: ${url}`);
    const method = String(init?.method || "GET");
    kvCalls.push(`${method} ${url.slice(KV.length)}`);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/token")) return json({ access_token: "t" });
    if (method === "GET") return json({ id: 123, status: 1 });
    return kvFail ? json({ message: "KV lỗi" }, 500) : json({});
  }) as typeof fetch;
  t = await openTestDb("void_test_order");
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await t?.close();
});

beforeEach(async () => {
  if (TEST_MONGO_SKIP) return;
  kvCalls = [];
  kvFail = false;
  await t.db.collection(SHOP_ORDERS).deleteMany({});
  await t.db.collection(SHOP_COMMISSIONS).deleteMany({});
});

const seed = (extra: Record<string, unknown> = {}) =>
  t.db.collection(SHOP_ORDERS).insertOne({
    id: "WEB-1",
    code: "DH000001",
    kvOrderId: 123,
    kvOrderCode: "DH000001",
    customerNote: "",
    paymentStatus: "unpaid",
    orderStatus: "cho_xac_nhan",
    total: 2700,
    ...extra,
  });

const run = (confirmCode = "dh000001") =>
  voidTestOrder({ shopDb: t.db, mainDb: t.db, ref: "DH000001", confirmCode, actor: "tester" });

test("VT10: sai mã xác nhận thì không gọi KiotViet", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  const r = await run("DH999999");
  assert.equal(r.ok, false);
  assert.equal(kvCalls.length, 0);
  const doc = await t.db.collection(SHOP_ORDERS).findOne({ code: "DH000001" });
  assert.equal(doc?.paymentStatus, "unpaid");
});

test("VT11: huỷ đặt hàng KV, đánh dấu test, huỷ hoa hồng", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  await t.db.collection(SHOP_COMMISSIONS).insertOne({ orderCode: "DH000001", status: "held", amount: 100 });
  const r = await run();
  assert.equal(r.ok, true);
  assert.ok(kvCalls.includes("DELETE /orders/123"));
  const doc = await t.db.collection(SHOP_ORDERS).findOne({ code: "DH000001" });
  assert.equal(doc?.isTest, true);
  assert.equal(doc?.orderStatus, "huy");
  assert.equal(doc?.paymentStatus, "cancelled");
  assert.match(String(doc?.customerNote), /^\[TEST-WEB\]/);
  assert.ok(doc?.voidedTestAt);
  assert.equal(doc?.voidTestLockAt, undefined);
  const com = await t.db.collection(SHOP_COMMISSIONS).findOne({ orderCode: "DH000001" });
  assert.equal(com?.status, "cancelled");
});

test("VT12: đơn đã thanh toán bị chặn, không gọi KiotViet", { skip: TEST_MONGO_SKIP }, async () => {
  await seed({ paymentStatus: "paid" });
  const r = await run();
  assert.equal(r.ok, false);
  assert.equal(kvCalls.length, 0);
});

test("VT13: KiotViet lỗi thì giữ nguyên đơn web và nhả khoá", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  kvFail = true;
  const r = await run();
  assert.equal(r.ok, false);
  const doc = await t.db.collection(SHOP_ORDERS).findOne({ code: "DH000001" });
  assert.equal(doc?.paymentStatus, "unpaid");
  assert.equal(doc?.isTest, undefined);
  assert.equal(doc?.voidTestLockAt, undefined);
});
