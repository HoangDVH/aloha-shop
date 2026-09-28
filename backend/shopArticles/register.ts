import type { Express } from "express";
import type { GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import { registerArticlesPublicRoutes } from "./articles/public.routes.js";
import { registerArticlesAdminRoutes } from "./articles/admin.routes.js";

export function registerShopArticlesRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  registerArticlesPublicRoutes(app, getDb, getShopDb);
  registerArticlesAdminRoutes(app, getDb, getShopDb);
}
