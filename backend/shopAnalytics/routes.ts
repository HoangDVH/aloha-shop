import type { Express } from "express";
import { z } from "zod";
import { requireAuth, requireActive, requireManager, type GetDb } from "../auth/middleware.js";
import { isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { isBot, visitRange } from "../shopVisits/service.js";
import { cacheCommand } from "../cache/transport.js";
import { topSales } from "./sales.js";
import { productViewInput, recordProductView, topViews } from "./productViews.js";

export const topQuery = z.object({ kind: z.enum(["sales", "views"]), metric: z.enum(["revenue", "quantity", "views", "visitors"]),
  from: z.string(), to: z.string() }).refine(q => q.kind === "sales" ? ["revenue", "quantity"].includes(q.metric) : ["views", "visitors"].includes(q.metric));

export function registerShopAnalyticsRoutes(app: Express, authDb: GetDb, shopDb: GetDb) {
  app.post("/api/shop/product-views", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = String(req.headers.origin || "");
    if (origin && !isAllowedShopOrigin(origin)) return res.sendStatus(403);
    if (isBot(String(req.headers["user-agent"] || ""))) return res.sendStatus(204);
    const input = productViewInput.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Dữ liệu lượt xem không hợp lệ" });
    try {
      if (!await shopRateLimitOrReject(req, res, "product_views", 120, 60_000)) return;
      const found = await recordProductView(await shopDb(), input.data);
      return res.sendStatus(found ? 204 : 404);
    } catch { return res.status(503).json({ error: "Chưa ghi nhận được lượt xem" }); }
  });
  app.get("/api/shop/admin/top-products", requireAuth(authDb), requireActive, requireManager, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const query = topQuery.safeParse(req.query);
    const range = query.success ? visitRange(query.data.from, query.data.to) : null;
    if (!query.success || !range) return res.status(400).json({ error: "Bộ lọc thống kê không hợp lệ, tối đa 366 ngày" });
    try {
      const db = await shopDb(), { kind, metric } = query.data;
      const key = `aloha:admin:top-products:v1:${db.databaseName}:${kind}:${metric}:${range.from}:${range.to}`;
      const cached = await cacheCommand(redis => redis.get(key));
      if (cached) {
        try { const parsed = JSON.parse(cached); if (Array.isArray(parsed.items)) return res.json(parsed); } catch { /* cache miss */ }
      }
      const result = kind === "sales" ? await topSales(db, range.start, range.end, metric as "revenue" | "quantity")
        : await topViews(db, range.start, range.end, metric as "views" | "visitors");
      const body = { ...result, kind, metric, from: range.from, to: range.to, updatedAt: new Date().toISOString() };
      await cacheCommand(redis => redis.set(key, JSON.stringify(body), { EX: 60 }));
      return res.json(body);
    } catch { return res.status(503).json({ error: "Không tải được thống kê sản phẩm. Vui lòng thử lại." }); }
  });
}
