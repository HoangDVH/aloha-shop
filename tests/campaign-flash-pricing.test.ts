import test from "node:test";
import assert from "node:assert/strict";
import { applyFlashOffers, flashSavingsOf } from "../backend/shopCampaigns/flash/flashPricing.js";
import { FLASH_MESSAGES, type FlashOffer } from "../backend/shopCampaigns/flash/flashTypes.js";
import { buildGiftLines, type GiftOffer, type GiftOffers } from "../backend/shopCampaigns/gifts/giftLines.js";
import { splitLineDiscounts } from "../backend/shopOrders/create/orderPromotions.js";
import { hashQuoteItems } from "../backend/shopShipping/quoteToken.js";
import { isItemInScope } from "../backend/shopPromotions/evaluator.js";
import type { ShopOrderDetail } from "../backend/shopOrders/models.js";
import { promo } from "./helpers/walletFixtures.js";

const line = (productCode: string, quantity: number, price: number): ShopOrderDetail =>
  ({ productCode, productName: productCode, quantity, price, discount: 0 }) as ShopOrderDetail;

const offerA = (over: Partial<FlashOffer> = {}): Map<string, FlashOffer> =>
  new Map([["SP_A", { campaignId: "c1", ma: "SP_A", salePrice: 124_000, counterId: "c1:2026-10-01:S09:SP_A", quota: 10, perCustomerLimit: 2, remaining: 10, customerRemaining: 2, ...over }]]);

test("FS01: 1 SP_A trong khung → giá 124.000đ, gạch 200.000đ, tiết kiệm 76.000đ", () => {
  const r = applyFlashOffers([line("SP_A", 1, 200_000)], offerA());
  assert.equal(r.details.length, 1);
  assert.equal(r.details[0].price, 124_000);
  assert.equal(r.details[0].flash?.listPrice, 200_000);
  assert.equal(r.flashSavings, 76_000);
  assert.equal(flashSavingsOf(r.details), 76_000);
});

test("FS06: mua 3 SP_A (giới hạn 2/khách) → 2 dòng: 2×124.000đ + 1×200.000đ, không từ chối đơn", () => {
  const r = applyFlashOffers([line("SP_A", 3, 200_000)], offerA());
  assert.deepEqual(r.details.map((d) => [d.quantity, d.price, Boolean(d.flash)]), [[2, 124_000, true], [1, 200_000, false]]);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.partial("SP_A", 2)]);
});

test("FS07: hết suất → giá thường kèm câu báo", () => {
  const r = applyFlashOffers([line("SP_A", 1, 200_000)], offerA({ remaining: 0 }));
  assert.equal(r.details[0].price, 200_000);
  assert.equal(r.flashSavings, 0);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.soldOut]);
});

test("EX: giá thường đã thấp hơn giá sale → khách trả giá thường, không gắn flash", () => {
  const r = applyFlashOffers([line("SP_A", 1, 100_000)], offerA());
  assert.equal(r.details[0].price, 100_000);
  assert.equal(r.details[0].flash, undefined);
});

test("EX11: dòng quà 0đ của QUA_G không bị tính giá flash", () => {
  const gift = { ...line("SP_A", 1, 0), isGift: true } as ShopOrderDetail;
  const r = applyFlashOffers([gift], offerA());
  assert.equal(r.details[0].flash, undefined);
  assert.equal(r.flashSavings, 0);
});

const oneGift = (giftMa: string, giftName: string, remaining: number, perUnit = 1): GiftOffer => ({
  parentMa: "SP_B", giftMa, giftName, perUnit, remaining,
  spec: { id: `gift:c1:SP_B:${giftMa}`, kind: "gift", campaignId: "c1", ma: giftMa, quota: 3 },
});
const giftOffer = (remaining: number): GiftOffers => new Map([["SP_B", [oneGift("QUA_G", "Hộp quà", remaining)]]]);

