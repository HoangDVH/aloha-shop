import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { MongoClient, type Db } from "mongodb";
import { salesLines, rankSales, topSales } from "../backend/shopAnalytics/sales.js";
import { recordProductView, topViews, PRODUCT_VIEWS, productViewInput } from "../backend/shopAnalytics/productViews.js";
import { registerShopAnalyticsRoutes, topQuery } from "../backend/shopAnalytics/routes.js";
import { signAccessToken } from "../backend/auth/tokens.js";
import { chartAxis, chartNumber, topChartRange } from "../frontend/lib/topProductChart.js";

const order = (extra: Record<string, any> = {}) => ({ orderStatus: "hoan_thanh", paymentStatus: "paid", total: 200, shippingFee: 20,
  orderDetails: [{ productCode: "P", productName: "Pot", quantity: 2, price: 100, discount: 20 }], ...extra });
test("net sales excludes freight, applies checkout discount once, excludes gifts and unpaid/cancelled/test orders", () => {
  assert.equal(salesLines(order())[0].revenue, 180);
  assert.equal(salesLines(order({ discount: 20 }))[0].revenue, 180);
  for (const extra of [{ orderStatus: "huy" }, { orderStatus: "dang_giao" }, { paymentStatus: "unpaid", totalPayment: 0 },
    { paymentStatus: "failed", paidAmount: 200 }, { isTest: true }]) assert.deepEqual(salesLines(order(extra)), []);
  assert.deepEqual(salesLines(order({ orderDetails: [{ productCode: "G", quantity: 1, price: 100, isGift: true }] })), []);
  assert.equal(salesLines(order({ total: 200, shippingFee: 0, orderDetails: [{ productCode: "P", quantity: 1, price: 100 },
    { productCode: "G", quantity: 1, price: 100, isGift: true }] }))[0].revenue, 100);
  assert.equal(salesLines(order({ paymentStatus: "cod", totalPayment: 200 }))[0].revenue, 180);
});
test("order-level vouchers allocate by net line weight and never add shipping to product revenue", () => {
  const lines = salesLines(order({ total: 190, shippingFee: 10, discount: 20, orderDetails: [
    { productCode: "P", quantity: 1, price: 100 }, { productCode: "C", quantity: 1, price: 100 },
  ] }));
  assert.deepEqual(lines.map((l: any) => l.revenue), [90, 90]);
  assert.equal(lines.reduce((sum: number, l: any) => sum + l.revenue, 0), 180);
  const odd = salesLines(order({ total: 100, shippingFee: 0, orderDetails: ["A", "B", "C"].map(productCode => ({ productCode, quantity: 1, price: 100 })) }));
  assert.equal(odd.reduce((sum: number, l: any) => sum + l.revenue, 0), 100);
  assert.ok(odd.every((l: any) => Number.isInteger(l.revenue)));
});
test("partial returns subtract quantity/revenue; ambiguous legacy returns fail closed", () => {
  const partial = salesLines(order({ orderDetails: [{ productCode: "P", quantity: 2, price: 100, discount: 20, returnedQuantity: 1 }] }));
  assert.equal(partial[0].quantity, 1); assert.equal(partial[0].revenue, 90);
  assert.deepEqual(salesLines(order({ returnedProductCodes: ["p"], returnedAt: "2026-10-12" })), []);
  assert.deepEqual(salesLines(order({ returnedAt: "2026-10-12" })), []);
});
test("top ranking groups duplicate lines and code aliases by stable ID, preserving distinct unit IDs", () => {
  const products = [{ source: "kiotviet", id: "1", ma: "NEW", kvCodeAliases: ["P"], ten: "Pot", dvt: "CÁI" },
    { source: "kiotviet", id: "2", ma: "BOX", ten: "Pot", dvt: "THÙNG" }];
  const result = rankSales([order(), order({ orderDetails: [{ productCode: "NEW", quantity: 1, price: 100 }, { productCode: "BOX", quantity: 1, price: 100 }] })], products, "quantity");
  assert.equal(result[0].ma, "NEW"); assert.equal(result[0].quantity, 3); assert.equal(result.length, 2);
  assert.deepEqual(rankSales([order({ returnedAt: "2026-10-12", returnedProductCodes: ["NEW"] })], products, "revenue"), []);
  const many = rankSales([order({ orderDetails: Array.from({ length: 15 }, (_, i) => ({ productCode: `P${i}`, quantity: i + 1, price: 100 })) })], [], "quantity");
  assert.equal(many.length, 10); assert.equal(many[0].ma, "P14");
});
test("Vietnam periods cross midnight/year boundaries; axes fit labels and counts stay integer", () => {
  assert.deepEqual(topChartRange("today", new Date("2026-12-31T18:00:00Z")), { from: "2027-01-01", to: "2027-01-01" });
  assert.deepEqual(topChartRange("previousMonth", new Date("2026-01-12T00:00:00Z")), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(topChartRange("previousMonth", new Date("2024-03-01T00:00:00Z")), { from: "2024-02-01", to: "2024-02-29" });
  const axis = chartAxis(18_200_000, false);
  assert.equal(axis.max, 24_000_000); assert.equal(axis.ticks[1], 4_000_000);
  assert.ok(chartAxis(1, true).ticks.every(Number.isInteger)); assert.equal(chartNumber(18_200_000, true), "18,2 tr");
});
test("metrics, dates and tracking identifiers are validated", () => {
  assert.equal(topQuery.safeParse({ kind: "sales", metric: "views", from: "2026-10-01", to: "2026-10-12" }).success, false);
  assert.equal(productViewInput.safeParse({ visitorId: "bad", sessionId: randomUUID(), productCode: "P" }).success, false);
});
test("public tracking rejects off-origin requests/bots; admin rankings require an active manager", async () => {
  const app = express(); app.use(express.json());
  let user = { username: "staff", role: "staff", active: true }, reads = 0;
  const auth = { collection: () => ({ findOne: async () => user }) } as unknown as Db;
  registerShopAnalyticsRoutes(app, async () => auth, async () => { reads++; throw new Error("must not read data"); });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const url = base + "/api/shop/admin/top-products?kind=sales&metric=views&from=bad&to=bad";
    assert.equal((await fetch(url)).status, 401);
    const token = signAccessToken({ sub: "top-test", username: "staff", role: "staff" });
    const request = () => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await request()).status, 403); user = { username: "manager", role: "manager", active: false };
    assert.equal((await request()).status, 403); user.active = true; assert.equal((await request()).status, 400);
    assert.equal((await fetch(base + "/api/shop/product-views", { method: "POST", headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await fetch(base + "/api/shop/product-views", { method: "POST", headers: { "User-Agent": "Googlebot" } })).status, 204);
    assert.equal(reads, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("Mongo: repeated views deduplicate, visitor counts span sessions, sales dates/returns and aliases remain correct", { skip: !process.env.SHOP_ANALYTICS_TEST_MONGO_URI }, async () => {
  const client = await new MongoClient(process.env.SHOP_ANALYTICS_TEST_MONGO_URI!).connect();
  const db = client.db(`aloha_analytics_test_${randomUUID().replaceAll("-", "")}`);
  try {
    await db.collection("aloha_products").insertOne({ ma: "NEW", ten: "Pot", dvt: "CÁI", source: "kiotviet", id: "1", kvCodeAliases: ["OLD"], anh: "/p.jpg" });
    const visitorId = randomUUID(), sessionId = randomUUID(), start = new Date("2026-10-11T17:00:00Z"), end = new Date("2026-10-12T17:00:00Z");
    await Promise.all(Array.from({ length: 10 }, () => recordProductView(db, { visitorId, sessionId, productCode: "OLD" }, start)));
    await recordProductView(db, { visitorId, sessionId: randomUUID(), productCode: "NEW" }, start);
    await recordProductView(db, { visitorId: randomUUID(), sessionId: randomUUID(), productCode: "NEW" }, start);
    assert.equal(await db.collection(PRODUCT_VIEWS).countDocuments({}), 3);
    assert.equal((await topViews(db, start, end, "views")).items[0].value, 3);
    assert.equal((await topViews(db, start, end, "visitors")).items[0].value, 2);
    assert.equal((await topViews(db, end, new Date(end.getTime() + 86400_000), "views")).items.length, 0);
    assert.equal(await recordProductView(db, { visitorId, sessionId, productCode: "MISSING" }), false);
    await db.collection("aloha_shop_orders").insertMany([
      order({ deliveredAt: start.toISOString(), orderDetails: [{ productCode: "OLD", quantity: 2, price: 100, discount: 20 }] }),
      order({ deliveredAt: new Date(start.getTime() - 1), total: 10000 }), order({ deliveredAt: end.toISOString() }),
      order({ deliveredAt: start, paymentStatus: "unpaid" }), order({ deliveredAt: start, returnedProductCodes: ["P"], returnedAt: start }),
    ]);
    const sales = await topSales(db, start, end, "revenue");
    assert.equal(sales.items[0].ma, "NEW"); assert.equal(sales.items[0].value, 180); assert.equal(sales.items.length, 1);
  } finally { await db.dropDatabase(); await client.close(); }
});
