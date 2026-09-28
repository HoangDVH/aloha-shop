import type { Express } from "express";
import type { GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopAuth/routes.js";
import { registerShopPromotionsPublicRoutes } from "./publicRoutes.js";
import { registerShopPromotionsAdminRoutes } from "./adminRoutes.js";

export function registerShopPromotionsRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  registerShopPromotionsPublicRoutes(app, getShopDb);
  registerShopPromotionsAdminRoutes(app, getDb, getShopDb);
}

export * from "./types.js";
export * from "./evaluator.js";
export * from "./redemptionService.js";
export * from "./customerEligibility.js";
