import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";

// Chặn mọi gọi mạng thật: chỉ trả lời host .invalid, còn lại ném lỗi.
const FAKE_ENV: Record<string, string> = {
  KV_CLIENT_ID: "test-client",
  KV_CLIENT_SECRET: "test-secret",
  KV_RETAILER: "test-retailer",
  KV_AUTH_URL: "https://kv-auth.invalid/connect/token",
  KV_API_URL: "https://kv-api.invalid",
  SHOP_KV_BRANCH_ID: "1",
  SHOP_KV_SOLD_BY_ID: "2",
  SHOP_KV_SALE_CHANNEL_ID: "3",
  SHOP_KV_SHIP_PRODUCT_CODE: "",
  SHOP_KV_SURCHARGE_ID: "",
  SHOP_KV_ACCOUNT_ID: "",
};

const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const posted: Array<{ path: string; body: any }> = [];

before(() => {
  for (const [k, v] of Object.entries(FAKE_ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = new URL(String(input));
    if (!url.hostname.endsWith(".invalid")) {
      throw new Error(`Test chặn gọi mạng thật: ${url.hostname}`);
    }
    if (url.hostname.startsWith("kv-auth")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), { status: 200 });
    }
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    posted.push({ path: url.pathname, body });
    return new Response(JSON.stringify({ id: 9001, code: "DH_TEST" }), { status: 200 });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const fakeDb = { databaseName: "test" } as unknown as Db;
const DETAILS = [
  { productCode: "SP1", productName: "Chậu", quantity: 2, price: 150_000, discount: 20_000 },
  { productCode: "SP2", productName: "Đất", quantity: 1, price: 200_000, discount: 30_000 },
];

/** Cùng công thức với orderCreateRoutes: phí gửi KV = phí gốc − hỗ trợ ship. */
function charged(fee: number, shipDiscount: number) {
  return Math.max(0, fee - shipDiscount);
}

test("KV15a: Đặt hàng KV (COD) ghi phí ship sau giảm vào orderDelivery.price", async () => {
  const { pushShopOrderToKiotViet } = await import("../backend/shopOrders/kvPush.js");
  posted.length = 0;
  await pushShopOrderToKiotViet(fakeDb, {
    customerName: "Khách test",
    customerPhone: "0900000000",
    address: "1 Test, Quận 1, Hồ Chí Minh",
    orderDetails: DETAILS,
    usingCod: true,
    method: "Cash",
    description: "[TEST-WEB] ship voucher",
    totalPayment: 0,
    shippingFee: charged(45_000, 30_000),
    discount: 50_000,
  });
  const call = posted.find((p) => p.path === "/orders");
  assert.ok(call, "phải POST /orders");
  assert.equal(call.body.orderDelivery.price, 15_000);
  assert.equal(call.body.discount, 50_000);
  // Giảm cấp đơn đã gửi riêng → dòng hàng không gửi lại phần giảm phân bổ.
  assert.deepEqual(call.body.orderDetails.map((d: any) => d.discount), [0, 0]);
  assert.ok(!call.body.orderDetails.some((d: any) => /ship|van chuyen/i.test(d.productName)));
});

test("KV15b: hỗ trợ ship phủ hết phí → KV không ghi phí giao", async () => {
  const { pushShopOrderToKiotViet } = await import("../backend/shopOrders/kvPush.js");
  posted.length = 0;
  await pushShopOrderToKiotViet(fakeDb, {
    customerName: "Khách test",
    customerPhone: "0900000000",
    address: "1 Test, Quận 1, Hồ Chí Minh",
    orderDetails: DETAILS,
    usingCod: true,
    method: "Cash",
    description: "[TEST-WEB] ship voucher",
    totalPayment: 0,
    shippingFee: charged(18_000, 18_000),
  });
  const call = posted.find((p) => p.path === "/orders");
  assert.ok(call);
  assert.equal(call.body.orderDelivery.price, undefined);
});

test("KV15c: HĐ chờ CK ghi phí ship sau giảm, không cộng thêm dòng hay phụ phí", async () => {
  const { pushShopInvoiceToKiotViet } = await import("../backend/shopOrders/kvPush.js");
  posted.length = 0;
  await pushShopInvoiceToKiotViet(fakeDb, {
    customerName: "Khách test",
    customerPhone: "0900000000",
    address: "1 Test, Quận 1, Hồ Chí Minh",
    orderDetails: DETAILS,
    usingCod: false,
    method: "Transfer",
    description: "[TEST-WEB] ship voucher",
    totalPayment: 465_000,
    shippingFee: charged(45_000, 30_000),
    awaitingBankTransfer: true,
  });
  const call = posted.find((p) => p.path === "/invoices");
  assert.ok(call, "phải POST /invoices");
  assert.equal(call.body.invoiceDelivery.price, 15_000);
  assert.equal(call.body.invoiceOrderSurcharges, undefined);
  assert.equal(call.body.totalPayment, 0);
  const goods = call.body.invoiceDetails.reduce(
    (s: number, d: any) => s + d.price * d.quantity - (d.discount || 0),
    0
  );
  // Tiền hàng sau giảm + phí ship sau giảm = tổng web.
  assert.equal(goods + call.body.invoiceDelivery.price, 465_000);
});

test("KV15d: HĐ có mã SP phí ship → dòng phí ship dùng số sau giảm", async () => {
  const { pushShopInvoiceToKiotViet } = await import("../backend/shopOrders/kvPush.js");
  process.env.SHOP_KV_SHIP_PRODUCT_CODE = "PHISHIP";
  posted.length = 0;
  try {
    await pushShopInvoiceToKiotViet(fakeDb, {
      customerName: "Khách test",
      customerPhone: "0900000000",
      address: "1 Test, Quận 1, Hồ Chí Minh",
      orderDetails: DETAILS,
      usingCod: false,
      method: "Transfer",
      description: "[TEST-WEB] ship voucher",
      totalPayment: 465_000,
      shippingFee: charged(45_000, 30_000),
    });
  } finally {
    process.env.SHOP_KV_SHIP_PRODUCT_CODE = "";
  }
  const call = posted.find((p) => p.path === "/invoices");
  assert.ok(call);
  const shipLines = call.body.invoiceDetails.filter((d: any) => d.productCode === "PHISHIP");
  assert.equal(shipLines.length, 1);
  assert.equal(shipLines[0].price, 15_000);
  assert.equal(call.body.invoiceDelivery, undefined);
});
