import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import type { GetShopDb } from "./routes.js";
import { registerKvPaymentAdminRoutes } from "./kvPaymentAdmin.js";
import {
  handleGetAdminOrders,
  handleGetAdminOrderById,
} from "./controllers/adminOrderQueryController.js";
import {
  handleConfirmPayment,
  handleConfirmShipment,
  handleMarkShipping,
  handleMarkDelivered,
  handleMarkReturned,
} from "./controllers/adminOrderLifecycleController.js";
import {
  handleSyncKv,
  handleRetryKvPush,
  handleVoidTest,
  handlePurgeTest,
  handleMigrateWebCodes,
} from "./controllers/adminOrderOpsController.js";
import { registerQuickOrderRoutes } from "./quickOrder/quickOrderRoutes.js";

export function registerShopOrdersAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  registerKvPaymentAdminRoutes(app, getDb, getShopDb);
  const gate = [requireAuth(getDb), requireActive, requireManager];
  registerQuickOrderRoutes(app, getDb, getShopDb, gate);
  const idxState = { ready: false };

  // 1. Order queries
  app.get("/api/shop/admin/orders", ...gate, (req: AuthRequest, res: Response) =>
    handleGetAdminOrders(req, res, getDb, getShopDb, idxState)
  );
  app.get("/api/shop/admin/orders/:id", ...gate, (req: AuthRequest, res: Response) =>
    handleGetAdminOrderById(req, res, getDb, getShopDb, idxState)
  );

  // 2. Lifecycle & status updates
  app.post(
    "/api/shop/admin/orders/:id/confirm-payment",
    ...gate,
    (req: AuthRequest, res: Response) =>
      handleConfirmPayment(req, res, getDb, getShopDb, idxState)
  );
  app.post(
    "/api/shop/admin/orders/:id/confirm-shipment",
    ...gate,
    (req: AuthRequest, res: Response) =>
      handleConfirmShipment(req, res, getShopDb, idxState)
  );
  app.post(
    "/api/shop/admin/orders/:id/mark-shipping",
    ...gate,
    (req: AuthRequest, res: Response) =>
      handleMarkShipping(req, res, getShopDb, idxState)
  );
  app.post(
    "/api/shop/admin/orders/:id/mark-delivered",
    ...gate,
    (req: AuthRequest, res: Response) =>
      handleMarkDelivered(req, res, getDb, getShopDb, idxState)
  );
  app.post(
    "/api/shop/admin/orders/:id/mark-returned",
    ...gate,
    (req: AuthRequest, res: Response) =>
      handleMarkReturned(req, res, getShopDb, idxState)
  );

  // 3. Operational & sync endpoints
  app.post("/api/shop/admin/orders/:id/void-test", ...gate, (req: AuthRequest, res: Response) =>
    handleVoidTest(req, res, getDb, getShopDb, idxState)
  );
  app.post("/api/shop/admin/orders/migrate-web-codes", ...gate, (req: AuthRequest, res: Response) =>
    handleMigrateWebCodes(req, res, getShopDb, idxState)
  );
  app.post("/api/shop/admin/orders/:id/sync-kv", ...gate, (req: AuthRequest, res: Response) =>
    handleSyncKv(req, res, getDb, getShopDb, idxState)
  );
  app.post("/api/shop/admin/orders/:id/sync-kv-money", ...gate, (req: AuthRequest, res: Response) =>
    handleSyncKv(req, res, getDb, getShopDb, idxState)
  );
  app.post("/api/shop/admin/orders/:id/retry-kv-push", ...gate, (req: AuthRequest, res: Response) =>
    handleRetryKvPush(req, res, getDb, getShopDb, idxState)
  );
  app.post("/api/shop/admin/orders/purge-test", ...gate, (req: AuthRequest, res: Response) =>
    handlePurgeTest(req, res, getDb, getShopDb, idxState)
  );
}
