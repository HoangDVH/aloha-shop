import test from "node:test";
import assert from "node:assert/strict";
import { applyBuyerRules, withBuyerNotices } from "../backend/shopPromotions/wallet/walletRules.js";
import { claimWindowError, isClaimFail } from "../backend/shopPromotions/wallet/walletService.js";
import { walletItemState } from "../backend/shopPromotions/wallet/walletRoutes.js";
import { claimedEditError, buildPromotionUpdate } from "../backend/shopPromotions/admin/promotionPayload.js";
import { NOT_COMBINABLE_REASON, resolveGoodsShipCombo } from "../backend/shopPromotions/combineShip.js";
import { evaluatePromotions, evaluateShippingPromotions } from "../backend/shopPromotions/evaluator.js";
import type { PromotionDoc } from "../backend/shopPromotions/types.js";
import {
  LOCKED,
  RETAIL,
  V30K,
  V50K_RIENG,
  VNEW,
  VSHIP,
  VSHIP_LUU,
  VSI,
  WHOLESALE,
  promo,
} from "./helpers/walletFixtures.js";

const NOW = new Date("2026-10-01T03:00:00.000Z");
const none = new Set<string>();
const matched = () =>
  ({ status: "matched", regionId: "hcm_noi_thanh", regionVersion: 1, source: "name" }) as const;

function rules(promotions: PromotionDoc[], opts: Partial<Parameters<typeof applyBuyerRules>[1]> = {}) {
  return applyBuyerRules(promotions, {
    status: RETAIL,
    campaignVoucherIds: new Set(["V30K", "VSHIP_LUU"]),
    saved: none,
    walletOn: true,
    ...opts,
  });
}

function goods(promotions: PromotionDoc[], lines: Array<[string, number, number]>, selectedCode = "") {
  return evaluatePromotions({
    items: lines.map(([ma, price, quantity]) => ({ ma, price, quantity })),
    promotions,
    selectedCode,
    now: NOW,
  });
}

function ship(promotions: PromotionDoc[], fee: number | null, over: Record<string, unknown> = {}) {
  return evaluateShippingPromotions({
    items: [{ ma: "X", price: 378_000, quantity: 1 }],
    promotions,
    deliveryMethod: "giao_tan_noi",
    shippingFee: fee,
    freeShipApplied: false,
    matchRegion: matched,
    now: NOW,
    ...over,
  } as any);
}

test("WL09: voucher phải lưu chưa lưu → không áp, lý do 'Bạn chưa lưu voucher này' kèm nút Lưu", () => {
  const r = rules([V30K()]);
  assert.equal(r.promotions.length, 0);
  assert.equal(r.notices[0].ineligibleReason, "Bạn chưa lưu voucher này.");
  assert.equal(r.notices[0].needsClaim, true);
});

test("WL10: đã lưu V30K, đơn 400.000đ → tự áp giảm 30.000đ", () => {
  const r = rules([V30K()], { saved: new Set(["V30K"]) });
  const q = goods(r.promotions, [["SP_X", 400_000, 1]]);
  assert.equal(q.applied?.promotionId, "V30K");
  assert.equal(q.discountTotal, 30_000);
});

test("WL22: cờ ví tắt → voucher phải lưu chạy như voucher thường", () => {
  const r = rules([V30K()], { walletOn: false });
  assert.deepEqual(r.promotions.map((p) => p.id), ["V30K"]);
  assert.equal(r.notices.length, 0);
});

test("KL08: KH_SI áp voucher chiến dịch → loại, 'Dành cho khách lẻ'; voucher ngoài chiến dịch theo quy tắc cũ", () => {
  const outside = promo("VTHUONG");
  const r = rules([V30K(), outside, VSI()], { status: WHOLESALE, saved: new Set(["V30K"]) });
  assert.deepEqual(r.promotions.map((p) => p.id).sort(), ["VSI", "VTHUONG"]);
  assert.match(r.notices[0].ineligibleReason || "", /khách lẻ/);
});

