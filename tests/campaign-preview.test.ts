import "./helpers/noRedis.js";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { createCampaign } from "../backend/shopCampaigns/campaignRepo.js";
import { clearCurrentCampaignCache, getCurrentCampaign } from "../backend/shopCampaigns/currentCampaign.js";
import { signPreviewToken, verifyPreviewToken } from "../backend/shopCampaigns/preview.js";
import { registerCampaignPublicRoutes } from "../backend/shopCampaigns/routes/public.routes.js";
import { CAMPAIGNS_COL } from "../backend/shopCampaigns/types.js";
import { shopQuoteSecret } from "../backend/shopAuth/tokens.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";
import { TEST_MONGO_SKIP, openTestDb, type TestDb } from "./helpers/testMongo.js";

type Db = TestDb["db"];

async function serve(getDb: () => Promise<Db>) {
  const app = express();
  registerCampaignPublicRoutes(app, getDb as never);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

test("CP10: token đúng thì đọc được, bị sửa / sai loại thì null", () => {
  const token = signPreviewToken("cmp_1", "tester");
  assert.deepEqual(verifyPreviewToken(token), { cid: "cmp_1" });
  const [h, p, s] = token.split(".");
  const flipped = `${h}.${p}.${s.slice(0, -2)}${s.endsWith("AA") ? "BB" : "AA"}`;
  assert.equal(verifyPreviewToken(flipped), null);
  const forged = jwt.sign({ typ: "campaign_preview", cid: "cmp_1" }, shopQuoteSecret());
  assert.equal(verifyPreviewToken(forged), null, "khoá báo giá không mở được bản nháp");
  assert.equal(verifyPreviewToken(""), null);
});

test("CP10: token quá 30 phút thì hết hạn", () => {
  const token = signPreviewToken("cmp_1", "tester");
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 60_000;
  try {
    assert.equal(verifyPreviewToken(token), null);
  } finally {
    Date.now = realNow;
  }
});

test("CP10 (route): token sai → 401, không chạm DB, không lộ bản nháp", async () => {
  let dbCalls = 0;
  const srv = await serve(async () => {
    dbCalls++;
    throw new Error("không được đọc DB");
  });
  try {
    for (const q of ["", "?token=abc", `?token=${signPreviewToken("x", "t")}x`]) {
      const res = await fetch(`${srv.base}/api/shop/campaigns/preview${q}`);
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("cache-control"), "no-store");
      const body = await res.json();
      assert.equal(body.code, "preview_invalid");
      assert.equal(body.campaign, undefined);
    }
    assert.equal(dbCalls, 0);
  } finally {
    await srv.close();
  }
});

let t: TestDb;
before(async () => {
  if (TEST_MONGO_SKIP) return;
  t = await openTestDb("campaign_preview");
});
after(async () => {
  await t?.close();
});

test("CP11 (DB): xem trước lúc 20:05 thấy bản nháp đang chạy; khách thật vẫn không thấy", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await createCampaign(t.db, daiLeContent({ name: "Nháp xem trước" }), "tester");
  const srv = await serve(async () => t.db);
  try {
    const at = new Date(vn("2026-10-02T20:05")).toISOString();
    const res = await fetch(`${srv.base}/api/shop/campaigns/preview?token=${signPreviewToken(c._id, "t")}&at=${encodeURIComponent(at)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.preview, true);
    assert.equal(body.serverNow, Date.parse(at));
    assert.equal(body.campaign.name, "Nháp xem trước");
    assert.ok(["live", "lastHours"].includes(body.campaign.phase));

    const gone = await fetch(`${srv.base}/api/shop/campaigns/preview?token=${signPreviewToken("khong_co", "t")}`);
    assert.equal(gone.status, 401);

    clearCurrentCampaignCache();
    const real = await getCurrentCampaign(t.db, Date.parse(at), { isTestBuyer: false });
    assert.equal(real.active, null, "giá thật đọc chiến dịch đã bật, bản nháp không ảnh hưởng");
  } finally {
    await srv.close();
    await t.db.collection(CAMPAIGNS_COL).deleteMany({});
  }
});
