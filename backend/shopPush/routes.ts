/**
 * API Routes quản lý Web Push cho Admin ALOHA Shop
 */
import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  getPushSubscriptionCount,
  broadcastAdminWebPush,
  type PushSubscriptionPayload,
} from "./webPushService.js";

export function registerShopPushRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

  /**
   * Lấy VAPID public key cho trình duyệt đăng ký PushManager
   */
  app.get(
    "/api/shop/admin/push/vapid-public-key",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const publicKey = await getVapidPublicKey(shopDb);
        return res.json({ ok: true, publicKey });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "vapid_key_failed" });
      }
    }
  );

  /**
   * Đăng ký thiết bị nhận thông báo đẩy
   */
  app.post(
    "/api/shop/admin/push/subscribe",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const sub = req.body?.subscription as PushSubscriptionPayload;
        if (!sub?.endpoint || !sub?.keys) {
          return res.status(400).json({ error: "missing_subscription_payload" });
        }

        const user = req.auth;
        await savePushSubscription(shopDb, sub, {
          userId: user?.userId || user?.sub,
          username: user?.username,
          role: user?.role,
          userAgent: req.headers["user-agent"],
        });

        return res.json({ ok: true, message: "subscribed_successfully" });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "subscribe_failed" });
      }
    }
  );

  /**
   * Hủy đăng ký nhận thông báo đẩy cho thiết bị
   */
  app.post(
    "/api/shop/admin/push/unsubscribe",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const endpoint = String(req.body?.endpoint || "").trim();
        if (!endpoint) {
          return res.status(400).json({ error: "missing_endpoint" });
        }

        const removed = await removePushSubscription(shopDb, endpoint);
        return res.json({ ok: true, removed });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "unsubscribe_failed" });
      }
    }
  );

  /**
   * Kiểm tra trạng thái hệ thống Web Push (số lượng thiết bị đã đăng ký)
   */
  app.get(
    "/api/shop/admin/push/status",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const count = await getPushSubscriptionCount(shopDb);
        return res.json({ ok: true, subscriptionsCount: count });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "status_failed" });
      }
    }
  );

  /**
   * Bắn thông báo thử nghiệm tới toàn bộ thiết bị đang đăng ký
   */
  app.post(
    "/api/shop/admin/push/test",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const result = await broadcastAdminWebPush(shopDb, {
          title: "🔔 ALOHA Shop - Kiểm tra Web Push!",
          body: "Thông báo đẩy đang hoạt động hoàn hảo trên thiết bị của bạn!",
          url: "/admin/don-hang-web",
          tag: "test-alert",
        });

        return res.json({
          ok: true,
          ...result,
          message:
            result.sent > 0
              ? `Đã gửi thành công tới ${result.sent} thiết bị.`
              : "Chưa có thiết bị nào đăng ký nhận Web Push.",
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "test_push_failed" });
      }
    }
  );
}
