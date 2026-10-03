import type { Express } from "express";
import type { Db } from "mongodb";
import type { GetDb as GetOpsDb } from "../auth/middleware.js";
import { ensureCampaignIndexes } from "./campaignRepo.js";
import { ensureCampaignStatsIndexes } from "./stats/campaignStats.js";
import { registerCampaignAdminRoutes } from "./routes/admin.routes.js";
import { registerCampaignPublicRoutes } from "./routes/public.routes.js";
import { registerCampaignBestSellerRoutes } from "./routes/bestSellers.routes.js";
import { registerCampaignEngageRoutes } from "./routes/engage.routes.js";
import { setFlashStockLookupFactory } from "./catalogPromos.js";
import { flashStockLookup } from "./flash/flashOffers.js";
import { anchorStockLookup } from "./anchorSales.js";
import { ensureFlashCounterIndexes } from "./flash/flashCounters.js";
import { flashSaleEnabled } from "./flags.js";
import { ensureCampaignHoldIndex } from "./worker/reconcileCounters.js";

export function registerShopCampaignRoutes(app: Express, getOpsDb: GetOpsDb, getShopDb: () => Promise<Db>) {
  registerCampaignPublicRoutes(app, getShopDb);
  registerCampaignBestSellerRoutes(app, getShopDb);
  registerCampaignEngageRoutes(app, getShopDb);
  registerCampaignAdminRoutes(app, getOpsDb, getShopDb);
  setFlashStockLookupFactory(async (db, active, nowMs) => {
    const [flash, anchor] = await Promise.all([
      flashSaleEnabled() ? flashStockLookup(db, active, nowMs) : undefined,
      anchorStockLookup(db, active, nowMs),
    ]);
    if (!flash && !anchor) return undefined;
    return (p, counterId) => (p.salePrice > 0 ? flash?.(p) ?? null : anchor?.(p, counterId) ?? null);
  });
  void getShopDb()
    .then(async (db) => {
      await ensureCampaignIndexes(db);
      await ensureCampaignStatsIndexes(db);
      await ensureFlashCounterIndexes(db);
      await ensureCampaignHoldIndex(db);
    })
    .catch((e) => console.warn("[shopCampaigns] index:", e?.message || e));
}

export * from "./types.js";
export { getPhase, openSlotWindow, flashCounterId, vnDayKey } from "./campaignPhase.js";
export { isRetailAccount, isRetailBuyer, resolveRetailStatus } from "./retail.js";
export { getCurrentCampaign } from "./currentCampaign.js";
export { campaignEnabled, voucherWalletEnabled, flashSaleEnabled } from "./flags.js";
