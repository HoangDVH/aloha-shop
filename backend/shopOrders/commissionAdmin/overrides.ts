import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import {
  SHOP_CTV_PRODUCT_RATES,
  getCtvSettings,
} from "../commissionModels.js";
import { isValidCtvCode, normalizeCtvCode } from "../../shopAuth/models.js";
import { resolveRate } from "../commission.js";

export function registerOverrides(app: Express, ctx: CommissionAdminCtx) {
  const { getDb, getShopDb, gate, ensure } = ctx;

  /** Override CTV–SP */
  app.get("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const ctvCode = normalizeCtvCode(String(req.query.ctvCode || ""));
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });
      const rows = await shopDb
        .collection(SHOP_CTV_PRODUCT_RATES)
        .find({ ctvCode })
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray();
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          return rest;
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overrides_failed" });
    }
  });

  app.put("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const mainDb = await getDb();
      await ensure(shopDb);
      const ctvCode = normalizeCtvCode(String(req.body?.ctvCode || ""));
      const ma = String(req.body?.ma || "").trim().toUpperCase();
      const rate = Math.max(0, Number(req.body?.rate) || 0);
      if (!isValidCtvCode(ctvCode) || !ma) {
        return res.status(400).json({ error: "invalid_ctv_or_ma" });
      }
      const base = await resolveRate(shopDb, mainDb, ctvCode, ma);
      // Target ≥ open (bỏ qua nếu base từ ctv_sp cũ)
      const openRate =
        base.source === "ctv_sp"
          ? (await getCtvSettings(shopDb)).defaultCommissionRate
          : base.rate;
      if (rate + 1e-9 < openRate) {
        return res.status(400).json({
          error: `rate_below_open`,
          message: `% CTV đặc biệt phải ≥ % đang mở (${openRate}%)`,
          openRate,
        });
      }
      const now = new Date().toISOString();
      await shopDb.collection(SHOP_CTV_PRODUCT_RATES).updateOne(
        { ctvCode, ma },
        { $set: { ctvCode, ma, rate, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      return res.json({ ok: true, ctvCode, ma, rate });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "override_save_failed" });
    }
  });

  app.delete("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const ctvCode = normalizeCtvCode(String(req.body?.ctvCode || req.query.ctvCode || ""));
      const ma = String(req.body?.ma || req.query.ma || "")
        .trim()
        .toUpperCase();
      if (!ctvCode || !ma) return res.status(400).json({ error: "missing" });
      await shopDb.collection(SHOP_CTV_PRODUCT_RATES).deleteOne({ ctvCode, ma });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "override_del_failed" });
    }
  });
}
