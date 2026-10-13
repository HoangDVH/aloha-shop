import type { Express } from "express";
import type { Db } from "mongodb";
import { requireAuth, requireActive, requireManager } from "../auth/middleware.js";
import { SHOP_ORDERS } from "./models.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { reconcileShopOrderAgainstKv } from "./kvPaymentReconcile.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { isAllowedShopOrigin } from "../shopCors.js";

export function registerKvPaymentAdminRoutes(app: Express, getMain: () => Promise<Db>, getShop: () => Promise<Db>) {
  app.post("/api/shop/admin/orders/:id/reconcile-payment", requireAuth(getMain), requireActive, requireManager, async (req, res) => {
    if (req.headers.origin && !isAllowedShopOrigin(req.headers.origin)) return res.sendStatus(403);
    if (!await shopRateLimitOrReject(req, res, "admin_kv_payment_retry", 10, 60000)) return;
    try {
      const shopDb = await getShop();
      const order = await shopDb.collection(SHOP_ORDERS).findOne(shopOrderLookupFilter(String(req.params.id)));
      if (!order) return res.status(404).json({ error: "Không tìm thấy đơn" });
      if (order.method !== "Transfer") return res.status(400).json({ error: "Chỉ đối soát tự động đơn chuyển khoản" });
      const result = await reconcileShopOrderAgainstKv({ shopDb, mainDb: await getMain(), order });
      return res.json({ ok: true, result, message: result === "paid" ? "Đã xác minh thanh toán qua KiotViet" : result === "fail" ? "Chưa xác minh được. Đơn vẫn chưa thanh toán và sẽ được đối soát lại." : "Chưa có thay đổi trạng thái thanh toán." });
    } catch { return res.status(503).json({ error: "Chưa đối soát được thanh toán" }); }
  });
}
