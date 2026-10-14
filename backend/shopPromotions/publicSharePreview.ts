import type { PublicSharePreview } from "../../shared/publicSharePreview.js";
import type { CampaignQuote } from "../shopCampaigns/quoteCampaign.js";
import type { ActiveCampaign } from "../shopCampaigns/currentCampaign.js";
import type { PromotionDoc } from "./types.js";
import { evaluatePromotions } from "./evaluator.js";
import { claimWindowError } from "./wallet/walletService.js";

/** Read-only preview: no wallet claims, reservations, or account-specific prices. */
export function buildPublicSharePreview(campaign: CampaignQuote, promotions: PromotionDoc[], active: ActiveCampaign | null, walletEnabled: boolean, now: Date): PublicSharePreview {
  const item = campaign.items[0];
  const price = item.price;
  const selling = active && (active.phase === "live" || active.phase === "lastHours") ? active : null;
  const visible = promotions.filter(p => p.isPublic !== false && p.type === "auto" && p.targetCustomer !== "wholesale"
    && !p.mystery && !p.preserveDrawnPercent && (!p.claimRequired || (walletEnabled
      && selling?.content.voucherIds.includes(p.id) && !claimWindowError(p, now.toISOString())
      && (!(Number(p.claimLimitTotal) > 0) || Number(p.claimedCount || 0) < Number(p.claimLimitTotal)))));
  let best: PromotionDoc | undefined;
  let discount = 0;
  // Advertise the best conditional offer across retail audiences, not the sender's entitlement.
  for (const isNewWebBuyer of [true, false]) {
    const quote = evaluatePromotions({ items: campaign.items, promotions: visible, now,
      buyer: { isWholesale: false, isNewWebBuyer, hasSuccessfulWebPurchase: !isNewWebBuyer } });
    for (const candidate of quote.candidates) {
      const promo = visible.find(p => p.id === candidate.promotionId)!;
      if (!candidate.eligible || candidate.calculatedDiscount <= discount) continue;
      if (promo.budgetTotal != null && promo.budgetTotal - promo.budgetUsed - promo.budgetHeld < candidate.calculatedDiscount) continue;
      best = promo;
      discount = candidate.calculatedDiscount;
    }
  }
  const member = selling?.content.products.some(p => p.ma.toUpperCase() === item.ma.toUpperCase() && !p.paused);
  const campaignApplies = member || (best && selling?.content.voucherIds.includes(best.id));
  const expiry = [now.getTime() + 60_000, best?.endDate ? Date.parse(best.endDate) : Infinity,
    selling ? Date.parse(selling.content.info.endAt) : Infinity];
  return { ma: item.ma, price, reference: price + campaign.flashSavings + campaign.anchorSavings,
    finalPrice: Math.max(0, price - discount), expiresAt: new Date(Math.min(...expiry)).toISOString(),
    ...(campaignApplies ? { campaignName: selling!.content.info.name } : {}),
    ...(best ? { voucher: { title: best.title, targetCustomer: best.targetCustomer, claimRequired: best.claimRequired === true } } : {}) };
}
