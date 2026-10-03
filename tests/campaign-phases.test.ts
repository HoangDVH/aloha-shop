import test from "node:test";
import assert from "node:assert/strict";
import {
  flashCounterId,
  getPhase,
  openSlotWindow,
  phaseEndsAt,
} from "../backend/shopCampaigns/campaignPhase.js";
import { attachCampaignPromos, buildCampaignPromo } from "../backend/shopCampaigns/campaignPromo.js";
import { pickCurrent } from "../backend/shopCampaigns/currentCampaign.js";
import { campaignStatusText } from "../backend/shopCampaigns/statusText.js";
import type { CampaignDoc } from "../backend/shopCampaigns/types.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";

const content = daiLeContent();
const active = (nowMs: number) => ({ id: "DAI_LE", content, phase: getPhase(content.info, nowMs), publishedAt: null });
const SP_A = { ma: "SP_A", gia: 200_000, webPrice: 200_000 };
const SP_B = { ma: "SP_B", gia: 500_000, webPrice: 500_000 };
const SP_C = { ma: "SP_C", gia: 80_000, webPrice: 80_000 };
const OTHER = { ma: "SP_KHAC", gia: 90_000, webPrice: 90_000, webBadge: "giam_gia" };

const doc = (over: Partial<CampaignDoc> = {}): CampaignDoc => ({
  _id: "DAI_LE",
  draft: content,
  published: content,
  revision: 1,
  status: "published",
  scheduledAt: null,
  publishedAt: null,
  createdAt: "",
  updatedAt: "",
  updatedBy: "t",
  ...over,
});

test("Giai đoạn theo giờ VN: trước khởi động / khởi động T-3 / đang chạy / giờ chót / kết thúc", () => {
  assert.equal(getPhase(content.info, vn("2026-09-27T23:59")), "upcoming");
  assert.equal(getPhase(content.info, vn("2026-09-28T00:00")), "teaser");
  assert.equal(getPhase(content.info, vn("2026-10-01T00:00")), "live");
  assert.equal(getPhase(content.info, vn("2026-10-03T18:00")), "lastHours");
  assert.equal(getPhase(content.info, vn("2026-10-04T00:00") + 1000), "ended");
  assert.equal(phaseEndsAt(content.info, "teaser"), content.info.startAt);
});

test("TS01: T-3 sản phẩm hiện nhãn hé lộ giá, chưa bán giá sale", () => {
  const promo = buildCampaignPromo(active(vn("2026-09-28T10:00")), SP_A, vn("2026-09-28T10:00"), new Map());
  assert.equal(promo?.kind, "teaser");
  assert.equal(promo?.salePrice, 124_000);
  assert.equal(promo?.listPrice, 200_000);
  assert.equal(promo?.slotOpen, false);
});

test("TS06: sau khi kết thúc không còn chiến dịch hiện hành", () => {
  const s = pickCurrent([doc()], vn("2026-10-04T00:00") + 1000, { isTestBuyer: false });
  assert.equal(s.active, null);
});

test("TS14 / TS16: chỉ sản phẩm trong chiến dịch có campaignPromo; SP khác (kể cả nhãn Giảm giá tay) = null", () => {
  const now = vn("2026-10-01T09:30");
  const [a, b, other] = attachCampaignPromos([SP_A, SP_B, OTHER], active(now), now, new Map([["QUA_G", "Hộp quà"]]));
  assert.equal(a.campaignPromo?.kind, "flash");
  assert.equal(a.campaignPromo?.slotOpen, true);
  assert.equal(b.campaignPromo?.kind, "gift");
  assert.equal(b.campaignPromo?.giftLabel, "Tặng 1 Hộp quà");
  assert.equal(other.campaignPromo, null);
  assert.equal(other.webBadge, "giam_gia");
});

