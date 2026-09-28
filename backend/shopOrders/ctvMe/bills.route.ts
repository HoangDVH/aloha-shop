/**
 * Route: GET /api/shop/ctv/me/bills
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import { SHOP_COMMISSION_BILLS } from "../commissionModels.js";
import type { CtvMeCtx } from "./shared.js";

export function registerCtvMeBillsRoute(app: Express, ctx: CtvMeCtx) {
  app.get("/api/shop/ctv/me/bills", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const rows = await activeCtv.shopDb
        .collection(SHOP_COMMISSION_BILLS)
        .find({ status: { $in: ["locked", "paid"] } })
        .sort({ period: -1 })
        .limit(24)
        .toArray();
      const mine = rows
        .map((b) => {
          const lines = Array.isArray((b as any).ctvLines) ? (b as any).ctvLines : [];
          const line = lines.find((l: any) => String(l.ctvCode) === activeCtv.ctvCode);
          if (!line) return null;
          return {
            period: (b as any).period,
            billStatus: (b as any).status,
            net: Number(line.net) || 0,
            gross: Number(line.gross ?? line.amount) || Number(line.net) || 0,
            orderCount: Number(line.orderCount) || 0,
            paidAt: line.paidAt || (b as any).paidAt || null,
            lockedAt: (b as any).lockedAt || null,
          };
        })
        .filter(Boolean);
      return res.json({ ok: true, data: mine });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "bills_failed" });
    }
  });
}
