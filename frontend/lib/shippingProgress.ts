import type { AvailablePromotionUI } from "./promotions";
/** Progress can advertise only shipping offers the server permits for this buyer. */
export function shippingProgressPromotions(items: AvailablePromotionUI[]) {
  return items.filter(p => p.benefitType === "shipping" && p.audienceEligible === true && Number(p.minOrderThreshold) > 0);
}
