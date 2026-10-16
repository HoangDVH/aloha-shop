import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import { configureTrustedProxy } from "../backend/trustedProxy.js";
import { clientIpFromReq, rateLimitAllow } from "../backend/shopRateLimit.js";
import { boundedHistory, prepareWholesaleHistory, preparedWholesaleHistory } from "../backend/shopOrders/wholesalePreflight.js";
import { checkWholesalePurchase } from "../backend/shopWholesale/purchaseCheck.js";
import { promotionReviewRequest } from "../backend/shopPromotions/reviewRequest.js";
import { ensureRedemptionIndexes } from "../backend/shopPromotions/voucherHistory.js";

function resolvedIp(peer: string, forwarded: string, proxies?: string) {
  const app = express(); configureTrustedProxy(app, proxies);
  const req = Object.create(app.request);
  Object.assign(req, { app, headers: { "x-forwarded-for": forwarded }, socket: { remoteAddress: peer } });
  return clientIpFromReq(req);
}
test("trusted nginx resolves rightmost untrusted peer; attacker prefixes cannot rotate IP", () => {
  for (const fake of ["1.1.1.1", "2.2.2.2", "3.3.3.3, 4.4.4.4"]) {
    assert.equal(resolvedIp("127.0.0.1", `${fake}, 203.0.113.9`), "203.0.113.9");
  }
  assert.equal(resolvedIp("203.0.113.9", "1.1.1.1"), "203.0.113.9");
  assert.equal(resolvedIp("127.0.0.1", "1.1.1.1", ""), "127.0.0.1");
  assert.equal(clientIpFromReq({ headers: { "x-forwarded-for": "fake" }, ip: "real" }), "real");
});
test("rotating forwarded headers shares one login quota, including concurrent requests", async () => {
  const key = `regression:${Date.now()}:`;
  const allowed = await Promise.all(Array.from({ length: 40 }, (_, i) => rateLimitAllow(
    key + resolvedIp("127.0.0.1", `198.51.100.${i}, 203.0.113.9`), 5, 60_000)));
  assert.equal(allowed.filter(Boolean).length, 5);
  for (const path of ["backend/auth/routes.ts", "backend/shopAuth/routes.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /clientIpFromReq as clientIp/);
    assert.doesNotMatch(source, /headers\["x-forwarded-for"\]/);
  }
});
test("history deadline aborts lookup and returns unknown, never an exemption", async () => {
  let signal: AbortSignal | undefined;
  assert.equal(await boundedHistory(s => { signal = s; return new Promise(() => {}); }, 20), "unknown");
  assert.equal(signal!.aborted, true);
  assert.equal(await boundedHistory(async () => { throw Error("outage"); }), "unknown");
  assert.equal(await boundedHistory(async () => "returning"), "returning");
});
test("preflight stores only server-derived history; account changes invalidate it", async () => {
  const account = { _id: "retail", roles: ["kh_le"] };
  const db: any = { collection: () => ({ findOne: async () => account }) };
  const res: any = { locals: {} };
  let proceeded = false;
  await prepareWholesaleHistory(async () => db, async () => { throw Error("retail must not call KV"); })(
    { shopAuth: { userId: "retail" }, body: { items: [{ quantity: 1 }], wholesaleHistory: "returning" } } as any,
    res, () => { proceeded = true; });
  assert.equal(proceeded, true);
  assert.equal(preparedWholesaleHistory(res, account), "new");
  assert.equal(preparedWholesaleHistory(res, { ...account, kvCustomerId: 123 }), null);
  const source = readFileSync("backend/shopOrders/orderCreateRoutes.ts", "utf8");
  assert.ok(source.indexOf("    prepareWholesaleHistory(") < source.indexOf("    serializeShopCheckout("));
});
test("pending wholesale history does not delay another customer's entry into checkout", async () => {
  let finish!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  const db: any = { collection: (name: string) => ({ findOne: async (query: any) => {
    if (name === "aloha_shop_orders") { started(); await waiting; return {}; }
    return { _id: query._id, roles: ["si"], siStatus: "active", siRegion: query._id === "slow" ? "HCM" : "TINH" };
  } }) };
  const middleware = prepareWholesaleHistory(async () => db, async () => db);
  const order: string[] = [];
  const run = (id: string) => middleware({ shopAuth: { userId: id }, body: { items: [{ quantity: 1 }] } } as any,
    response(), () => { order.push(id); });
  const slow = run("slow");
  await entered;
  await run("fast");
  assert.deepEqual(order, ["fast"]);
  finish(); await slow;
  assert.deepEqual(order, ["fast", "slow"]);
});
test("locked checker uses prepared history and reloads policy without calling ops/KV", async () => {
  const db: any = { collection: () => ({ findOne: async () => null,
    find: () => ({ project() { return this; }, toArray: async () => [{ ma: "P", siPurchaseGroup: "other" }] }) }) };
  const ops: any = { collection: () => { throw Error("external lookup inside lock"); } };
  const account = { _id: "x", active: true, roles: ["si"], siStatus: "active", siRegion: "HCM", kvCustomerId: 1 };
  const lines = [{ productCode: "P", productName: "P", quantity: 1, price: 1000 }];
  assert.equal((await checkWholesalePurchase(db, ops, account, lines, undefined, undefined, "returning")).canCheckout, true);
  assert.equal((await checkWholesalePurchase(db, ops, account, lines, undefined, undefined, "unknown")).canCheckout, false);
});

function response(): any {
  return { statusCode: 200, locals: {}, status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; }, setHeader() {} };
}
test("review endpoint rejects anonymous, invalid input and other people's orders", async () => {
  let queries = 0;
  const handler = promotionReviewRequest(async () => ({ collection: () => ({ findOne: async (filter: any) => {
    queries++; assert.equal(filter.shopAccountId, "real"); return null;
  } }) }) as any);
  for (const [req, code] of [
    [{ body: { orderId: "X" } }, 401],
    [{ shopAuth: { userId: "real" }, body: { orderId: { $ne: null } } }, 400],
    [{ shopAuth: { userId: "real" }, body: { orderId: "X", accountId: "victim" } }, 404],
  ] as const) {
    const res = response(); await handler(req as any, res); assert.equal(res.statusCode, code);
  }
  assert.equal(queries, 1);
  const source = readFileSync("backend/shopPromotions/publicRoutes.ts", "utf8");
  assert.match(source, /requireShopAuth\(getShopDb\),\s*promotionReviewRequest/);
});
test("review ignores forged account/phone and saves verified order identity", async () => {
  let inserted: any;
  const db: any = { collection: (name: string) => name === "aloha_shop_orders"
    ? { findOne: async () => ({ code: "ORDER", customerPhone: "0901234567" }) }
    : { countDocuments: async () => 0, insertOne: async (doc: any) => { inserted = doc; } } };
  const res = response();
  await promotionReviewRequest(async () => db)({ shopAuth: { userId: "owned" },
    body: { orderId: "ORDER", accountId: "victim", buyerPhone: "0999999999" } } as any, res);
  assert.equal(res.statusCode, 200);
  assert.equal(inserted.accountId, "owned");
  assert.equal(inserted.orderId, "ORDER");
  assert.notEqual(inserted.buyerPhoneNormalized, "0999999999");
});
test("indexes cover checkout identity OR arms, order transitions and expiry", async () => {
  const indexes: any[] = [];
  await ensureRedemptionIndexes({ collection: (name: string) => ({ createIndex: async (spec: any) => { indexes.push([name, spec]); } }) } as any);
  const specs = indexes.filter(([name]) => name === "aloha_shop_promotion_redemptions").map(([, spec]) => spec);
  for (const spec of [{ orderCode: 1, status: 1 }, { status: 1, expiresAt: 1 },
    ...["buyerId", "buyerPhone", "buyerEmail"].map(key => ({ [key]: 1, promotionId: 1, status: 1 }))]) {
    assert.ok(specs.some(s => JSON.stringify(s) === JSON.stringify(spec)), JSON.stringify(spec));
  }
});
test("concurrent review submissions cannot exceed the account request cap", async () => {
  let inserted = 0;
  const db: any = { collection: (name: string) => name === "aloha_shop_orders"
    ? { findOne: async () => ({ code: "ORDER", customerPhone: "0901234567" }) }
    : { countDocuments: async () => 0, insertOne: async () => { inserted++; } } };
  const statuses = await Promise.all(Array.from({ length: 10 }, async () => {
    const res = response(); await promotionReviewRequest(async () => db)({ shopAuth: { userId: "parallel-review" }, body: { orderId: "ORDER" } } as any, res);
    return res.statusCode;
  }));
  assert.equal(inserted, 3);
  assert.equal(statuses.filter(code => code === 429).length, 7);
});
