import test from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { excludeCampaignVolumePricing } from "../backend/shopCampaigns/volumePolicy.js";
import { applyFlashOffers } from "../backend/shopCampaigns/flash/flashPricing.js";
import { quoteWithCampaign } from "../backend/shopCampaigns/quoteCampaign.js";
import { priceOrderWithCampaign, goodsSubtotal } from "../backend/shopOrders/create/campaignStep.js";
import { clearCurrentCampaignCache } from "../backend/shopCampaigns/currentCampaign.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";
import type { ShopOrderDetail } from "../backend/shopOrders/models.js";

const now = vn("2026-10-01T10:00");
const content = daiLeContent();
content.products = [{ma: "GSDL", salePrice: 0, quota: 0, perCustomerLimit: 2, compareAtPrice: 344000}];
const active = {id: "campaign", content, phase: "live" as const, publishedAt: null};
const line = (code = "GSDL"): ShopOrderDetail => ({productCode: code, productName: code, quantity: 31, price: 225000,
  volumePricing: {basePrice: 250000, discountPercent: 10, quantity: 31}});

test("campaign deal restores 250K and removes volume discount; ordinary products retain their tier", () => {
  const input = [line(), line("NORMAL")];
  const out = excludeCampaignVolumePricing(active, input, now);
  assert.equal(out[0].price, 250000);
  assert.equal(out[0].volumePricing, undefined);
  assert.equal(out[1].price, 225000);
  assert.equal(out[1].volumePricing?.discountPercent, 10);
  assert.equal(input[0].price, 225000);
});

test("paused or unpromoted campaign rows do not suppress volume discounts", () => {
  for (const row of [{...content.products[0], paused: true}, {...content.products[0], compareAtPrice: undefined}]) {
    const campaign = {...active, content: {...content, products: [row]}};
    assert.equal(excludeCampaignVolumePricing(campaign, [line()], now)[0].price, 225000);
  }
});

test("flash limit overflow uses normal web price without restoring a volume tier", () => {
  const campaign = {...active, content: {...content, products: [{...content.products[0], salePrice: 200000, compareAtPrice: undefined, quota: 2}]}};
  const prepared = excludeCampaignVolumePricing(campaign, [line()], now);
  const result = applyFlashOffers(prepared, new Map([["GSDL", {campaignId: "campaign", ma: "GSDL", salePrice: 200000,
    counterId: "counter", quota: 2, perCustomerLimit: 2, remaining: 2, customerRemaining: 2}]]));
  assert.deepEqual(result.details.map(d => [d.price, d.quantity, d.volumePricing]), [[200000, 2, undefined], [250000, 29, undefined]]);
});

test("real quote pipeline: mixed basket excludes campaign volume savings and retains normal product savings", async () => {
  const previous = [process.env.SHOP_CAMPAIGN_ENABLED, process.env.SHOP_FLASH_SALE_ENABLED];
  process.env.SHOP_CAMPAIGN_ENABLED = "1"; process.env.SHOP_FLASH_SALE_ENABLED = "1";
  const current = Date.now();
  const liveContent = {...content, info: {...content.info, startAt: new Date(current - 60000).toISOString(), endAt: new Date(current + 86400000).toISOString()}};
  const db = {collection: () => ({find: () => ({toArray: async () => [{_id: "campaign", status: "published", published: liveContent}]})})} as unknown as Db;
  clearCurrentCampaignCache();
  try {
    const q = await quoteWithCampaign(db, [
      {ma: "GSDL", ten: "GSDL", quantity: 31, price: 225000, volumePricing: line().volumePricing},
      {ma: "NORMAL", ten: "NORMAL", quantity: 31, price: 225000, volumePricing: line().volumePricing},
    ], {});
    assert.equal(q.lines[0].price, 250000);
    assert.equal(q.lines[0].compareAtPrice, 344000);
    assert.equal(q.anchorSavings, 2914000);
    assert.equal(q.volumeSavings, 775000);
    assert.equal(q.items[0].price * q.items[0].quantity, 7750000);
    assert.equal(q.items[1].price, 225000);
    const order = await priceOrderWithCampaign(db, [line(), line("NORMAL")], {}, 14725000);
    assert.equal(order.ok, true);
    if (order.ok) {
      assert.equal(goodsSubtotal(order.details), q.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
      assert.equal(order.details[0].volumePricing, undefined);
    }
    const staleOrder = await priceOrderWithCampaign(db, [line()], {}, 6975000);
    assert.equal(staleOrder.ok, false);
    if (!staleOrder.ok) assert.equal(staleOrder.status, 409);
  } finally {
    for (const [i, key] of ["SHOP_CAMPAIGN_ENABLED", "SHOP_FLASH_SALE_ENABLED"].entries()) {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
    }
    clearCurrentCampaignCache();
  }
});
