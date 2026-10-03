import test from "node:test";
import assert from "node:assert/strict";
import { getPhase } from "../backend/shopCampaigns/campaignPhase.js";
import { buildCampaignPromo, promoRowFor } from "../backend/shopCampaigns/campaignPromo.js";
import { openFlashLines } from "../backend/shopCampaigns/flash/flashOffers.js";
import { applyFlashOffers } from "../backend/shopCampaigns/flash/flashPricing.js";
import { FLASH_MESSAGES, type FlashOffer } from "../backend/shopCampaigns/flash/flashTypes.js";
import type { CampaignContent, CampaignProduct } from "../backend/shopCampaigns/types.js";
import type { ShopOrderDetail } from "../backend/shopOrders/models.js";
import { droppedFlashMas } from "../frontend/lib/campaign/flashCartDiff.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";

/** SP_X: khung 09:00–12:00 giá 100K, khung 20:00–22:00 giá 90K; SP_Y: cả ngày 150K + khung 12:00–14:00 giá 120K. */
function content(products: CampaignProduct[]): CampaignContent {
  const c = daiLeContent();
  c.slots = [
    { key: "S9", start: "09:00", end: "12:00" },
    { key: "S12", start: "12:00", end: "14:00" },
    { key: "S20", start: "20:00", end: "22:00" },
    { key: "S22", start: "22:00", end: "01:00", overnight: true },
  ];
  c.products = products;
  return c;
}
const row = (ma: string, salePrice: number, slotKey?: string, extra: Partial<CampaignProduct> = {}): CampaignProduct => ({
  ma, salePrice, quota: 10, perCustomerLimit: 2, ...(slotKey ? { slotKey } : {}), ...extra,
});
const active = (c: CampaignContent, nowMs: number) => ({ id: "C1", content: c, phase: getPhase(c.info, nowMs), publishedAt: null });
const lineAt = (c: CampaignContent, ma: string, local: string) => {
  const now = vn(local);
  return openFlashLines(active(c, now), now, new Set([ma]))[0] || null;
};

const SLOTTED = content([row("SP_X", 100_000, "S9"), row("SP_X", 90_000, "S20")]);

test("Trong khung: được giá sale của đúng khung đó", () => {
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-10-01T10:00")?.p.salePrice, 100_000);
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-10-01T20:30")?.p.salePrice, 90_000);
});

test("Ngoài khung: không có giá sale (khách vẫn mua được giá thường)", () => {
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-10-01T08:59"), null);
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-10-01T15:00"), null);
  const r = applyFlashOffers([{ productCode: "SP_X", productName: "SP_X", quantity: 2, price: 200_000, discount: 0 } as ShopOrderDetail], new Map());
  assert.deepEqual(r.details.map((d) => [d.quantity, d.price, Boolean(d.flash)]), [[2, 200_000, false]]);
  assert.deepEqual(r.notices, []);
});

test("Biên giờ: mở đúng giờ bắt đầu, đóng đúng giờ kết thúc (theo giây, giờ VN)", () => {
  const at = (ms: number) => openFlashLines(active(SLOTTED, ms), ms, new Set(["SP_X"]))[0] || null;
  assert.equal(at(vn("2026-10-01T09:00") - 1000), null);
  assert.ok(at(vn("2026-10-01T09:00")));
  assert.ok(at(vn("2026-10-01T12:00") - 1000));
  assert.equal(at(vn("2026-10-01T12:00")), null);
});

test("Khung qua nửa đêm 22:00–01:00: 23:59 và 00:30 cùng một bộ đếm (ngày bắt đầu khung), 01:00 đóng", () => {
  const c = content([row("SP_Z", 50_000, "S22")]);
  const a = lineAt(c, "SP_Z", "2026-10-01T23:59");
  const b = lineAt(c, "SP_Z", "2026-10-02T00:30");
  assert.ok(a && b);
  assert.equal(a!.spec.id, b!.spec.id);
  assert.equal(a!.spec.id, "C1:2026-10-01:S22:SP_Z");
  assert.equal(lineAt(c, "SP_Z", "2026-10-02T01:00"), null);
});

test("Mỗi ngày một bộ đếm riêng cho cùng khung (suất và giới hạn mỗi khách làm mới theo ngày)", () => {
  const d1 = lineAt(SLOTTED, "SP_X", "2026-10-01T10:00");
  const d2 = lineAt(SLOTTED, "SP_X", "2026-10-02T10:00");
  assert.notEqual(d1!.spec.id, d2!.spec.id);
});

