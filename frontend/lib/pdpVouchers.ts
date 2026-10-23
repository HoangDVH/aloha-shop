import type { ShopProduct } from "./api";
import type { AvailablePromotionUI } from "./promotions";
import { voucherMatchesBuyer } from "./voucherAudience";
import { productMatchesVoucher } from "./productVoucherScope";

/** Audience eligibility includes vouchers the buyer can claim, not just saved ones. */
export function pdpApplicableVouchers(promotions: AvailablePromotionUI[], product: ShopProduct,
  viewer: { newBuyer?: boolean } | null | undefined, isWholesale = false, now = Date.now()) {
  return promotions.filter(p => {
    if (p.audienceEligible !== true || !voucherMatchesBuyer(p.targetCustomer, viewer)) return false;
    if (p.targetCustomer === "wholesale" && !isWholesale) return false;
    // The server may explicitly allow retail shipping vouchers for wholesale buyers.
    if (p.targetCustomer === "retail" && isWholesale && p.benefitType !== "shipping") return false;
    if (p.startDate && !(Date.parse(p.startDate) <= now)) return false;
    if (p.endDate && !(Date.parse(p.endDate) > now)) return false;
    return productMatchesVoucher(product, p, now);
  });
}

/** Stable customer-group and shipping previews; campaign vouchers stay in the full list. */
export function pdpDefaultVouchers(promotions: AvailablePromotionUI[], viewer: { newBuyer?: boolean } | null | undefined) {
  const target = viewer?.newBuyer === true ? "new_web" : viewer?.newBuyer === false ? "returning_web" : null;
  const goods = target ? promotions.find(p => p.benefitType !== "shipping" && p.targetCustomer === target) : undefined;
  const ship = promotions.filter(p => p.benefitType === "shipping")
    .sort((a, b) => (a.minOrderThreshold || 0) - (b.minOrderThreshold || 0) || a.id.localeCompare(b.id))[0];
  const delayed = promotions.find(p => p.benefitType !== "shipping" && (p.minLeadDays || 0) >= 3);
  return [goods, delayed, ship].filter((p): p is AvailablePromotionUI => Boolean(p));
}

/** Saved vouchers remain visible with a reason, without becoming applicable previews. */
export function pdpVoucherSheetEntries(promotions: AvailablePromotionUI[], product: ShopProduct,
  viewer: { newBuyer?: boolean } | null | undefined, claimed: Set<string>, isWholesale = false, now = Date.now()) {
  const applicable = new Set(pdpApplicableVouchers(promotions, product, viewer, isWholesale, now));
  return promotions.filter(p => applicable.has(p) || (claimed.has(p.id) && voucherMatchesBuyer(p.targetCustomer, viewer)))
    .map(p => ({ promotion: p, reason: applicable.has(p) ? undefined : p.ineligibleReason
      ? p.ineligibleReason
      : !productMatchesVoucher(product, p, now) ? "Không áp dụng cho sản phẩm này."
      : p.endDate && Date.parse(p.endDate) <= now ? "Voucher đã hết hạn."
      : p.startDate && Date.parse(p.startDate) > now ? "Voucher chưa bắt đầu."
      : "Voucher chưa áp dụng cho tài khoản này." }));
}
