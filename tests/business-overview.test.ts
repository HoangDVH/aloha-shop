import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { MongoClient, type Db } from "mongodb";
import { saleValue, summarizeSales, comparisonWindow, businessStats } from "../backend/shopAnalytics/business.js";
import { confirmFunnelOrder, confirmReplayedOrder, funnelInput, funnelStats, FUNNEL, recordFunnelEvent } from "../backend/shopAnalytics/funnel.js";
import { registerOverviewRoutes } from "../backend/shopAnalytics/overviewRoutes.js";
import { visitRange } from "../backend/shopVisits/service.js";
import { signAccessToken } from "../backend/auth/tokens.js";
import { changeText, rate } from "../frontend/lib/businessOverview.js";

const range = visitRange("2026-10-12", "2026-10-12")!;
const order = (extra: Record<string, unknown> = {}) => ({ orderStatus: "hoan_thanh", paymentStatus: "paid", total: 1100,
  shippingFee: 100, orderDetails: [{ productCode: "P", price: 1000, quantity: 1 }], deliveredAt: "2026-10-12T03:00:00Z", ...extra });
test("sales count completed paid shop orders; exclude test, cancelled, unpaid and shipping/gifts", () => {
  assert.equal(saleValue(order()), 1000);
  assert.equal(saleValue(order({ paymentStatus: "cod", totalPayment: 1100 })), 1000);
  for (const extra of [{ isTest: true }, { orderStatus: "huy" }, { orderStatus: "dang_giao" },
    { paymentStatus: "cod" }, { paymentStatus: "failed", totalPayment: 1100 }]) assert.equal(saleValue(order(extra)), null);
  assert.equal(saleValue(order({ orderDetails: [{ isGift: true, price: 100, quantity: 1 }] })), 900);
  assert.equal(saleValue(order({ total: 50 })), 0);
  assert.equal(saleValue(order({ returnedProductCodes: ["P"] })), 1000, "gross sales must not claim to be net of returns");
});
test("Vietnam date/hour grouping has zero buckets, half-open boundaries, fallback dates and correct average", () => {
  const orders = [order(), order({ total: 600 }), order({ deliveredAt: range.end.toISOString() }), order({ deliveredAt: "invalid" }),
    order({ deliveredAt: undefined, createdAt: "2026-10-11T17:30:00Z" }), order({ isTest: true })];
  const result = summarizeSales(orders, range.start, range.end, "hour");
  assert.deepEqual(result.summary, { revenue: 2500, orders: 3, average: 833 });
  assert.equal(result.points.length, 24);
  assert.equal(result.points[0].revenue, 1000);
  assert.equal(result.points[10].revenue, 1500);
  const daily = summarizeSales(orders, range.start, range.end, "day");
  assert.deepEqual(daily.points, [{ key: "2026-10-12", revenue: 2500, orders: 3 }]);
});
test("previous equal-length period ends at the same elapsed time for current periods", () => {
  const w = comparisonWindow(range, new Date("2026-10-12T03:00:00Z"));
  assert.equal(w.previousStart.toISOString(), "2026-10-10T17:00:00.000Z");
  assert.equal(w.previousEnd.toISOString(), "2026-10-11T03:00:00.000Z");
  assert.equal(w.partial, true);
  assert.equal(comparisonWindow(range, new Date("2026-10-13T00:00:00Z")).partial, false);
  assert.equal(rate(0, 0), null);
  assert.equal(changeText(100, 0).direction, 0);
  assert.equal(changeText(80, 100).text, "↓ 20%");
});
test("public events cannot spoof placements; HTTP routes reject bots/origins and require active managers", async () => {
  const identity = { sessionId: randomUUID(), visitorId: randomUUID(), path: "/" };
  assert.equal(funnelInput.safeParse({ ...identity, event: "placed" }).success, false);
  assert.equal(funnelInput.safeParse({ ...identity, event: "cart", orderCode: "fake" }).success, false);
  let user = { username: "employee", role: "staff", active: true }, dbCalls = 0;
  const authDb = { collection: () => ({ findOne: async () => user }) } as unknown as Db;
  const app = express(); app.use(express.json());
  registerOverviewRoutes(app, async () => authDb, async () => { dbCalls++; throw new Error("no DB expected"); });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const token = signAccessToken({ sub: "overview-user", username: "employee", role: "staff" });
  try {
    const get = () => fetch(`${base}/api/shop/admin/business-overview?from=bad&to=bad`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await fetch(`${base}/api/shop/admin/business-overview`)).status, 401);
    assert.equal((await get()).status, 403);
    user = { username: "manager", role: "manager", active: false }; assert.equal((await get()).status, 403);
    user.active = true; assert.equal((await get()).status, 400);
    const post = (path: string, origin: string, ua: string, event = "cart") => fetch(`${base}/api/shop/funnel`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "User-Agent": ua }, body: JSON.stringify({ ...identity, path, event }) });
    assert.equal((await post("/", "https://evil.example", "Mozilla" )).status, 403);
    assert.equal((await post("/admin", "http://localhost:3002", "Mozilla")).status, 204);
    assert.equal((await post("/", "http://localhost:3002", "Googlebot")).status, 204);
    assert.equal((await post("/", "http://localhost:3002", "Mozilla", "placed")).status, 400);
    assert.equal(dbCalls, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("Mongo: concurrent stage events, server placement, test exclusion, ordered stages and period boundaries", { skip: !process.env.SHOP_ANALYTICS_TEST_MONGO_URI }, async () => {
  const client = new MongoClient(process.env.SHOP_ANALYTICS_TEST_MONGO_URI!, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(`aloha_overview_test_${randomUUID().replaceAll("-", "")}`);
  const now = new Date("2026-10-12T03:00:00Z");
  const identity = { sessionId: randomUUID(), visitorId: randomUUID(), path: "/" };
  const savedCart = { sessionId: randomUUID(), visitorId: randomUUID(), path: "/xac-nhan-don-hang" };
  try {
    await Promise.all(Array.from({ length: 8 }, () => recordFunnelEvent(db, { ...identity, event: "cart" }, now)));
    await recordFunnelEvent(db, { ...identity, event: "checkout" }, now);
    await recordFunnelEvent(db, { ...savedCart, event: "checkout" }, now);
    await recordFunnelEvent(db, { ...identity, visitorId: randomUUID(), event: "visit" }, now);
    assert.equal(await db.collection(FUNNEL).countDocuments(), 2);
    const placed = { ...order(), code: "O1", shopAccountId: "A", idempotencyKey: "K", analyticsSessionId: identity.sessionId, analyticsVisitorId: identity.visitorId };
    await db.collection("aloha_shop_orders").insertMany([placed, { ...placed, code: "O2", isTest: true },
      { ...order(), code: "yesterday", deliveredAt: "2026-10-11T02:00:00Z" }]);
    await confirmFunnelOrder(db, placed, now);
    await confirmFunnelOrder(db, placed, new Date(now.getTime() + 60000));
    await confirmReplayedOrder(db, "A", "K");
    assert.equal((await db.collection("aloha_shop_orders").findOne({ code: "O1" }))!.analyticsPlacedAt.toISOString(), now.toISOString());
    await confirmFunnelOrder(db, { ...placed, code: "O2", isTest: true }, now);
    assert.equal((await db.collection("aloha_shop_orders").findOne({ code: "O2" }))!.analyticsPlacedAt, undefined);
    const stats = await funnelStats(db, range);
    assert.equal(stats.visits, 2); assert.equal(stats.cart, 1); assert.equal(stats.checkout, 1); assert.equal(stats.placed, 1);
    assert.deepEqual(stats.transitions, { cart: 1, checkout: 1, placed: 1 });
    const sales = await businessStats(db, range, "hour", new Date("2026-10-12T04:00:00Z"));
    assert.equal(sales.summary.orders, 1); assert.equal(sales.summary.revenue, 1000); assert.equal(sales.previous.orders, 1);
    assert.equal((await funnelStats(db, visitRange("2026-10-11", "2026-10-11")!)).visits, 0);
    const boundary = { sessionId: randomUUID(), visitorId: randomUUID(), path: "/" };
    await recordFunnelEvent(db, { ...boundary, event: "visit" }, range.end);
    assert.equal((await funnelStats(db, range)).visits, 2);
    // A mismatched visitor cannot claim an existing session's cart event.
    await recordFunnelEvent(db, { ...savedCart, visitorId: randomUUID(), event: "cart" }, now);
    assert.equal((await funnelStats(db, range)).cart, 1);
    const app = express();
    const auth = { collection: () => ({ findOne: async () => ({ username: "manager", role: "manager", active: true }) }) } as unknown as Db;
    registerOverviewRoutes(app, async () => auth, async () => db);
    const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const token = signAccessToken({ sub: "overview-user", username: "manager", role: "manager" });
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/shop/admin/business-overview?from=2026-10-12&to=2026-10-12&group=hour`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const body = await response.json();
      assert.equal(body.sales.points.length, 24); assert.equal(body.funnel.visits, 2); assert.equal(body.funnel.placed, 1);
      const invalidGroup = await fetch(url.replace("group=hour", "group=invalid"), { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(invalidGroup.status, 400);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    // Checkout before cart cannot progress the funnel, even with a successful order.
    const lateCart = new Date(now.getTime() + 60000);
    await recordFunnelEvent(db, { ...savedCart, event: "cart" }, lateCart);
    await db.collection("aloha_shop_orders").insertOne({ code: "early", analyticsSessionId: savedCart.sessionId,
      analyticsVisitorId: savedCart.visitorId, analyticsPlacedAt: new Date(now.getTime() + 120000) });
    assert.equal((await funnelStats(db, range)).checkout, 1);
    assert.equal((await funnelStats(db, range)).placed, 1);
    // A later checkout after adding to cart is valid; an earlier order still is not.
    await recordFunnelEvent(db, { ...savedCart, event: "checkout" }, new Date(now.getTime() + 180000));
    assert.equal((await funnelStats(db, range)).checkout, 2);
    assert.equal((await funnelStats(db, range)).placed, 1);
    // Lookup must find a later valid order instead of limiting to the earlier one.
    await db.collection("aloha_shop_orders").insertOne({ code: "later", analyticsSessionId: savedCart.sessionId,
      analyticsVisitorId: savedCart.visitorId, analyticsPlacedAt: new Date(now.getTime() + 240000) });
    const ordered = await funnelStats(db, range);
    assert.equal(ordered.placed, 2);
    assert.ok(ordered.visits >= ordered.cart && ordered.cart >= ordered.checkout && ordered.checkout >= ordered.placed);
  } finally { await db.dropDatabase(); await client.close(); }
});
