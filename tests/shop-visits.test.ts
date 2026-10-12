import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import { MongoClient, type Db } from "mongodb";
import { signAccessToken } from "../backend/auth/tokens.js";
import { excludedPath, isBot, recordVisit, visitInput, visitRange, visitStats, VISITS } from "../backend/shopVisits/service.js";
import { registerShopVisitRoutes } from "../backend/shopVisits/routes.js";
import { isVisitPage, nextVisitSession, readVisitSession, VISIT_IDLE_MS } from "../frontend/lib/visitSession.js";

test("Vietnam date bounds reject invalid calendar dates and reversed/oversized ranges", () => {
  const range = visitRange("2026-10-12", "2026-10-12")!;
  assert.equal(range.start.toISOString(), "2026-10-11T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-12T17:00:00.000Z");
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-13", "2026-10-12"], ["2024-01-01", "2026-01-01"], ["bad", "bad"]]) {
    assert.equal(visitRange(from, to), null);
  }
  assert.equal(visitRange(["2026-10-12"], "2026-10-12"), null);
});

test("page navigation preserves a visitor/session; 30 minutes idle creates only a new session", () => {
  const first = nextVisitSession(null, 1000, randomUUID);
  const second = nextVisitSession(first, 2000, randomUUID);
  assert.equal(second.sessionId, first.sessionId);
  const later = nextVisitSession(second, 2000 + VISIT_IDLE_MS, randomUUID);
  assert.notEqual(later.sessionId, first.sessionId);
  assert.equal(later.visitorId, first.visitorId);
  assert.equal(later.lastSent, 0);
  assert.equal(readVisitSession("broken"), null);
  assert.equal(readVisitSession('{"visitorId":"fake"}'), null);
  assert.deepEqual(readVisitSession(JSON.stringify(first)), first);
});

test("tracking rejects bad IDs, internal pages and known crawlers", () => {
  assert.equal(visitInput.safeParse({ visitorId: "fake", sessionId: randomUUID(), path: "/" }).success, false);
  assert.equal(visitInput.safeParse({ visitorId: randomUUID(), sessionId: randomUUID(), path: "//other" }).success, false);
  for (const path of ["/admin", "/admin/ctv", "/api/shop", "/_next/static"]) {
    assert.equal(excludedPath(path), true);
    assert.equal(isVisitPage(path), false);
  }
  assert.equal(isVisitPage("/san-pham/cay"), true);
  assert.equal(isBot("Googlebot"), true);
  assert.equal(isBot("Mozilla/5.0 Chrome/130 Safari/537.36"), false);
});

test("HTTP routes protect stats and skip excluded/bot traffic before touching DB", async () => {
  const app = express();
  app.use(express.json());
  let dbCalls = 0;
  const getDb = async (): Promise<never> => { dbCalls++; throw new Error("must not call"); };
  registerShopVisitRoutes(app, getDb, getDb);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/api/shop/admin/visits?from=2026-10-12&to=2026-10-12`)).status, 401);
    const post = (path: string, origin = "http://localhost:3002", ua = "Mozilla/5.0") => fetch(`${base}/api/shop/visits`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "User-Agent": ua },
      body: JSON.stringify({ visitorId: randomUUID(), sessionId: randomUUID(), path }),
    });
    assert.equal((await post("/", "https://evil.example")).status, 403);
    assert.equal((await post("/admin")).status, 204);
    assert.equal((await post("/", "http://localhost:3002", "Googlebot")).status, 204);
    assert.equal(dbCalls, 0);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test("staff/inactive managers cannot read stats; active managers get validated date errors", async () => {
  const app = express();
  let user = { username: "employee", role: "staff", active: true };
  const authDb = { collection: () => ({ findOne: async () => user }) } as unknown as Db;
  registerShopVisitRoutes(app, async () => authDb, async () => { throw new Error("must not read shop DB"); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const token = signAccessToken({ sub: "visit-test-user", username: "employee", role: "staff" });
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/shop/admin/visits?from=invalid&to=invalid`;
  try {
    const request = () => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await request()).status, 403);
    user = { username: "manager", role: "manager", active: false };
    assert.equal((await request()).status, 403);
    user.active = true;
    assert.equal((await request()).status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test("Mongo: concurrent writes deduplicate sessions, unique visitors span days, Redis fallback works", { skip: !process.env.SHOP_VISITS_TEST_MONGO_URI }, async () => {
  const client = new MongoClient(process.env.SHOP_VISITS_TEST_MONGO_URI!, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(`aloha_visits_test_${randomUUID().replaceAll("-", "")}`);
  const previousCache = process.env.CACHE_REDIS_URL;
  delete process.env.CACHE_REDIS_URL;
  try {
    const visitorId = randomUUID(), sessionId = randomUUID();
    const input = { visitorId, sessionId, path: "/" };
    const now = new Date("2026-10-11T17:00:00Z");
    await Promise.all(Array.from({ length: 8 }, () => recordVisit(db, input, now)));
    await recordVisit(db, input, new Date("2026-10-11T17:10:00Z"));
    assert.equal(await db.collection(VISITS).countDocuments(), 1);
    const row = await db.collection(VISITS).findOne({ sessionId });
    assert.equal(row?.startedAt.toISOString(), now.toISOString());
    assert.equal(row?.lastSeenAt.toISOString(), "2026-10-11T17:10:00.000Z");
    await recordVisit(db, { ...input, visitorId: randomUUID() }, now);
    assert.equal(await db.collection(VISITS).countDocuments(), 1);
    await recordVisit(db, { ...input, sessionId: randomUUID() }, new Date("2026-10-12T17:00:00Z"));
    await recordVisit(db, { visitorId: randomUUID(), sessionId: randomUUID(), path: "/" }, now);
    const oneDay = await visitStats(db, visitRange("2026-10-12", "2026-10-12")!);
    assert.equal(oneDay.visits, 2); assert.equal(oneDay.visitors, 2);
    const both = await visitStats(db, visitRange("2026-10-12", "2026-10-13")!);
    assert.equal(both.visits, 3); assert.equal(both.visitors, 2);
    const empty = await visitStats(db, visitRange("2026-10-14", "2026-10-14")!);
    assert.equal(empty.visits, 0); assert.equal(empty.visitors, 0);
    const cache = new Map<string, string>();
    const store = { get: async (key: string) => cache.get(key) || null, set: async (key: string, value: string) => { cache.set(key, value); } };
    const range = visitRange("2026-10-12", "2026-10-13")!;
    const original = await visitStats(db, range, store);
    await recordVisit(db, { visitorId: randomUUID(), sessionId: randomUUID(), path: "/" }, now);
    assert.deepEqual(await visitStats(db, range, store), original, "cache hit returns prior snapshot");
    cache.clear();
    assert.equal((await visitStats(db, range, store)).visits, 4, "cache miss refreshes data");
    for (const key of cache.keys()) cache.set(key, "broken JSON");
    assert.equal((await visitStats(db, range, store)).visits, 4, "bad cache is ignored");
    process.env.CACHE_REDIS_URL = "redis://127.0.0.1:1";
    assert.equal((await visitStats(db, range)).visits, 4, "unavailable Redis falls back to Mongo");
  } finally {
    if (previousCache === undefined) delete process.env.CACHE_REDIS_URL;
    else process.env.CACHE_REDIS_URL = previousCache;
    await db.dropDatabase(); await client.close();
  }
});
