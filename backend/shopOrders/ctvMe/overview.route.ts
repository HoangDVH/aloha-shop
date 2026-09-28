/**
 * Route: GET /api/shop/ctv/me/overview
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import type { CtvMeCtx } from "./shared.js";
import { getCtvOverview } from "./overview.service.js";

export function registerCtvMeOverviewRoute(app: Express, ctx: CtvMeCtx) {
  /** Tổng quan kiểu sàn — metrics + danh sách SP (ảnh/tên/giá web) theo kỳ. */
  app.get("/api/shop/ctv/me/overview", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const data = await getCtvOverview(ctx.getDb, activeCtv, {
        from: req.query.from,
        to: req.query.to,
      });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overview_failed" });
    }
  });
}