test("GF01/GF03: mua 2 SP_B, còn 1 quà → 1 dòng quà 0đ có note, báo còn 1 quà", () => {
  const r = buildGiftLines([line("SP_B", 2, 500_000)], giftOffer(1), "Đại lễ");
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].price, 0);
  assert.equal(r.lines[0].quantity, 1);
  assert.equal(r.lines[0].isGift, true);
  assert.match(String(r.lines[0].note), /Quà tặng chương trình Đại lễ/);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.giftLimited("Hộp quà", 1)]);
});

test("GF04: hết quà → đơn vẫn tạo được, không có dòng quà, báo hết quà", () => {
  const r = buildGiftLines([line("SP_B", 1, 500_000)], giftOffer(0), "Đại lễ");
  assert.equal(r.lines.length, 0);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.giftOut("Hộp quà")]);
});

test("GF-multi: 1 SP nhiều quà → mỗi quà 1 dòng, số lượng theo từng quà, bộ đếm riêng", () => {
  const offers: GiftOffers = new Map([["SP_B", [oneGift("QUA_G", "Hộp quà", 10), oneGift("BD", "Bảng đen", 10, 2)]]]);
  const r = buildGiftLines([line("SP_B", 3, 500_000)], offers, "Đại lễ");
  assert.deepEqual(r.lines.map((l) => [l.productCode, l.quantity, l.price, l.gift?.counterId]), [
    ["QUA_G", 3, 0, "gift:c1:SP_B:QUA_G"],
    ["BD", 6, 0, "gift:c1:SP_B:BD"],
  ]);
  assert.deepEqual(r.notices, []);
});

test("GF-multi: 1 quà hết thì quà còn lại vẫn tặng, báo đúng tên quà hết", () => {
  const offers: GiftOffers = new Map([["SP_B", [oneGift("QUA_G", "Hộp quà", 0), oneGift("BD", "Bảng đen", 1)]]]);
  const r = buildGiftLines([line("SP_B", 2, 500_000)], offers, "Đại lễ");
  assert.deepEqual(r.lines.map((l) => [l.productCode, l.quantity]), [["BD", 1]]);
  assert.deepEqual(r.notices, [FLASH_MESSAGES.giftOut("Hộp quà"), FLASH_MESSAGES.giftLimited("Bảng đen", 1)]);
});

test("Chia giảm giá: mã có dòng flash + dòng giá thường chia theo tiền dòng, tổng đúng, quà = 0", () => {
  const flash = { ...line("SP_A", 2, 124_000), flash: { campaignId: "c1", counterId: "x", listPrice: 200_000, salePrice: 124_000 } } as ShopOrderDetail;
  const normal = line("SP_A", 1, 200_000);
  const gift = { ...line("QUA_G", 1, 0), isGift: true } as ShopOrderDetail;
  const details = [flash, normal, gift];
  splitLineDiscounts(details, { SP_A: 30_000, QUA_G: 5_000 });
  assert.equal(flash.discount + normal.discount, 30_000);
  assert.equal(flash.discount, Math.floor((30_000 * 248_000) / 448_000));
  assert.equal(gift.discount, 0);
});

test("Báo giá ship: tách 1 mã thành dòng flash + dòng thường vẫn cùng khoá báo giá", () => {
  const merged = hashQuoteItems([{ productCode: "SP_A", quantity: 3, price: 200_000 }]);
  const split = hashQuoteItems([
    { productCode: "SP_A", quantity: 2, price: 124_000 },
    { productCode: "sp_a", quantity: 1, price: 200_000 },
  ]);
  assert.equal(split, merged);
});

test("FS21: voucher bật 'Không giảm trên sản phẩm Flash Sale' bỏ qua dòng flash", () => {
  const p = promo("VX", { excludeFlash: true });
  assert.equal(isItemInScope({ ma: "SP_A", price: 124_000, quantity: 1, flash: true }, p), false);
  assert.equal(isItemInScope({ ma: "SP_A", price: 200_000, quantity: 1 }, p), true);
  assert.equal(isItemInScope({ ma: "SP_A", price: 124_000, quantity: 1, flash: true }, promo("VY")), true);
});
