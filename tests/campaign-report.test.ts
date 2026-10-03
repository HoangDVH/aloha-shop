import "./helpers/noRedis.js";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildCampaignReport, campaignReportXlsx, type CampaignReport } from "../backend/shopCampaigns/admin/campaignReport.js";
import { createCampaign } from "../backend/shopCampaigns/campaignRepo.js";
import { recordBannerEvent, recordRemind } from "../backend/shopCampaigns/stats/campaignStats.js";
import { CAMPAIGN_STATS_COL, CAMPAIGNS_COL, FLASH_COUNTERS_COL } from "../backend/shopCampaigns/types.js";
import { PROMOTIONS_COL } from "../backend/shopPromotions/types.js";
import { daiLeContent, seedCampaignCatalog, vn } from "./helpers/campaignFixtures.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

const SAMPLE: CampaignReport = {
  name: "Đại lễ",
  flash: [
    { day: "2026-10-01", slot: "S20", ma: "SP_C", ten: "Cây SP_C", quota: 5, sold: 4, held: 1 },
    { day: "2026-10-01", slot: "Cả ngày", ma: "SP_A", ten: "Cây SP_A", quota: 10, sold: 7, held: 0 },
  ],
  gifts: [{ parentMa: "SP_B", giftMa: "QUA_G", ten: "Hộp quà", quota: 3, sold: 2, held: 0 }],
  vouchers: [{ id: "V30K", code: "V30K", name: "Giảm 30K", claimed: 12, used: 5 }],
  banners: [{ bannerId: "B1", clicks: 3 }],
  views: 40,
  clicks: 3,
  ctr: 3 / 40,
  reminds: [{ ma: "SP_C", count: 2 }],
};

async function readBack(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const rows = (name: string) =>
    (wb.getWorksheet(name)?.getSheetValues() || []).filter(Boolean).map((r) => (r as unknown[]).slice(1));
  return { names: wb.worksheets.map((w) => w.name), rows };
}

test("AD16: file Excel có đủ sheet, số liệu đúng từng dòng", async () => {
  const { names, rows } = await readBack(await campaignReportXlsx(SAMPLE));
  assert.deepEqual(names, ["Tong quan", "Flash theo khung", "Voucher", "Qua tang", "Banner & nhac"]);
  const overview = new Map(rows("Tong quan").map((r) => [r[0], r[1]]));
  assert.equal(overview.get("Suất flash đã bán"), 11);
  assert.equal(overview.get("Quà đã tặng"), 2);
  assert.equal(overview.get("Lượt lưu voucher"), 12);
  assert.equal(overview.get("Lượt dùng voucher"), 5);
  assert.equal(overview.get("Tỉ lệ bấm (%)"), 7.5);
  assert.deepEqual(rows("Flash theo khung")[1], ["2026-10-01", "S20", "SP_C", "Cây SP_C", 5, 4, 1]);
  assert.deepEqual(rows("Voucher")[1], ["V30K", "Giảm 30K", 12, 5]);
  assert.deepEqual(rows("Qua tang")[1], ["SP_B", "QUA_G", "Hộp quà", 3, 2, 0]);
  assert.deepEqual(rows("Banner & nhac").slice(1), [["B1", "Bấm banner", 3], ["SP_C", "Nhắc tôi", 2]]);
});

let t: TestDb;
let restoreFetch: () => void = () => undefined;
before(async () => {
  if (TEST_MONGO_SKIP) return;
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("campaign_report");
  await seedCampaignCatalog(t.db);
});
after(async () => {
  restoreFetch();
  await t?.close();
});

test("AD16 (DB): báo cáo khớp bộ đếm, voucher và lượt bấm trong DB", { skip: TEST_MONGO_SKIP }, async () => {
  const c = await createCampaign(t.db, daiLeContent(), "tester");
  const now = vn("2026-10-01T20:30");
  await t.db.collection(FLASH_COUNTERS_COL).insertMany([
    { _id: `${c._id}:2026-10-01:S20:SP_C` as any, kind: "flash", campaignId: c._id, ma: "SP_C", quota: 5, sold: 4, held: 1 },
    { _id: `${c._id}:2026-10-02:ALLDAY:SP_A` as any, kind: "flash", campaignId: c._id, ma: "SP_A", quota: 10, sold: 7, held: 0 },
    { _id: `gift:${c._id}:SP_B:QUA_G` as any, kind: "gift", campaignId: c._id, ma: "QUA_G", quota: 3, sold: 2, held: 0 },
    { _id: "khac:2026-10-01:S20:SP_C" as any, kind: "flash", campaignId: "khac", ma: "SP_C", quota: 9, sold: 9, held: 0 },
  ]);
  await t.db.collection(PROMOTIONS_COL).updateOne({ id: "V30K" }, { $set: { claimedCount: 12, usedCount: 5 } });
  for (let i = 0; i < 4; i++) await recordBannerEvent(t.db, { campaignId: c._id, bannerId: "b1", event: "bannerView", nowMs: now });
  await recordBannerEvent(t.db, { campaignId: c._id, bannerId: "b1", event: "bannerClick", nowMs: now });
  await recordRemind(t.db, { campaignId: c._id, ma: "SP_C", actor: "acc:1", nowMs: now, campaignEndMs: now });

  try {
    const r = await buildCampaignReport(t.db, (await t.db.collection(CAMPAIGNS_COL).findOne({ _id: c._id as any })) as any);
    assert.deepEqual(
      r.flash.map((f) => [f.day, f.slot, f.ma, f.sold, f.held]),
      [["2026-10-01", "S20", "SP_C", 4, 1], ["2026-10-02", "Cả ngày", "SP_A", 7, 0]],
      "chỉ bộ đếm của chiến dịch này"
    );
    assert.deepEqual(r.gifts.map((g) => [g.parentMa, g.giftMa, g.sold]), [["SP_B", "QUA_G", 2]]);
    const v30 = r.vouchers.find((v) => v.id === "V30K");
    assert.deepEqual([v30?.claimed, v30?.used], [12, 5]);
    assert.equal(r.views, 4);
    assert.equal(r.clicks, 1);
    assert.equal(r.ctr, 0.25);
    assert.deepEqual(r.reminds, [{ ma: "SP_C", count: 1 }]);
  } finally {
    await t.db.collection(FLASH_COUNTERS_COL).deleteMany({});
    await t.db.collection(CAMPAIGN_STATS_COL).deleteMany({});
    await t.db.collection(CAMPAIGNS_COL).deleteMany({});
  }
});
