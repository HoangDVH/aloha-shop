import type { Express } from "express";
import type { GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import { registerRecruitmentPublicRoutes } from "./public.routes.js";
import { registerRecruitmentJobsAdminRoutes } from "./jobs.admin.routes.js";
import { registerRecruitmentApplicationsAdminRoutes } from "./applications.admin.routes.js";

export { startRecruitmentWorker } from "./worker.js";

export function registerShopRecruitmentRoutes(app: Express, getOpsDb: GetDb, getShopDb: GetShopDb) {
  registerRecruitmentPublicRoutes(app, getShopDb);
  registerRecruitmentJobsAdminRoutes(app, getOpsDb, getShopDb);
  registerRecruitmentApplicationsAdminRoutes(app, getOpsDb, getShopDb);
}
