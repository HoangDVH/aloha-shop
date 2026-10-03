import test from "node:test";
import assert from "node:assert/strict";
import { SLOT_TEMPLATES, slotOptions, stageChips } from "../frontend/lib/campaign/flashSlots.js";
import { flashDealProgress } from "../frontend/lib/campaign/dealProgress.js";
import type { CampaignPromoUI } from "../frontend/lib/campaign/campaignApi.js";
import { overlappingSlots } from "../backend/shopCampaigns/admin/prepublishChecks.js";
import { validateCampaignContent } from "../backend/shopCampaigns/schema.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";

const slots = [
  { key: "S9", start: "09:00", end: "11:00" },
  { key: "S12", start: "12:00", end: "14:00" },
  { key: "S16", start: "16:00", end: "18:00", label: "Freeship 0Đ" },
  { key: "S20", start: "20:00", end: "22:00", label: "Đại tiệc đêm" },
];
const farEnd = vn("2026-10-10T00:00");

test("Đang chạy 12:30: khung đang mở đứng đầu, khung sau «Sắp diễn ra», khung đã qua về cuối «Ngày mai»; nhãn admin để ở label", () => {
  const chips = stageChips(slots, "live", vn("2026-10-01T12:30"), farEnd);
  assert.deepEqual(chips.map((c) => [c.time, c.text, c.label]), [
    ["12:00", "Đang diễn ra", ""],
    ["16:00", "Sắp diễn ra", "Freeship 0Đ"],
    ["20:00", "Sắp diễn ra", "Đại tiệc đêm"],
    ["09:00", "Ngày mai", ""],
  ]);
});

test("Tự đổi theo giờ: 10:59 khung 9h đang diễn ra; 11:00 hết khung, 12:00 thành khung kế tiếp; 12:00 mở thì 9h về «Ngày mai»", () => {
  const at = (t: string) => stageChips(slots, "live", vn(`2026-10-01T${t}`), farEnd).map((c) => [c.time, c.text]);
  assert.deepEqual(at("10:59")[0], ["09:00", "Đang diễn ra"]);
  assert.deepEqual(at("10:59")[1], ["12:00", "Sắp diễn ra"]);
  assert.deepEqual(at("11:00")[0], ["12:00", "Sắp diễn ra"]);
  assert.deepEqual(at("11:00").at(-1), ["09:00", "Ngày mai"]);
  assert.deepEqual(at("12:00")[0], ["12:00", "Đang diễn ra"]);
  assert.deepEqual(at("22:30").map((c) => c[1]), ["Ngày mai", "Ngày mai", "Ngày mai", "Ngày mai"]);
});

test("Ngày cuối chiến dịch: khung đã qua không hiện «Ngày mai»", () => {
  const chips = stageChips(slots, "lastHours", vn("2026-10-01T12:30"), vn("2026-10-02T00:00"));
  assert.deepEqual(chips.map((c) => c.time), ["12:00", "16:00", "20:00"]);
});

test("Chưa mở bán (xem trước): không khung nào «Đang diễn ra»", () => {
  const chips = stageChips(slots, "teaser", vn("2026-09-29T10:00"), farEnd);
  assert.ok(chips.every((c) => c.status === "next"));
  assert.equal(chips[0].time, "12:00");
});

test("Mẫu khung giờ: hợp lệ với schema, không chồng giờ, mã khung không trùng", () => {
  for (const t of SLOT_TEMPLATES) {
    assert.deepEqual(overlappingSlots(t.slots), [], t.id);
    assert.equal(new Set(t.slots.map((s) => s.key)).size, t.slots.length, t.id);
    const c = daiLeContent();
    c.products = c.products.map((p) => ({ ...p, slotKey: undefined }));
    c.slots = t.slots;
    assert.equal(validateCampaignContent(c).ok, true, t.id);
  }
});

const promo = (over: Partial<CampaignPromoUI> = {}): CampaignPromoUI => ({
  campaignId: "C1", kind: "flash", salePrice: 308_000, listPrice: 350_000, endsAt: "2026-10-03T17:00:00Z",
  slotKey: "S9", slotOpen: true, opensAt: null, remaining: 10, soldPct: 0, giftLabel: null, perCustomerLimit: 2, ...over,
});
const now = vn("2026-10-01T10:50");

