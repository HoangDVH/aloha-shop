import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePromotions,
  evaluateShippingPromotions,
} from "../backend/shopPromotions/evaluator.js";
import {
  DEFAULT_SHIPPING_REGIONS,
  canonicalDistrict,
  canonicalProvince,
  matchShippingRegion,
} from "../backend/shopShipping/shippingRegions.js";
import type { PromotionDoc } from "../backend/shopPromotions/types.js";

const HCM = DEFAULT_SHIPPING_REGIONS[0];
const HCM_ADDRESS = { province: "Thành phố Hồ Chí Minh", district: "Quận Bình Thạnh" };
const ITEMS_500K = [{ ma: "SP1", price: 500_000, quantity: 1 }];

const SHIP_PROMO: PromotionDoc = {
  id: "SHIP_HCM_30K",
  name: "Hỗ trợ ship HCM 30k",
  title: "Hỗ trợ phí ship 30.000đ nội thành TP.HCM",
  type: "auto",
  benefitType: "shipping",
  regionId: "hcm_pre_2025",
  discountType: "fixed",
  discountValue: 30_000,
  scope: "all",
  targetCustomer: "all",
  usageLimitTotal: 100,
  budgetTotal: 3_000_000,
  budgetUsed: 0,
  budgetHeld: 0,
  usedCount: 0,
  heldCount: 0,
  status: "active",
  priority: 0,
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const GOODS_PROMO: PromotionDoc = {
  ...SHIP_PROMO,
  id: "GOODS_100K",
  title: "Giảm 100.000đ",
  benefitType: "goods",
  regionId: undefined,
  discountValue: 100_000,
  usageLimitTotal: undefined,
  budgetTotal: undefined,
};

function evalShip(overrides: Partial<Parameters<typeof evaluateShippingPromotions>[0]> = {}) {
  return evaluateShippingPromotions({
    items: ITEMS_500K,
    buyer: {},
    promotions: [SHIP_PROMO],
    deliveryMethod: "giao_tan_noi",
    shippingFee: 25_000,
    freeShipApplied: false,
    matchRegion: () => matchShippingRegion(HCM, HCM_ADDRESS),
    ...overrides,
  });
}

test("SV01: chuẩn hoá tên tỉnh và quận/huyện", () => {
  assert.equal(canonicalProvince("Thành phố Hồ Chí Minh"), "ho chi minh");
  assert.equal(canonicalProvince("TP.HCM"), "hcm");
  assert.equal(canonicalDistrict("Quận 01"), "quan 1");
  assert.equal(canonicalDistrict("Quận Bình Thạnh"), "binh thanh");
  assert.equal(canonicalDistrict("Thành phố Thủ Đức"), "thu duc");
  assert.equal(canonicalDistrict("Huyện Củ Chi"), "cu chi");
});

test("SV-REGION-02: quận/huyện TP.HCM cũ khớp vùng", () => {
  for (const district of ["Quận 1", "Quận 12", "Quận Gò Vấp", "Thành phố Thủ Đức", "Huyện Cần Giờ"]) {
    const m = matchShippingRegion(HCM, { province: "TP. Hồ Chí Minh", district });
    assert.equal(m.status, "matched", district);
  }
});

test("SV02: Bình Dương / Vũng Tàu cũ nằm ngoài vùng dù cùng TP.HCM mới", () => {
  const thuanAn = matchShippingRegion(HCM, { province: "Hồ Chí Minh", district: "Thành phố Thuận An" });
  assert.equal(thuanAn.status, "outside");
  const binhDuong = matchShippingRegion(HCM, { province: "Bình Dương", district: "Thủ Dầu Một" });
  assert.equal(binhDuong.status, "outside");
});

test("SV-REGION-04: thiếu tỉnh hoặc quận thì không xác định, không áp dụng", () => {
  assert.equal(matchShippingRegion(HCM, { province: "", district: "Quận 1" }).status, "unknown");
  assert.equal(matchShippingRegion(HCM, { province: "Hồ Chí Minh", district: "" }).status, "unknown");
});

test("SV-REGION-05: khớp theo mã quận GHN khi đã cấu hình", () => {
  const region = { ...HCM, ghnDistrictIds: [1442] };
  const m = matchShippingRegion(region, { province: "", district: "", ghnDistrictId: 1442 });
  assert.equal(m.status, "matched");
  assert.equal(m.status === "matched" && m.source, "ghn_district");
});

test("SV06: phí 18k < mệnh giá 30k → giảm 18k (không vượt phí ship)", () => {
  const r = evalShip({ shippingFee: 18_000 });
  assert.equal(r.applied?.discountAmount, 18_000);
  assert.equal(r.applied?.regionId, "hcm_pre_2025");
});

test("SV06b: phí 45k → giảm đúng mệnh giá 30k", () => {
  assert.equal(evalShip({ shippingFee: 45_000 }).applied?.discountAmount, 30_000);
});

test("SV07: đơn đã miễn ship → không áp voucher ship", () => {
  const r = evalShip({ shippingFee: 0, freeShipApplied: true });
  assert.equal(r.applied, undefined);
  assert.equal(r.candidates[0].eligible, false);
});

test("SV08: nhận tại cửa hàng → không áp", () => {
  const r = evalShip({ deliveryMethod: "nhan_cua_hang", shippingFee: 0 });
  assert.equal(r.applied, undefined);
});

test("SV09: chưa có phí (chờ shop báo) → pending, không áp số tiền", () => {
  const r = evalShip({ shippingFee: null });
  assert.equal(r.applied, undefined);
  assert.equal(r.pending?.promotionId, "SHIP_HCM_30K");
  assert.equal(r.pending?.maxDiscount, 30_000);
});

test("SV04: địa chỉ ngoài vùng → không áp", () => {
  const r = evalShip({
    matchRegion: () => matchShippingRegion(HCM, { province: "Đồng Nai", district: "Biên Hòa" }),
  });
  assert.equal(r.applied, undefined);
});

test("SV13: ngưỡng tính trên tiền hàng chưa trừ mã giảm toàn đơn", () => {
  const promo = { ...SHIP_PROMO, minOrderThreshold: 500_000, thresholdOperator: ">=" as const };
  // Giỏ 500k đạt ngưỡng dù mã giảm hàng 100k làm tiền hàng sau giảm còn 400k.
  const r = evalShip({ promotions: [promo] });
  assert.equal(r.applied?.discountAmount, 25_000);
  const under = evalShip({ promotions: [promo], items: [{ ma: "SP1", price: 499_000, quantity: 1 }] });
  assert.equal(under.applied, undefined);
});

test("SV15: nhiều voucher ship → chọn giảm nhiều nhất, hoà thì theo độ ưu tiên", () => {
  const small = { ...SHIP_PROMO, id: "SHIP_20K", discountValue: 20_000, priority: 99 };
  const big = { ...SHIP_PROMO, id: "SHIP_40K", discountValue: 40_000 };
  assert.equal(evalShip({ shippingFee: 50_000, promotions: [small, big] }).applied?.promotionId, "SHIP_40K");

  const tieLow = { ...SHIP_PROMO, id: "SHIP_A", priority: 1 };
  const tieHigh = { ...SHIP_PROMO, id: "SHIP_B", priority: 5 };
  assert.equal(evalShip({ promotions: [tieLow, tieHigh] }).applied?.promotionId, "SHIP_B");
});

test("SV21: áp dụng cho khách sỉ khi đối tượng là Tất cả", () => {
  const r = evalShip({ buyer: { isWholesale: true } });
  assert.equal(r.applied?.discountAmount, 25_000);
});

test("SV25: khách đã dùng hết lượt mỗi khách → không áp", () => {
  const promo = { ...SHIP_PROMO, usageLimitPerCustomer: 1 };
  assert.equal(evalShip({ promotions: [promo], customerUsage: { SHIP_HCM_30K: 1 } }).applied, undefined);
  assert.equal(evalShip({ promotions: [promo], customerUsage: {} }).applied?.discountAmount, 25_000);
});

test("SV26: ngân sách còn ít hơn số giảm → không giảm một phần", () => {
  const promo = { ...SHIP_PROMO, budgetTotal: 3_000_000, budgetUsed: 2_980_000 };
  assert.equal(evalShip({ promotions: [promo], shippingFee: 45_000 }).applied, undefined);
  // Còn 20k, phí 18k → vẫn đủ ngân sách.
  assert.equal(evalShip({ promotions: [promo], shippingFee: 18_000 }).applied?.discountAmount, 18_000);
});

test("SV28: hết tổng lượt → không áp", () => {
  const promo = { ...SHIP_PROMO, usedCount: 99, heldCount: 1 };
  assert.equal(evalShip({ promotions: [promo] }).applied, undefined);
});

test("SV14: evaluatePromotions (giảm tiền hàng) bỏ qua voucher ship", () => {
  const r = evaluatePromotions({
    items: ITEMS_500K,
    buyer: {},
    promotions: [SHIP_PROMO, GOODS_PROMO],
  });
  assert.equal(r.applied?.promotionId, "GOODS_100K");
  assert.equal(r.discountTotal, 100_000);
  assert.ok(!r.candidates.some((c) => c.promotionId === "SHIP_HCM_30K"));
});
