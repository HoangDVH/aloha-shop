import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { getCtvSettings, saveCtvSettings } from "../commissionModels.js";

export function registerSettings(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/settings", ...gate, async (_req, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const settings = await getCtvSettings(shopDb);
      return res.json({ ok: true, settings });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "settings_failed" });
    }
  });

  app.patch("/api/shop/admin/ctv/settings", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const settings = await saveCtvSettings(shopDb, req.body || {});
      return res.json({ ok: true, settings });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "settings_save_failed" });
    }
  });
}