test("KL10: đã lưu V30K rồi thành CTV → vẫn không áp được", () => {
  const r = rules([V30K()], { status: WHOLESALE, saved: new Set(["V30K"]) });
  assert.equal(r.promotions.length, 0);
});

test("EX14: tài khoản bị khoá → không áp voucher chiến dịch, báo lý do", () => {
  const r = rules([V30K()], { status: LOCKED, saved: new Set(["V30K"]) });
  assert.equal(r.promotions.length, 0);
  assert.match(r.notices[0].ineligibleReason || "", /khoá/);
});

test("Voucher riêng tư bị loại không lộ ra trong danh sách lý do", () => {
  const r = rules([promo("VAN", { claimRequired: true, isPublic: false })]);
  assert.equal(r.promotions.length, 0);
  assert.equal(r.notices.length, 0);
});

test("WL16: chưa tới giờ mở lưu → từ chối claim_not_started", () => {
  const p = V30K();
  p.claimStartDate = "2026-09-28T17:00:00.000Z";
  const r = claimWindowError(p, "2026-09-27T00:00:00.000Z");
  assert.ok(r && isClaimFail(r));
  if (r && isClaimFail(r)) assert.equal(r.code, "claim_not_started");
  assert.equal(claimWindowError(p, "2026-09-29T00:00:00.000Z"), null);
});

test("WL15/WL17/WL19: trạng thái vé trong ví", () => {
  const p = V30K();
  p.endDate = "2026-10-03T16:59:00.000Z";
  const iso = NOW.toISOString();
  assert.equal(walletItemState({ status: "saved" }, p, true, iso), "usable");
  assert.equal(walletItemState({ status: "held" }, p, true, iso), "held");
  assert.equal(walletItemState({ status: "used" }, p, true, iso), "used");
  assert.equal(walletItemState({ status: "saved" }, p, true, "2026-10-04T00:00:00.000Z"), "expired");
  assert.equal(walletItemState({ status: "saved" }, { ...p, status: "paused" }, true, iso), "paused");
  assert.equal(walletItemState({ status: "saved" }, p, false, iso), "locked");
  assert.equal(walletItemState({ status: "saved" }, p, true, "2026-09-29T00:00:00.000Z"), "upcoming");
});

test("WL18: voucher đã có khách lưu → khoá sửa giá trị; sửa tên vẫn được", () => {
  const existing = { ...V30K(), claimedCount: 3 };
  assert.match(claimedEditError(existing, { discountValue: 20_000 }) || "", /nhân bản/);
  assert.equal(claimedEditError(existing, { discountValue: 30_000, name: "Đổi tên" }), null);
  const r = buildPromotionUpdate({ discountValue: 25_000 }, existing, "tester", NOW.toISOString());
  assert.equal(r.ok, false);
});

test("EX08: tổng lượt lưu V30K (đã lưu 3) → 2 bị chặn, 5 được", () => {
  const existing = { ...V30K(), claimedCount: 3 };
  const low = buildPromotionUpdate({ claimLimitTotal: 2 }, existing, "tester", NOW.toISOString());
  assert.equal(low.ok, false);
  if (!low.ok) assert.match(low.error, /Đã có 3 khách lưu/);
  const high = buildPromotionUpdate({ claimLimitTotal: 5 }, existing, "tester", NOW.toISOString());
  assert.equal(high.ok, true);
});

test("WL24: V30K + VSHIP trên đơn 378.000đ, phí ship 35.000đ → -30.000đ mỗi loại", () => {
  const q = goods([V30K()], [["SP_A", 124_000, 2], ["SP_C", 50_000, 1], ["SP_T", 80_000, 1]]);
  assert.equal(q.subtotal, 378_000);
  assert.equal(q.discountTotal, 30_000);
  const s = ship([VSHIP()], 35_000);
  assert.equal(s.applied?.discountAmount, 30_000);
});

test("WL25: phí ship 18.000đ → voucher ship giảm đúng 18.000đ", () => {
  assert.equal(ship([VSHIP()], 18_000).applied?.discountAmount, 18_000);
});

