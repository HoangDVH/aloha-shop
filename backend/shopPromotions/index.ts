import type { Express } from "express";
import type { GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopAuth/routes.js";
import { registerShopPromotionsPublicRoutes } from "./publicRoutes.js";
import { registerShopPromotionsAdminRoutes } from "./adminRoutes.js";
import { registerVoucherWalletRoutes } from "./wallet/walletRoutes.js";
import { ensureWalletIndexes } from "./wallet/walletService.js";
import { ensureRedemptionIndexes } from "./voucherHistory.js";

export function registerShopPromotionsRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  registerShopPromotionsPublicRoutes(app, getShopDb);
  registerShopPromotionsAdminRoutes(app, getDb, getShopDb);
  registerVoucherWalletRoutes(app, getShopDb);
  void getShopDb()
    .then(ensureWalletIndexes)
    .catch((e) => console.warn("[shopPromotions] wallet index:", e?.message || e));
  void getShopDb()
    .then(ensureRedemptionIndexes)
    .catch((e) => console.warn("[shopPromotions] redemption index:", e?.message || e));
}

export * from "./types.js";
export * from "./evaluator.js";
export * from "./redemptionService.js";
export * from "./customerEligibility.js";
export * from "./phoneNormalization.js";
export * from "./claimService.js";
export * from "./reviewService.js";
