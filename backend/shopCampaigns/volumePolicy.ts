import type { ShopOrderDetail } from "../shopOrders/models.js";
import type { ActiveCampaign } from "./currentCampaign.js";
import { buildCampaignPromo } from "./campaignPromo.js";

/** Products shown in campaign offers use the campaign price, never a volume tier. */
export function excludeCampaignVolumePricing(active: ActiveCampaign, details: ShopOrderDetail[], nowMs: number): ShopOrderDetail[] {
  return details.map(line => {
    if (!line.volumePricing || line.isGift) return line;
    const basePrice = line.volumePricing.basePrice;
    const promo = buildCampaignPromo(active, { ma: line.productCode, gia: basePrice }, nowMs, new Map());
    return promo ? { ...line, price: basePrice, volumePricing: undefined } : line;
  });
}
