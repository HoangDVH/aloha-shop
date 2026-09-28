/**
 * Routes:
 * OPTIONS /api/shop/cache/clear
 * POST /api/shop/cache/clear
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { syncBus } from "../../syncBus.js";
import { redisInvalidateShopCache } from "../../redis.js";

export function registerCacheAdminRoutes(app: Express, _ctx: CatalogCtx) {
  /**
   * Endpoint nội bộ nhận lệnh xóa Cache (Cấp độ 1):
   * Bên project nội bộ gọi khi lưu sản phẩm / sửa giá / đổi tên.
   * Header: x-internal-key: <token> hoặc query ?token=<token>
   */
  app.options("/api/shop/cache/clear", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.post("/api/shop/cache/clear", async (req, res) => {
    setCors(req, res);
    const keyHeader = String(req.headers["x-internal-key"] || "");
    const keyQuery = String(req.query.token || "");
    const keyBody = String(req.body?.token || "");
    const token = keyHeader || keyQuery || keyBody;
    const expected = (process.env.INTERNAL_SYNC_SECRET || "aloha-secret-token-2026").trim();

    if (token !== expected) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body || {};
    const targetMa = body.ma ? String(body.ma).trim() : undefined;
    const collection = String(body.collection || "aloha_products").trim();

    // 1. Phát event syncBus để các luồng realtime (SSE) cập nhật
    syncBus.publish(collection, "internal_http", { ids: targetMa ? [targetMa] : [] });

    // 2. Xóa Cache Cấp độ 1 (xóa list shop:products:* và chi tiết mã nếu có)
    await redisInvalidateShopCache(targetMa);

    res.json({
      ok: true,
      cleared: true,
      level: 1,
      targetMa: targetMa || "all_products",
      at: Date.now(),
    });
  });
}
