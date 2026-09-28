/**
 * Route: GET /api/shop/ctv/me/conversions
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import type { CtvMeCtx } from "./shared.js";
import { getCtvConversions } from "./conversions.service.js";

export function registerCtvMeConversionsRoute(app: Express, ctx: CtvMeCtx) {
  /**
   * Báo cáo chuyển đổi — đơn gắn CTV trong kỳ (filter + dòng SP / HH).
   */
  app.get("/api/shop/ctv/me/conversions", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const data = await getCtvConversions(ctx.getDb, activeCtv, {
        from: req.query.from,
        to: req.query.to,
        orderCode: req.query.orderCode,
        q: req.query.q,
        orderStatus: req.query.orderStatus,
        paymentStatus: req.query.paymentStatus,
      });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "conversions_failed" });
    }
  });
}
