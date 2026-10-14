import type { ShopProduct } from "./api";
import type { AvailablePromotionUI } from "./promotions";
import { voucherMatchesBuyer } from "./voucherAudience";

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
    if (p.scope === "product") {
      const code = String(product.ma).trim().toUpperCase();
      return Boolean(p.productMas?.some(m => m.trim().toUpperCase() === code));
    }
    if (p.scope === "category") {
      const categories = [product.categoryId, product.categorySlug, product.nhom].filter(Boolean).map(String);
      return Boolean(p.categoryIds?.some(id => categories.includes(id)));
    }
    return !p.scope || p.scope === "all";
  });
}

/** Stable customer-group and shipping previews; campaign vouchers stay in the full list. */
export function pdpDefaultVouchers(promotions: AvailablePromotionUI[], viewer: { newBuyer?: boolean } | null | undefined) {
  const target = viewer?.newBuyer === true ? "new_web" : viewer?.newBuyer === false ? "returning_web" : null;
  const goods = target ? promotions.find(p => p.benefitType !== "shipping" && p.targetCustomer === target) : undefined;
  const ship = promotions.filter(p => p.benefitType === "shipping")
    .sort((a, b) => (a.minOrderThreshold || 0) - (b.minOrderThreshold || 0) || a.id.localeCompare(b.id))[0];
  return [goods, ship].filter((p): p is AvailablePromotionUI => Boolean(p));
}
