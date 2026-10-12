import type { Express } from "express";
import { requireAuth, requireActive, requireManager, type GetDb } from "../auth/middleware.js";
import { isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { excludedPath, isBot, recordVisit, visitInput, visitRange, visitStats } from "./service.js";

export function registerShopVisitRoutes(app: Express, getAuthDb: GetDb, getShopDb: GetDb) {
  app.post("/api/shop/visits", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = String(req.headers.origin || "");
    if (origin && !isAllowedShopOrigin(origin)) return res.status(403).json({ error: "Origin không hợp lệ" });
    const parsed = visitInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu truy cập không hợp lệ" });
    if (excludedPath(parsed.data.path) || isBot(String(req.headers["user-agent"] || ""))) return res.sendStatus(204);
    try {
      if (!await shopRateLimitOrReject(req, res, "shop_visits", 120, 60_000)) return;
      await recordVisit(await getShopDb(), parsed.data);
      return res.sendStatus(204);
    } catch (error) {
      console.warn("[shop-visits] record failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "Tạm thời chưa ghi nhận được truy cập" });
    }
  });

  app.get("/api/shop/admin/visits", requireAuth(getAuthDb), requireActive, requireManager, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const range = visitRange(req.query.from, req.query.to);
    if (!range) return res.status(400).json({ error: "Chọn khoảng ngày hợp lệ, tối đa 366 ngày" });
    try {
      return res.json(await visitStats(await getShopDb(), range));
    } catch {
      return res.status(503).json({ error: "Không tải được thống kê truy cập. Vui lòng thử lại." });
    }
  });
}
