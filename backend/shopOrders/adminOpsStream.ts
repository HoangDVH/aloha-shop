/**
 * Seller Center — SSE ops admin + badge counts.
 */
import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { syncBus, type SyncChangePayload } from "../syncBus.js";
import { SHOP_ORDERS } from "./models.js";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { SHOP_CTV_FRAUD_EVENTS } from "./commissionModels.js";
import type { GetShopDb } from "./routes.js";

const OPS_COLS = new Set([
  "shop_orders",
  "aloha_shop_accounts",
  "aloha_shop_ctv_fraud_events",
  "aloha_shop_ctv_fraud",
  "shop_payment_alerts",
  "aloha_shop_payment_alerts",
  "aloha_shop_commissions",
]);

export function registerShopAdminOpsRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

  app.get(
    "/api/shop/admin/ops/counts",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const [ordersNeedAction, ctvPending, fraudOpen] = await Promise.all([
          shopDb.collection(SHOP_ORDERS).countDocuments({
            $or: [
              { paymentStatus: { $in: ["unpaid", "processing", "reported"] } },
              {
                orderStatus: {
                  $in: ["cho_xu_ly", "cho_thanh_toan", "cho"],
                },
              },
            ],
            orderStatus: { $nin: ["huy"] },
          }),
          shopDb.collection(SHOP_ACCOUNTS).countDocuments({
            ctvStatus: "cho_duyet",
            roles: "ctv",
          }),
          shopDb.collection(SHOP_CTV_FRAUD_EVENTS).countDocuments({
            $or: [{ reviewStatus: "open" }, { reviewStatus: { $exists: false } }],
          }),
        ]);
        return res.json({
          ok: true,
          ordersNeedAction,
          ctvPending,
          fraudOpen,
          at: Date.now(),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "counts_failed" });
      }
    }
  );

  app.get(
    "/api/shop/admin/ops/stream",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof (res as any).flushHeaders === "function") {
        (res as any).flushHeaders();
      }

      const writeEvent = (event: string, data: unknown) => {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* closed */
        }
      };
      writeEvent("hello", { at: Date.now() });

      const onChange = (payload: SyncChangePayload) => {
        const cols = payload?.collections || [];
        const hit = cols.some((c) => OPS_COLS.has(c) || c.includes("fraud") || c.includes("order") || c.includes("account") || c.includes("commission") || c.includes("payment"));
        if (!hit) return;
        writeEvent("ops", {
          collections: cols,
          ids: payload.ids || [],
          source: payload.source || "",
          at: payload.at || Date.now(),
        });
      };
      syncBus.on("change", onChange);

      const ping = setInterval(() => {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* */
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(ping);
        syncBus.off("change", onChange);
      };
      req.on("close", cleanup);
      req.on("aborted", cleanup);
    }
  );
}
