/**
 * Route: POST /api/shop/ctv/click
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { CTV_CLICKS_COL } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { shopRateLimitOrReject } from "../../shopRateLimit.js";
import {
  normalizeCtvCode,
  isValidCtvCode,
  hashIpFvn1a32,
} from "../catalog/ctv.js";

export function registerCtvClickRoutes(app: Express, ctx: CatalogCtx) {
  /** Ghi nhận click mở link CTV — ghi shop DB (cùng nơi engine HH đọc). */
  app.post("/api/shop/ctv/click", async (req, res) => {
    setCors(req, res);
    try {
      if (!(await shopRateLimitOrReject(req, res, "shop_ctv_click", 30, 60_000))) {
        return;
      }
      const body = (req.body || {}) as { ctv?: unknown; ma?: unknown; path?: unknown };
      const ctv = normalizeCtvCode(body.ctv);
      if (!isValidCtvCode(ctv)) {
        // Mã giả: không lộ danh sách — coi như OK nhưng không ghi
        res.json({ ok: true, ignored: true });
        return;
      }

      const shopDb = ctx.getShopDb ? await ctx.getShopDb() : await ctx.getDb();
      const acc = await shopDb.collection("aloha_shop_accounts").findOne({
        ctvCode: ctv,
        roles: "ctv",
        ctvStatus: "active",
        active: { $ne: false },
      });
      if (!acc) {
        res.json({ ok: true, ignored: true });
        return;
      }

      const ma = body.ma ? String(body.ma).trim() : "";
      const path = body.path ? String(body.path).trim() : "";
      const safePath = path && path.startsWith("/") ? path : "";

      const ua = String(req.headers["user-agent"] || "").slice(0, 200);
      const xff = String(req.headers["x-forwarded-for"] || "");
      const ipRaw = xff || req.ip || "";
      const ipHash = hashIpFvn1a32(ipRaw);

      const col = shopDb.collection(CTV_CLICKS_COL);
      const now = new Date();
      await col.insertOne({
        ctv,
        ma: ma || undefined,
        path: safePath || undefined,
        ua: ua || undefined,
        ipHash: ipHash || undefined,
        createdAt: now,
        createdAtIso: now.toISOString(),
      });

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "ctv_click_failed" });
    }
  });
}