test("SP vừa có dòng «Cả ngày» vừa có dòng khung: trong khung lấy giá khung, ngoài khung lấy giá cả ngày", () => {
  for (const products of [[row("SP_Y", 150_000), row("SP_Y", 120_000, "S12")], [row("SP_Y", 120_000, "S12"), row("SP_Y", 150_000)]]) {
    const c = content(products);
    assert.equal(lineAt(c, "SP_Y", "2026-10-01T12:30")?.p.salePrice, 120_000);
    assert.equal(lineAt(c, "SP_Y", "2026-10-01T15:00")?.p.salePrice, 150_000);
    const now = vn("2026-10-01T12:30");
    const promo = buildCampaignPromo(active(c, now), { ma: "SP_Y", gia: 200_000, webPrice: 200_000 }, now, new Map());
    assert.equal(promo?.salePrice, 120_000);
    assert.equal(promo?.slotKey, "S12");
  }
});

test("Quà khi đặt hàng lấy cùng dòng với card: trong khung là quà của dòng khung, ngoài khung là quà dòng cả ngày", () => {
  const c = content([
    row("SP_Y", 150_000, undefined, { gifts: [{ ma: "QUA_A", qty: 1, quota: 5 }] }),
    row("SP_Y", 120_000, "S12", { gifts: [{ ma: "TGMK", qty: 1, quota: 10 }] }),
  ]);
  const giftAt = (t: string) => {
    const now = vn(`2026-10-01T${t}`);
    return promoRowFor(active(c, now), "SP_Y", now)?.gifts?.[0].ma;
  };
  assert.equal(giftAt("12:30"), "TGMK");
  assert.equal(giftAt("15:00"), "QUA_A");
});

test("Tạm dừng dòng khung: SP rơi về dòng cả ngày; tạm dừng hết thì giá thường", () => {
  const c = content([row("SP_Y", 150_000), row("SP_Y", 120_000, "S12", { paused: true })]);
  assert.equal(lineAt(c, "SP_Y", "2026-10-01T12:30")?.p.salePrice, 150_000);
  const all = content([row("SP_Y", 150_000, undefined, { paused: true })]);
  assert.equal(lineAt(all, "SP_Y", "2026-10-01T12:30"), null);
});

test("Chưa bắt đầu (xem trước) / đã kết thúc chiến dịch: không bán giá sale kể cả đúng giờ khung", () => {
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-09-30T10:00"), null);
  assert.equal(lineAt(SLOTTED, "SP_X", "2026-10-04T10:00"), null);
});

test("Khung đã bị xoá / giá sale 0 / số lượng 0: không bán giá sale", () => {
  const c = content([row("SP_X", 100_000, "S99"), row("SP_W", 0, "S9"), row("SP_V", 100_000, "S9", { quota: 0 })]);
  for (const ma of ["SP_X", "SP_W", "SP_V"]) assert.equal(lineAt(c, ma, "2026-10-01T10:00"), null, ma);
});

const offer = (over: Partial<FlashOffer> = {}): Map<string, FlashOffer> =>
  new Map([["SP_X", { campaignId: "C1", ma: "SP_X", salePrice: 100_000, counterId: "C1:2026-10-01:S9:SP_X", quota: 10, perCustomerLimit: 2, remaining: 10, customerRemaining: 2, ...over }]]);
const buy = (qty: number) => [{ productCode: "SP_X", productName: "Cây X", quantity: qty, price: 200_000, discount: 0 } as ShopOrderDetail];

test("Đã mua đủ giới hạn trong khung: báo đúng lý do (không nói nhầm là hết suất), vẫn mua được giá thường", () => {
  const r = applyFlashOffers(buy(1), offer({ customerRemaining: 0 }));
  assert.deepEqual(r.details.map((d) => [d.quantity, d.price]), [[1, 200_000]]);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.limitReached("Cây X", 2)]);
});

test("Hết suất trong khung: báo hết suất, vẫn mua được giá thường", () => {
  const r = applyFlashOffers(buy(1), offer({ remaining: 0 }));
  assert.deepEqual(r.notices, [FLASH_MESSAGES.soldOut]);
});

test("Giỏ: hết khung thì nhận ra SP vừa mất giá sale; bỏ SP khỏi giỏ thì không báo", () => {
  const prev = new Set(["SP_X", "SP_Y"]);
  const after = { lines: [{ ma: "SP_X" }, { ma: "SP_Y", flash: true }, { ma: "QUA", isGift: true }] };
  assert.deepEqual(droppedFlashMas(prev, after), ["SP_X"]);
  assert.deepEqual(droppedFlashMas(prev, { lines: [{ ma: "SP_Y", flash: true }] }), []);
});

test("Mua vượt giới hạn: phần trong giới hạn giá sale, phần dư giá thường, câu báo dùng tên sản phẩm", () => {
  const r = applyFlashOffers(buy(3), offer());
  assert.deepEqual(r.details.map((d) => [d.quantity, d.price]), [[2, 100_000], [1, 200_000]]);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.partial("Cây X", 2)]);
});