test("Nhiều quà: nhãn ngắn «Tặng kèm 2 quà» + danh sách từng quà", () => {
  const now = vn("2026-10-01T09:30");
  const multi = daiLeContent();
  multi.products[2] = { ...multi.products[2], gift: undefined, gifts: [{ ma: "QUA_G", qty: 1, quota: 3 }, { ma: "BD", qty: 2, quota: 5 }] };
  const names = new Map([["QUA_G", "Hộp quà"], ["BD", "Bảng đen"]]);
  const p = buildCampaignPromo({ id: "DAI_LE", content: multi, phase: getPhase(multi.info, now), publishedAt: null }, SP_B, now, names);
  assert.equal(p?.kind, "gift");
  assert.equal(p?.giftLabel, "Tặng kèm 2 quà");
  assert.deepEqual(p?.gifts, [{ ma: "QUA_G", name: "Hộp quà", qty: 1 }, { ma: "BD", name: "Bảng đen", qty: 2 }]);
});

test("TS17: khung S20 chưa mở → mờ + giờ mở; tắt dòng flash → null", () => {
  const now = vn("2026-10-01T10:00");
  const c = buildCampaignPromo(active(now), SP_C, now, new Map());
  assert.equal(c?.slotOpen, false);
  assert.equal(c?.opensAt, new Date(vn("2026-10-01T20:00")).toISOString());
  const paused = { ...active(now), content: { ...content, products: content.products.map((p) => ({ ...p, paused: p.ma === "SP_A" })) } };
  assert.equal(buildCampaignPromo(paused, SP_A, now, new Map()), null);
});

test("Giá sale không thấp hơn giá thường thì không gắn nhãn (không hiện giảm giá giả)", () => {
  const now = vn("2026-10-01T10:00");
  assert.equal(buildCampaignPromo(active(now), { ma: "SP_A", gia: 120_000, webPrice: 120_000 }, now, new Map()), null);
});

test("EX02: khung 22:00–01:00 — 23:59:59 và 00:30 cùng bộ đếm ngày bắt đầu; 01:00:00 đã đóng", () => {
  const slot = { key: "S22", start: "22:00", end: "01:00", overnight: true };
  const w1 = openSlotWindow(slot, vn("2026-10-01T23:59") + 59_000);
  const w2 = openSlotWindow(slot, vn("2026-10-02T00:30"));
  assert.ok(w1 && w2);
  assert.equal(w1.dayKey, "2026-10-01");
  assert.equal(flashCounterId("C", w1, "S22", "SP_C"), flashCounterId("C", w2, "S22", "SP_C"));
  assert.equal(openSlotWindow(slot, vn("2026-10-02T01:00")), null);
});

test("EX01: cùng khung S09 nhưng khác ngày → bộ đếm khác (mở lại suất mỗi ngày)", () => {
  const slot = content.slots[0];
  const d1 = openSlotWindow(slot, vn("2026-10-01T09:30"))!;
  const d2 = openSlotWindow(slot, vn("2026-10-02T09:30"))!;
  assert.notEqual(flashCounterId("C", d1, "S09", "SP_A"), flashCounterId("C", d2, "S09", "SP_A"));
});

test("CP12 (chọn chiến dịch): testOnly chỉ hiện cho tài khoản test", () => {
  const testOnly = doc({ published: daiLeContent({ testOnly: true }) });
  const now = vn("2026-10-01T10:00");
  assert.equal(pickCurrent([testOnly], now, { isTestBuyer: false }).active, null);
  assert.equal(pickCurrent([testOnly], now, { isTestBuyer: true }).active?.id, "DAI_LE");
});

test("CP08 (chọn chiến dịch): đang tạm dừng → không có chiến dịch hiện hành, báo pausedId", () => {
  const s = pickCurrent([doc({ status: "paused" })], vn("2026-10-01T10:00"), { isTestBuyer: false });
  assert.equal(s.active, null);
  assert.equal(s.pausedId, "DAI_LE");
});

test("DB01: trạng thái bằng chữ theo giờ server", () => {
  assert.equal(campaignStatusText(doc(), vn("2026-10-01T23:59")).text, "Đang chạy · còn 2 ngày");
  assert.equal(campaignStatusText(doc(), vn("2026-09-20T10:00")).text, "Sắp chạy · 01/10 00:00");
  assert.equal(campaignStatusText(doc({ status: "paused" }), vn("2026-10-01T10:00")).text, "Tạm dừng");
  assert.equal(campaignStatusText(doc({ status: "draft", published: null }), vn("2026-10-01T10:00")).text, "Bản nháp");
});
