import type { Express } from "express";
import { z } from "zod";
import { requireAuth, requireActive, requireManager, type GetDb } from "../auth/middleware.js";
import { isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { excludedPath, isBot, visitRange } from "../shopVisits/service.js";
import { businessStats, comparisonWindow } from "./business.js";
import { funnelInput, funnelStats, recordFunnelEvent } from "./funnel.js";

export function registerOverviewRoutes(app: Express, authDb: GetDb, shopDb: GetDb) {
  app.post("/api/shop/funnel", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = String(req.headers.origin || "");
    if (origin && !isAllowedShopOrigin(origin)) return res.sendStatus(403);
    const input = funnelInput.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Sự kiện mua hàng không hợp lệ" });
    if (excludedPath(input.data.path) || isBot(String(req.headers["user-agent"] || ""))) return res.sendStatus(204);
    try {
      if (!await shopRateLimitOrReject(req, res, "shop_funnel", 120, 60_000)) return;
      await recordFunnelEvent(await shopDb(), input.data);
      return res.sendStatus(204);
    } catch { return res.status(503).json({ error: "Chưa ghi nhận được sự kiện" }); }
  });
  app.get("/api/shop/admin/business-overview", requireAuth(authDb), requireActive, requireManager, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const range = visitRange(req.query.from, req.query.to);
    const group = z.enum(["day", "hour"]).safeParse(req.query.group || "day");
    if (!range || !group.success) return res.status(400).json({ error: "Chọn khoảng ngày hợp lệ, tối đa 366 ngày" });
    try {
      const db = await shopDb(), now = new Date(), window = comparisonWindow(range, now);
      const [sales, funnel, previousFunnel] = await Promise.all([
        businessStats(db, range, group.data, now), funnelStats(db, { ...range, end: window.end }),
        funnelStats(db, { ...range, start: window.previousStart, end: window.previousEnd }),
      ]);
      return res.json({ sales, funnel: { ...funnel, previous: previousFunnel }, from: range.from, to: range.to });
    } catch { return res.status(503).json({ error: "Không tải được kết quả bán hàng. Vui lòng thử lại." }); }
  });
}
