import test from "node:test";
import assert from "node:assert/strict";
import { shipGoalFor, shipSupportFor } from "../frontend/lib/campaign/voucherPrice.js";
import { countDealsFilters, toDealsFilter } from "../frontend/lib/campaign/dealsFilters.js";
import type { CampaignVoucherUI, CampaignViewerUI } from "../frontend/lib/campaign/campaignApi.js";

const NOW = Date.parse("2026-10-10T05:00:00.000Z");

function v(over: Partial<CampaignVoucherUI>): CampaignVoucherUI {
  return {
    id: "v",
    title: "",
    description: "",
    type: "auto",
    benefitType: "goods",
    discountType: "percentage",
    discountValue: 5,
    claimRequired: false,
    claimLimitTotal: null,
    claimedCount: 0,
    claimStartDate: null,
    ...over,
  };
}

const guest: CampaignViewerUI = {
  loggedIn: false,
  newBuyer: true,
  retail: true,
  locked: false,
  canUse: true,
  lockReason: null,
  lockMessage: null,
};

test("shipSupportFor: ngưỡng toán tử > mặc định, bỏ voucher hết hạn / khách mới với khách cũ / khách sỉ", () => {
  const ship = { benefitType: "shipping" as const, discountType: "fixed" as const, discountValue: 50_000, minOrderThreshold: 2_000_000 };
  assert.equal(shipSupportFor(2_000_000, [v(ship)], guest, NOW), 0);
  assert.equal(shipSupportFor(2_000_000, [v({ ...ship, thresholdOperator: ">=" })], guest, NOW), 50_000);
  assert.equal(shipSupportFor(2_500_000, [v({ ...ship, endDate: "2026-10-01T00:00:00.000Z" })], guest, NOW), 0);
  const returning = { ...guest, loggedIn: true, newBuyer: false };
  assert.equal(shipSupportFor(2_500_000, [v({ ...ship, targetCustomer: "new_web" })], returning, NOW), 0);
  assert.equal(shipSupportFor(2_500_000, [v(ship)], { ...guest, canUse: false }, NOW), 0);
});

test("shipSupportFor: chỉ voucher ship cố định đã đủ ngưỡng bằng 1 SP", () => {
  const list = [
    v({ id: "s30", benefitType: "shipping", discountType: "fixed", discountValue: 30_000, minOrderThreshold: 1_000_000 }),
    v({ id: "s50", benefitType: "shipping", discountType: "fixed", discountValue: 50_000, minOrderThreshold: 2_000_000 }),
  ];
  assert.equal(shipSupportFor(900_000, list, guest, NOW), 0);
  assert.equal(shipSupportFor(1_500_000, list, guest, NOW), 30_000);
  assert.equal(shipSupportFor(2_500_000, list, guest, NOW), 50_000);
});

test("shipGoalFor: nhắm mốc ship lớn nhất chưa đạt, đạt hết thì báo reached", () => {
  const list = [
    v({ id: "s30", benefitType: "shipping", discountType: "fixed", discountValue: 30_000, minOrderThreshold: 1_000_000 }),
    v({ id: "s50", benefitType: "shipping", discountType: "fixed", discountValue: 50_000, minOrderThreshold: 2_000_000 }),
  ];
  assert.deepEqual(shipGoalFor(500_000, list, guest, NOW), { kind: "short", shortfall: 1_500_000, pct: 25, value: 50_000 });
  assert.equal(shipGoalFor(2_000_000, list, guest, NOW)?.kind, "short");
  assert.equal((shipGoalFor(2_000_000, list, guest, NOW) as { shortfall: number }).shortfall, 1000);
  assert.deepEqual(shipGoalFor(2_100_000, list, guest, NOW), { kind: "reached", value: 50_000 });
  assert.equal(shipGoalFor(100, [v({})], guest, NOW), null);
});

test("dealsFilters: lọc theo mức giá, URL lạ về 'all'", () => {
  const c = countDealsFilters([
    { ma: "A", dealHot: true, hasGift: false, price: 250_000 },
    { ma: "B", dealHot: false, hasGift: true, price: 300_000 },
    { ma: "C", dealHot: false, hasGift: true, price: 500_001 },
  ]);
  assert.deepEqual(c, { all: 3, flash: 1, "deal-hot": 1, "qua-tang": 2, "duoi-300k": 1, "300-500k": 1, "tren-500k": 1 });
  assert.equal(toDealsFilter("xyz"), "all");
  assert.equal(toDealsFilter("TREN-500K"), "tren-500k");
});
