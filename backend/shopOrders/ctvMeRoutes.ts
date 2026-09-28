/**
 * Portal CTV — stats / commissions / bills (JWT shop).
 * Orchestrator delegating to modular route handlers in ./ctvMe/
 */
import type { Express } from "express";
import type { GetShopDb } from "../shopAuth/routes.js";
import type { GetDb } from "../auth/middleware.js";
import {
  buildCtvMeCtx,
  CTV_COMMISSION_UX,
  summarizeCtvCommissionStatus,
} from "./ctvMe/shared.js";
import { registerCtvMeStatsRoute } from "./ctvMe/stats.route.js";
import { registerCtvMeOverviewRoute } from "./ctvMe/overview.route.js";
import { registerCtvMeCommissionsRoute } from "./ctvMe/commissions.route.js";
import { registerCtvMeBillsRoute } from "./ctvMe/bills.route.js";
import { registerCtvMeConversionsRoute } from "./ctvMe/conversions.route.js";
import { registerCtvMeStreamRoute } from "./ctvMe/stream.route.js";
import { registerCtvMeProfileRoutes } from "./ctvMe/profile.route.js";

export { CTV_COMMISSION_UX, summarizeCtvCommissionStatus };

export function registerShopCtvMeRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getDb: GetDb
) {
  const ctx = buildCtvMeCtx(getShopDb, getDb);
  registerCtvMeStatsRoute(app, ctx);
  registerCtvMeOverviewRoute(app, ctx);
  registerCtvMeCommissionsRoute(app, ctx);
  registerCtvMeBillsRoute(app, ctx);
  registerCtvMeConversionsRoute(app, ctx);
  registerCtvMeStreamRoute(app, ctx);
  registerCtvMeProfileRoutes(app, ctx);
}