test("Card flash: chưa ai mua trong khung → «Vừa mở bán», không lấy tồn kho 0 báo «Đã bán hết»", () => {
  const p = flashDealProgress(promo(), true, null, now);
  assert.deepEqual([p?.left, p?.right, p?.pct, p?.soldOut, p?.state], ["Vừa mở bán", "", 0, false, "fresh"]);
  assert.equal(flashDealProgress(promo({ remaining: 7, soldPct: 30 }), true, null, now)?.state, "selling");
  assert.equal(flashDealProgress(promo({ remaining: 2, soldPct: 80 }), true, null, now, 3)?.state, "low");
  assert.equal(flashDealProgress(promo({ slotOpen: false }), false, null, now)?.state, "upcoming");
});

test("Card flash: «Chỉ còn N suất» khi tồn kho thật < 5 hoặc suất còn ≤ 3 / đã bán ≥ 80%", () => {
  assert.deepEqual(flashDealProgress(promo({ remaining: 7, soldPct: 30 }), true, null, now, 50)?.left, "Đã bán 30%");
  assert.equal(flashDealProgress(promo({ remaining: 2, soldPct: 80 }), true, null, now, 50)?.left, "Chỉ còn 2 suất cuối!");
  assert.equal(flashDealProgress(promo({ remaining: 4, soldPct: 80, soldQty: 16 }), true, null, now, 50)?.state, "low");
  const low = flashDealProgress(promo({ remaining: 8, soldPct: 20 }), true, null, now, 4);
  assert.deepEqual([low?.left, low?.right, low?.state], ["Chỉ còn 4 suất cuối!", "Sắp cháy", "low"]);
  assert.equal(flashDealProgress(promo({ remaining: 2, soldPct: 80 }), true, null, now, 3)?.left, "Chỉ còn 2 suất cuối!");
  assert.equal(flashDealProgress(promo({ remaining: 8 }), true, null, now, 5)?.state, "fresh");
  assert.equal(flashDealProgress(promo({ remaining: 8 }), true, null, now, 0)?.state, "fresh");
  assert.equal(flashDealProgress(promo({ remaining: null }), true, null, now, 2)?.left, "Chỉ còn 2 suất cuối!");
});

test("Card flash: ghi số cây đã bán; ≥ 50% thêm «Đang bán chạy»; hết suất → giá thường", () => {
  assert.deepEqual(flashDealProgress(promo({ remaining: 7, soldPct: 30 }), true, null, now)?.left, "Đã bán 30%");
  const few = flashDealProgress(promo({ remaining: 7, soldPct: 30, soldQty: 3 }), true, null, now);
  assert.deepEqual([few?.left, few?.right, few?.state], ["Đã bán 3", "", "selling"]);
  const hot = flashDealProgress(promo({ remaining: 4, soldPct: 60, soldQty: 6 }), true, null, now);
  assert.deepEqual([hot?.left, hot?.right], ["Đang bán chạy", "Đã bán 6"]);
  const out = flashDealProgress(promo({ remaining: 0, soldPct: 100 }), true, null, now);
  assert.deepEqual([out?.left, out?.soldOut], ["Đã hết suất giá sale", true]);
});

test("Card flash: SP không nhận đặt trước thì số suất không vượt tồn kho thật", () => {
  assert.equal(flashDealProgress(promo(), true, 3, now)?.left, "Chỉ còn 3 suất cuối!");
  assert.equal(flashDealProgress(promo(), true, 0, now)?.soldOut, true);
});

test("Card flash ngoài khung: hiện giờ mở bán kế tiếp", () => {
  const later = flashDealProgress(promo({ slotOpen: false, opensAt: new Date(vn("2026-10-01T12:00")).toISOString() }), false, null, now);
  assert.deepEqual([later?.left, later?.right], ["Mở bán 12:00", "Sắp diễn ra"]);
  const tmr = flashDealProgress(promo({ slotOpen: false, opensAt: new Date(vn("2026-10-02T09:00")).toISOString() }), false, null, now);
  assert.equal(tmr?.left, "Mở bán 09:00 ngày mai");
  assert.equal(flashDealProgress(promo({ kind: "gift", salePrice: null }), false, null, now), null);
});

test("Ô chọn khung: có «Cả ngày» + giờ kèm nhãn", () => {
  assert.deepEqual(slotOptions(slots.slice(2, 3)), [
    { value: "", label: "Cả ngày (toàn chiến dịch)" },
    { value: "S16", label: "16:00–18:00 · Freeship 0Đ" },
  ]);
});
