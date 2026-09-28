/**
 * API admin CTV hoa hồng + settings + rates + bills + fraud.
 * Tái cấu trúc theo cấu trúc module nhỏ (docs/KE_HOACH_TACH_FILE.md - Mục 5.1).
 */
import type { Express } from "express";
import type { GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "./routes.js";
import { buildCommissionAdminCtx } from "./commissionAdmin/shared.js";
import { registerSettings } from "./commissionAdmin/settings.js";
import { registerProductRates } from "./commissionAdmin/productRates.js";
import { registerOverrides } from "./commissionAdmin/overrides.js";
import { registerCommissions } from "./commissionAdmin/commissions.js";
import { registerStats } from "./commissionAdmin/stats.js";
import { registerBills } from "./commissionAdmin/bills.js";
import { registerFraud } from "./commissionAdmin/fraud.js";
import { registerAffiliateDetail } from "./commissionAdmin/affiliateDetail.js";
import { registerOverview } from "./commissionAdmin/overview.js";
import { registerBillsExport } from "./commissionAdmin/billsExport.js";

export function registerShopCommissionAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const ctx = buildCommissionAdminCtx(getDb, getShopDb);
  registerSettings(app, ctx);
  registerProductRates(app, ctx);
  registerOverrides(app, ctx);
  registerCommissions(app, ctx);
  registerStats(app, ctx);
  registerBills(app, ctx);
  registerFraud(app, ctx);
  registerAffiliateDetail(app, ctx);
  registerOverview(app, ctx);
  registerBillsExport(app, ctx);
}