test("WL26: đã miễn ship / nhận tại cửa hàng / ngoài vùng → không áp voucher ship", () => {
  assert.equal(ship([VSHIP()], 35_000, { freeShipApplied: true }).applied, undefined);
  assert.equal(ship([VSHIP()], 0, { deliveryMethod: "nhan_cua_hang" }).applied, undefined);
  const outside = ship([VSHIP()], 35_000, { matchRegion: () => ({ status: "outside", reason: "Ngoài vùng" }) });
  assert.equal(outside.applied, undefined);
  assert.equal(outside.candidates[0].ineligibleReason, "Ngoài vùng");
});

test("WL27: VSHIP_LUU chưa lưu → không áp; đã lưu → -20.000đ", () => {
  assert.equal(rules([VSHIP_LUU()]).promotions.length, 0);
  const saved = rules([VSHIP_LUU()], { saved: new Set(["VSHIP_LUU"]) }).promotions;
  const s = ship(saved, 30_000, { items: [{ ma: "X", price: 250_000, quantity: 1 }] });
  assert.equal(s.applied?.discountAmount, 20_000);
});

test("WL28: V50K_RIENG một mình (50K) thua V30K + VSHIP (60K) → chọn phương án 60K", async () => {
  const list = [V30K(), V50K_RIENG(), VSHIP()];
  const lines: Array<[string, number, number]> = [["SP_X", 420_000, 1]];
  const first = goods(list, lines);
  assert.equal(first.applied?.promotionId, "V50K_RIENG");
  const combo = await resolveGoodsShipCombo({
    goods: first,
    ship: ship(list, 30_000),
    promotions: list,
    manualCode: false,
    reevaluateGoods: async (p) => goods(p, lines),
  });
  assert.equal(combo.goods.applied?.promotionId, "V30K");
  assert.equal(combo.ship?.applied?.discountAmount, 30_000);
});

test("WL28: khách tự chọn V50K_RIENG → bỏ voucher ship kèm lý do không dùng chung", async () => {
  const list = [V30K(), V50K_RIENG(), VSHIP()];
  const first = goods(list, [["SP_X", 420_000, 1]]);
  const combo = await resolveGoodsShipCombo({
    goods: first,
    ship: ship(list, 30_000),
    promotions: list,
    manualCode: true,
    reevaluateGoods: async () => assert.fail("không được tính lại khi khách tự chọn"),
  });
  assert.equal(combo.goods.applied?.promotionId, "V50K_RIENG");
  assert.equal(combo.ship?.applied, undefined);
  assert.equal(combo.ship?.candidates[0].ineligibleReason, NOT_COMBINABLE_REASON);
});

test("CT03: KH_MOI lưu V30K và VNEW, giỏ 400.000đ → tự áp VNEW (40K > 30K)", () => {
  const r = rules([V30K(), VNEW()], { saved: new Set(["V30K", "VNEW"]) });
  assert.equal(goods(r.promotions, [["SP_X", 400_000, 1]]).applied?.promotionId, "VNEW");
});

test("Nhập mã của voucher bị loại → thay dòng 'không hoạt động' bằng lý do cụ thể", () => {
  const quote = {
    candidates: [
      {
        promotionId: "invalid_code",
        title: "Mã V30K",
        type: "code" as const,
        code: "V30K",
        discountType: "fixed" as const,
        discountValue: 0,
        eligible: false,
        ineligibleReason: "Chương trình ưu đãi của mã này không còn hoạt động.",
        calculatedDiscount: 0,
      },
    ],
  };
  const buyer = { ...rules([V30K()], { status: WHOLESALE }), status: WHOLESALE, codePromotionId: "V30K" };
  const merged = withBuyerNotices(quote, buyer, "v30k");
  assert.equal(merged.candidates.length, 1);
  assert.equal(merged.candidates[0].promotionId, "V30K");
  assert.equal(merged.candidates[0].code, "V30K");
  assert.match(merged.candidates[0].ineligibleReason || "", /khách lẻ/);
});
