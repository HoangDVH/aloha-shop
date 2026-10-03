import type { PromotionDoc } from "../../backend/shopPromotions/types.js";

/** Voucher mẫu của bộ test chiến dịch (docs/TESTCASE_CHIEN_DICH_UU_DAI.md mục 0). */
export function promo(id: string, over: Partial<PromotionDoc> = {}): PromotionDoc {
  return {
    id,
    name: id,
    title: id,
    type: "auto",
    benefitType: "goods",
    discountType: "fixed",
    discountValue: 30_000,
    minOrderThreshold: 350_000,
    thresholdOperator: ">=",
    scope: "all",
    targetCustomer: "retail",
    budgetUsed: 0,
    budgetHeld: 0,
    usedCount: 0,
    heldCount: 0,
    status: "active",
    isPublic: true,
    combineWithShip: true,
    priority: 0,
    revision: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

export const V30K = () =>
  promo("V30K", { claimRequired: true, claimLimitTotal: 3, claimedCount: 0, startDate: "2026-09-30T17:00:00.000Z" });
export const VNEW = () =>
  promo("VNEW", { claimRequired: true, targetCustomer: "new_web", discountValue: 40_000, minOrderThreshold: 0 });
export const V50K_RIENG = () =>
  promo("V50K_RIENG", { discountValue: 50_000, minOrderThreshold: 400_000, combineWithShip: false });
export const VSHIP = () =>
  promo("VSHIP", {
    benefitType: "shipping",
    discountValue: 30_000,
    minOrderThreshold: 350_000,
    regionId: "hcm_noi_thanh",
    usageLimitTotal: 100,
  });
export const VSHIP_LUU = () =>
  promo("VSHIP_LUU", {
    benefitType: "shipping",
    claimRequired: true,
    discountValue: 20_000,
    minOrderThreshold: 200_000,
    regionId: "hcm_noi_thanh",
    usageLimitTotal: 100,
  });
export const VSI = () => promo("VSI", { targetCustomer: "wholesale" });

export const RETAIL = { retail: true, locked: false, isTestBuyer: false };
export const WHOLESALE = { retail: false, locked: false, isTestBuyer: false };
export const LOCKED = { retail: true, locked: true, isTestBuyer: false };
