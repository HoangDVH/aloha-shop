import type { CampaignVoucherUI, CampaignViewerUI } from "./campaignApi";

function viewerMayUse(v: CampaignVoucherUI, viewer: CampaignViewerUI | null): boolean {
  if (viewer && !viewer.canUse) return false;
  if (v.targetCustomer === "wholesale") return false;
  if (v.targetCustomer === "new_web" && viewer?.newBuyer === false) return false;
  return true;
}

function inWindow(v: CampaignVoucherUI, nowMs: number): boolean {
  if (v.startDate && Date.parse(v.startDate) > nowMs) return false;
  if (v.endDate && Date.parse(v.endDate) < nowMs) return false;
  return !(v.claimLimitTotal && v.claimedCount >= v.claimLimitTotal);
}

function thresholdMet(v: CampaignVoucherUI, price: number): boolean {
  const min = v.minOrderThreshold || 0;
  if (min <= 0) return true;
  return v.thresholdOperator === ">=" ? price >= min : price > min;
}

export type ShipGoal =
  | { kind: "short"; shortfall: number; pct: number; value: number }
  | { kind: "reached"; value: number };

/**
 * Mốc hỗ trợ ship kế tiếp theo tạm tính giỏ (giá giỏ, chỉ để gợi ý; số thật tính ở giỏ hàng).
 * Đã đạt mốc lớn nhất → "reached"; chưa có voucher ship cố định nào → null.
 */
export function shipGoalFor(
  subtotal: number,
  vouchers: CampaignVoucherUI[],
  viewer: CampaignViewerUI | null,
  nowMs = Date.now()
): ShipGoal | null {
  const ships = vouchers
    .filter((v) => v.benefitType === "shipping" && v.discountType === "fixed" && v.discountValue > 0)
    .filter((v) => viewerMayUse(v, viewer) && inWindow(v, nowMs));
  if (!ships.length) return null;
  const reached = ships.filter((v) => thresholdMet(v, subtotal)).reduce((m, v) => Math.max(m, v.discountValue), 0);
  const next = ships
    .filter((v) => !thresholdMet(v, subtotal) && v.discountValue > reached)
    .sort((a, b) => b.discountValue - a.discountValue || (a.minOrderThreshold || 0) - (b.minOrderThreshold || 0))[0];
  if (!next) return { kind: "reached", value: reached };
  const min = next.minOrderThreshold || 0;
  const raw = Math.max(0, min - subtotal);
  const shortfall = raw === 0 ? 1000 : Math.ceil(raw / 1000) * 1000;
  const pct = min > 0 ? Math.max(4, Math.min(96, Math.round((subtotal / min) * 100))) : 0;
  return { kind: "short", shortfall, pct, value: next.discountValue };
}

/** Mức hỗ trợ ship lớn nhất (voucher cố định) mà 1 sản phẩm giá `price` đã đủ ngưỡng; 0 = không có. */
export function shipSupportFor(
  price: number,
  vouchers: CampaignVoucherUI[],
  viewer: CampaignViewerUI | null,
  nowMs = Date.now()
): number {
  let best = 0;
  for (const v of vouchers) {
    if (v.benefitType !== "shipping" || v.discountType !== "fixed") continue;
    if (!viewerMayUse(v, viewer) || !inWindow(v, nowMs) || !thresholdMet(v, price)) continue;
    best = Math.max(best, v.discountValue);
  }
  return best;
}
