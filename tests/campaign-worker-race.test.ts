import { REDIS_URL_BEFORE } from "./helpers/noRedis.js";
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { FLASH_COUNTERS_COL, CAMPAIGNS_COL } from "../backend/shopCampaigns/types.js";
import { withWorkerLock } from "../backend/shopCampaigns/worker/campaignWorker.js";
import { PROMOTION_AUDIT_COL } from "../backend/shopPromotions/types.js";
import { holdCounter, type CounterSpec } from "../backend/shopCampaigns/flash/flashCounters.js";
import { reconcileFlashCounters } from "../backend/shopCampaigns/worker/reconcileCounters.js";
import { quotaBelowUsed } from "../backend/shopCampaigns/quotaGuard.js";
import { createCampaign, publishCampaign, saveDraft } from "../backend/shopCampaigns/campaignRepo.js";
import { daiLeContent, seedCampaignCatalog } from "./helpers/campaignFixtures.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

let t: TestDb;
let restoreFetch: () => void = () => undefined;

before(async () => {
  if (TEST_MONGO_SKIP) return;
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("campaign_worker");
  await seedCampaignCatalog(t.db);
});
after(async () => {
  if (REDIS_URL_BEFORE !== undefined) process.env.REDIS_URL = REDIS_URL_BEFORE;
  restoreFetch();
  await t?.close();
});
beforeEach(async () => {
  if (TEST_MONGO_SKIP) return;
  await t.db.collection(FLASH_COUNTERS_COL).deleteMany({});
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

const spec = (quota = 10): CounterSpec => ({ id: "cmp_t:2026-10-01:S09:SP_A", kind: "flash", campaignId: "cmp_t", ma: "SP_A", quota });
const counter = () => t.db.collection(FLASH_COUNTERS_COL).findOne({ _id: spec().id as any });

test("FS08: 50 đơn cùng giữ 1 SP_A (quota 10) → đúng 10 thành công, sold + held ≤ 10", { skip: TEST_MONGO_SKIP }, async () => {
  const results = await Promise.all(Array.from({ length: 50 }, () => holdCounter(t.db, spec(), 1)));
  assert.equal(results.filter(Boolean).length, 10);
  const c = await counter();
  assert.equal(Number(c?.held) + Number(c?.sold), 10);
});

test("WK04: lệch held +2 → phát hiện lệch 2; sửa → 0; sửa lần 2 không đổi gì", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(FLASH_COUNTERS_COL).insertOne({
    _id: spec().id as any, kind: "flash", campaignId: "cmp_t", ma: "SP_A", quota: 10, held: 2, sold: 3,
    updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  });
  const report = await reconcileFlashCounters(t.db, { fix: false });
  assert.equal(report.diffs.length, 1);
  assert.equal(report.diffs[0].held - report.diffs[0].expected, 2);
  const fixed = await reconcileFlashCounters(t.db, { fix: true });
  assert.equal(fixed.fixed, 1);
  assert.equal((await counter())?.held, 0);
  assert.equal((await counter())?.sold, 3, "không đụng suất đã bán");
  const again = await reconcileFlashCounters(t.db, { fix: true, quietMs: 0 });
  assert.equal(again.fixed, 0);
});

test("WK01: 2 tiến trình worker cùng chạy (Redis tắt → khoá Mongo) → chỉ 1 nơi xử lý", { skip: TEST_MONGO_SKIP }, async () => {
  let runs = 0;
  const job = () => withWorkerLock(t.db, async () => {
    runs++;
    await new Promise((r) => setTimeout(r, 150));
    return true;
  });
  const [a, b] = await Promise.all([job(), job()]);
  assert.equal(runs, 1);
  assert.equal([a, b].filter((x) => x === true).length, 1);
  assert.equal(await t.db.collection(FLASH_COUNTERS_COL).countDocuments({ kind: "lock" }), 0, "nhả khoá sau khi chạy");
});

test("EX07: đang chạy, đã bán 6 + đang giữ 2 → giảm xuống 7 bị chặn kèm con số; tăng lên 15 được", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await createCampaign(t.db, daiLeContent(), "ql");
  const id = `${c._id}:2026-10-01:ALLDAY:SP_A`;
  await t.db.collection(FLASH_COUNTERS_COL).insertOne({ _id: id as any, kind: "flash", campaignId: c._id, ma: "SP_A", quota: 10, held: 2, sold: 6 });
  const down = daiLeContent();
  down.products[0].quota = 7;
  const msgs = await quotaBelowUsed(t.db, c._id, down, Date.parse("2026-10-01T05:00:00Z"));
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /đang giữ 8 suất.*xuống 7/);
  const up = daiLeContent();
  up.products[0].quota = 15;
  assert.deepEqual(await quotaBelowUsed(t.db, c._id, up, Date.parse("2026-10-01T05:00:00Z")), []);
});

test("AD01/AD02: nhân viên sửa chữ hero được; sửa giá flash bị 403", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await createCampaign(t.db, daiLeContent(), "ql");
  const text = daiLeContent();
  text.display.hero.title = "ĐẠI LỄ MỚI";
  const ok = await saveDraft(t.db, c._id, text, c.revision, "nv", false);
  assert.equal(ok.ok, true);
  const price = daiLeContent();
  price.products[0].salePrice = 100_000;
  const denied = await saveDraft(t.db, c._id, price, ok.ok ? ok.value.revision : 0, "nv", false);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);
});

test("AD05: giá dưới vốn → chưa bật khi thiếu lý do; có lý do thì bật và audit lưu lý do", { skip: TEST_MONGO_SKIP }, async () => {
  const content = daiLeContent();
  content.products[0].salePrice = 80_000;
  const c = await createCampaign(t.db, content, "ql");
  const blocked = await publishCampaign(t.db, c._id, c.revision, "ql");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "needs_confirm");
  const r = await publishCampaign(t.db, c._id, c.revision, "ql", { reason: "Xả hàng cuối mùa" });
  assert.equal(r.ok, true);
  const audit = await t.db.collection(PROMOTION_AUDIT_COL).findOne({ promotionId: c._id, action: "campaign_publish" });
  assert.equal(audit?.reason, "Xả hàng cuối mùa");
});
