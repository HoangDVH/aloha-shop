import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  applyDueSchedules,
  createCampaign,
  discardDraft,
  getCampaign,
  publishCampaign,
  saveDraft,
  setCampaignPaused,
} from "../backend/shopCampaigns/campaignRepo.js";
import { clearCurrentCampaignCache, getCurrentCampaign } from "../backend/shopCampaigns/currentCampaign.js";
import { CAMPAIGNS_COL, type CampaignDoc } from "../backend/shopCampaigns/types.js";
import { PROMOTION_AUDIT_COL } from "../backend/shopPromotions/types.js";
import { daiLeContent, seedCampaignCatalog, vn } from "./helpers/campaignFixtures.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

let t: TestDb;
let restoreFetch: () => void = () => undefined;
const viewer = { isTestBuyer: false };

before(async () => {
  if (TEST_MONGO_SKIP) return;
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("campaign_publish");
  await seedCampaignCatalog(t.db);
});
after(async () => {
  restoreFetch();
  await t?.close();
});

async function freshCampaign(name = "Đại lễ") {
  return createCampaign(t.db, daiLeContent({ name, slug: name === "Đại lễ" ? "dai-le" : "khac" }), "tester");
}

test("CP01: lưu bản nháp hợp lệ không đổi published; khách không thấy gì", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  const r = await saveDraft(t.db, c._id, daiLeContent({ name: "Đại lễ mới" }), c.revision, "tester");
  assert.equal(r.ok, true);
  const doc = await getCampaign(t.db, c._id);
  assert.equal(doc?.published, null);
  assert.equal(doc?.draft.info.name, "Đại lễ mới");
  clearCurrentCampaignCache();
  assert.equal((await getCurrentCampaign(t.db, vn("2026-10-01T10:00"), viewer)).active, null);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP02 (DB): bản nháp sai schema → 400 kèm lỗi theo trường, không ghi DB", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  const bad: any = daiLeContent();
  bad.display.colors.primary = "xanh";
  const r = await saveDraft(t.db, c._id, bad, c.revision, "tester");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 400);
    assert.ok(r.fields?.some((f) => f.path === "display.colors.primary"));
  }
  assert.equal((await getCampaign(t.db, c._id))?.revision, c.revision);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP03 + CP06: áp dụng → published = nháp, revision +1; current trước / trong / sau", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  const r = await publishCampaign(t.db, c._id, c.revision, "tester");
  assert.equal(r.ok, true);
  const doc = (await getCampaign(t.db, c._id)) as CampaignDoc;
  assert.deepEqual(doc.published, doc.draft);
  assert.equal(doc.revision, c.revision + 1);
  assert.equal((await getCurrentCampaign(t.db, vn("2026-09-20T10:00"), viewer)).active, null);
  assert.equal((await getCurrentCampaign(t.db, vn("2026-10-02T10:00"), viewer)).active?.id, c._id);
  assert.equal((await getCurrentCampaign(t.db, vn("2026-10-05T10:00"), viewer)).active, null);
  const audits = await t.db.collection(PROMOTION_AUDIT_COL).countDocuments({ promotionId: c._id, action: "campaign_publish" });
  assert.equal(audits, 1);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP04: hai admin cùng sửa, người sau gửi revision cũ → 409, bản trước còn nguyên", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  const first = await saveDraft(t.db, c._id, daiLeContent({ name: "Bản A" }), c.revision, "a");
  const second = await saveDraft(t.db, c._id, daiLeContent({ name: "Bản B" }), c.revision, "b");
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.status, 409);
  assert.equal((await getCampaign(t.db, c._id))?.draft.info.name, "Bản A");
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP05: hẹn giờ — hai tiến trình cùng chạy chỉ áp dụng đúng 1 lần", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  await t.db.collection(CAMPAIGNS_COL).updateOne({ _id: c._id as any }, { $set: { scheduledAt: new Date(Date.now() - 1000).toISOString() } });
  const [a, b] = await Promise.all([applyDueSchedules(t.db, Date.now()), applyDueSchedules(t.db, Date.now())]);
  assert.equal(a.length + b.length, 1);
  const publishes = await t.db.collection(PROMOTION_AUDIT_COL).countDocuments({ promotionId: c._id, action: "campaign_publish" });
  assert.equal(publishes, 1);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP07: hai chiến dịch trùng thời gian → chặn áp dụng chiến dịch thứ hai", { skip: TEST_MONGO_SKIP }, async () => {
  const a = await freshCampaign("Đại lễ");
  const b = await freshCampaign("Khác");
  assert.equal((await publishCampaign(t.db, a._id, a.revision, "t")).ok, true);
  const r = await publishCampaign(t.db, b._id, b.revision, "t");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "overlap");
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP08: tạm dừng khẩn cấp — current đọc mới (fresh) thấy dừng ngay", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  await publishCampaign(t.db, c._id, c.revision, "t");
  const now = vn("2026-10-02T10:00");
  assert.equal((await getCurrentCampaign(t.db, now, viewer)).active?.id, c._id);
  await setCampaignPaused(t.db, c._id, true, "ql");
  const s = await getCurrentCampaign(t.db, now, viewer, { fresh: true });
  assert.equal(s.active, null);
  assert.equal(s.pausedId, c._id);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP09: huỷ thay đổi — bản nháp về đúng bản đang chạy, có audit", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await freshCampaign();
  const pub = await publishCampaign(t.db, c._id, c.revision, "t");
  const rev = pub.ok ? pub.value.revision : 0;
  const edited = await saveDraft(t.db, c._id, daiLeContent({ name: "Đang sửa" }), rev, "t");
  const r = await discardDraft(t.db, c._id, edited.ok ? edited.value.revision : 0, "nv1");
  assert.equal(r.ok, true);
  const doc = (await getCampaign(t.db, c._id)) as CampaignDoc;
  assert.deepEqual(doc.draft, doc.published);
  assert.equal(await t.db.collection(PROMOTION_AUDIT_COL).countDocuments({ promotionId: c._id, action: "campaign_discard_draft", actor: "nv1" }), 1);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP12: testOnly — tài khoản test thấy, khách thường không", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await createCampaign(t.db, daiLeContent({ testOnly: true }), "t");
  await publishCampaign(t.db, c._id, c.revision, "t");
  const now = vn("2026-10-02T10:00");
  assert.equal((await getCurrentCampaign(t.db, now, { isTestBuyer: false }, { fresh: true })).active, null);
  assert.equal((await getCurrentCampaign(t.db, now, { isTestBuyer: true }, { fresh: true })).active?.id, c._id);
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});

test("CP13: không có Redis — current vẫn trả đúng từ Mongo + cache RAM", { skip: TEST_MONGO_SKIP }, async () => {
  const saved = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const c = await freshCampaign();
  await publishCampaign(t.db, c._id, c.revision, "t");
  const now = vn("2026-10-02T10:00");
  assert.equal((await getCurrentCampaign(t.db, now, viewer)).active?.id, c._id);
  assert.equal((await getCurrentCampaign(t.db, now, viewer)).active?.id, c._id);
  if (saved) process.env.REDIS_URL = saved;
  await t.db.collection(CAMPAIGNS_COL).deleteMany({});
});
