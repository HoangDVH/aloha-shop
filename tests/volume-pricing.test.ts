import test from "node:test";
import assert from "node:assert/strict";
import { applyCatalogPrices } from "../backend/shopOrders/orderRouteShared.js";
import { quoteWithCampaign } from "../backend/shopCampaigns/quoteCampaign.js";
import { evaluatePromotions } from "../backend/shopPromotions/evaluator.js";
import { promo } from "./helpers/walletFixtures.js";
import { calculateTierPrice } from "../frontend/lib/volumePricing.js";
const products = [{ ma: "P", ten: "Plant", giaWeb: 150000, giaSi: 100000 }, { ma: "OTHER", ten: "Other", giaWeb: 150000 }];
const db: any = { collection(name: string) { return { find() { return { project() { return this; }, limit() { return this; }, toArray: async () => name === "aloha_products" ? products : [] }; } }; } };
const line = (quantity: number, productCode = "P") => ({ productCode, productName: "Plant", quantity, price: 1 });
test("server and frontend agree at every volume boundary, ignoring forged client prices", async () => {
  for (const quantity of [1, 4, 5, 9, 10, 11]) {
    const result = await applyCatalogPrices(db, [line(quantity)]);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.details[0].price, calculateTierPrice(150000, quantity).unitPrice);
  }
});
test("duplicate SKU quantities aggregate; different SKUs, gifts and wholesale prices stay independent", async () => {
  const result = await applyCatalogPrices(db, [line(4), line(6), line(4, "OTHER")]);
  if (!result.ok) throw new Error(result.error);
  assert.deepEqual(result.details.map(d => d.price), [135000, 135000, 150000]);
  const wholesale = await applyCatalogPrices(db, [line(10)], { account: { roles: ["si"], active: true, siStatus: "active", siRegion: "HCM" } });
  if (!wholesale.ok) throw new Error(wholesale.error);
  assert.equal(wholesale.details[0].price, 100000);
  assert.equal(wholesale.details[0].volumePricing, undefined);
  const gifts = await applyCatalogPrices(db, [line(4), { ...line(10), isGift: true }]);
  if (!gifts.ok) throw new Error(gifts.error);
  assert.equal(gifts.details[0].price, 150000);
});
test("10 plants at 150k get 150k volume savings then 67.5k voucher, totaling 1282500", async () => {
  const result = await applyCatalogPrices(db, [line(10)]);
  if (!result.ok) throw new Error(result.error);
  const previous = process.env.SHOP_CAMPAIGN_ENABLED;
  process.env.SHOP_CAMPAIGN_ENABLED = "0";
  try {
    const campaign = await quoteWithCampaign(db, result.details.map(d => ({ ma: d.productCode, price: d.price, quantity: d.quantity, volumePricing: d.volumePricing })), {});
    assert.equal(campaign.volumeSavings, 150000);
    const quote = evaluatePromotions({ items: campaign.items, promotions: [promo("NEW5", { targetCustomer: "new_web", discountType: "percentage", discountValue: 5 })], buyer: { isNewWebBuyer: true }, now: new Date() });
    assert.equal(quote.subtotal, 1350000);
    assert.equal(quote.discountTotal, 67500);
    assert.equal(quote.finalTotal, 1282500);
    assert.equal(quote.subtotal + campaign.volumeSavings, 1500000);
  } finally { if (previous === undefined) delete process.env.SHOP_CAMPAIGN_ENABLED; else process.env.SHOP_CAMPAIGN_ENABLED = previous; }
});
