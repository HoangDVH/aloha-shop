/**
 * Seller Center — SSE ops admin + badge counts + persistent notifications.
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
import { APPLICATIONS_COL } from "../shopRecruitment/types.js";
import {
  ADMIN_NOTIFICATIONS,
  ADMIN_NOTIFICATION_READS,
  getAdminOpsCounts,
  listAdminNotificationsFeed,
  markAllNotificationsRead,
  markNotificationRead,
} from "../shopNotifications/adminNotificationStore.js";
import type { GetShopDb } from "./routes.js";

const OPS_COLS = new Set([
  "shop_orders",
  SHOP_ORDERS,
  "aloha_shop_accounts",
  SHOP_ACCOUNTS,
  "aloha_shop_ctv_fraud_events",
  "aloha_shop_ctv_fraud",
  SHOP_CTV_FRAUD_EVENTS,
  "shop_payment_alerts",
  "aloha_shop_payment_alerts",
  "aloha_shop_commissions",
  "recruitment_applications",
  APPLICATIONS_COL,
  ADMIN_NOTIFICATIONS,
  ADMIN_NOTIFICATION_READS,
]);

function resolveAdminKey(req: AuthRequest): string {
  return String(req.auth?.userId || req.auth?.sub || req.auth?.username || "admin");
}

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
        const counts = await getAdminOpsCounts(shopDb);
        return res.json({
          ok: true,
          ...counts,
          at: Date.now(),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "counts_failed" });
      }
    }
  );

  app.get(
    "/api/shop/admin/ops/notifications",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const feed = await listAdminNotificationsFeed(shopDb, resolveAdminKey(req));
        return res.json(feed);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "notifications_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/ops/notifications/read",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = String(req.body?.id || "").trim();
        if (!id) {
          return res.status(400).json({ error: "missing_notification_id" });
        }
        const shopDb = await getShopDb();
        const state = await markNotificationRead(shopDb, resolveAdminKey(req), id);
        syncBus.publish([ADMIN_NOTIFICATION_READS], "notif_read_state", { ids: [id] });
        return res.json({
          ok: true,
          readAllAt: state.readAllAt ? state.readAllAt.toISOString() : null,
          readIds: state.readIds,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "notification_read_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/ops/notifications/read-all",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const state = await markAllNotificationsRead(shopDb, resolveAdminKey(req));
        syncBus.publish([ADMIN_NOTIFICATION_READS], "notif_read_state", { ids: [] });
        return res.json({
          ok: true,
          readAllAt: state.readAllAt ? state.readAllAt.toISOString() : null,
          readIds: state.readIds,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "notification_read_all_failed" });
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
        const hit = cols.some(
          (c) =>
            OPS_COLS.has(c) ||
            c.includes("fraud") ||
            c.includes("order") ||
            c.includes("account") ||
            c.includes("commission") ||
            c.includes("payment") ||
            c.includes("recruitment") ||
            c.includes("notification")
        );
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
