import type { Express } from "express";
import type { Db } from "mongodb";
import type { GetShopDb } from "../shopAuth/routes.js";
import { ensureShopOrderIndexes } from "./models.js";
import { type GetMainDb, setShopCors } from "./orderRouteShared.js";
import { registerShopOrderCreateRoutes } from "./orderCreateRoutes.js";
import { registerShopOrderMeRoutes } from "./orderMeRoutes.js";
import { registerShopOrderCustomerActionRoutes } from "./orderCustomerActionRoutes.js";

export type { GetMainDb } from "./orderRouteShared.js";
export type { GetShopDb } from "../shopAuth/routes.js";

export function registerShopOrderRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  let indexesReady = false;
  const ensureIdx = async (db: Db) => {
    if (indexesReady) return;
    await ensureShopOrderIndexes(db);
    indexesReady = true;
  };

  app.options("/api/shop/orders", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/orders/me", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/orders/me/:id", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/orders/stream", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/orders/me/:id/cancel", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/payments/bank", (req, res) => {
    setShopCors(req, res);
    res.sendStatus(204);
  });
  registerShopOrderCreateRoutes(app, getShopDb, getMainDb, ensureIdx);
  registerShopOrderMeRoutes(app, getShopDb, getMainDb, ensureIdx);
  registerShopOrderCustomerActionRoutes(app, getShopDb, getMainDb, ensureIdx);
}
