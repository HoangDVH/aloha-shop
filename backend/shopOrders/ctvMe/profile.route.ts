/**
 * Routes:
 * GET /api/shop/ctv/me/rate
 * GET /api/shop/ctv/me/payout-bank
 * PUT /api/shop/ctv/me/payout-bank
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../../shopAuth/models.js";
import { getCtvSettings } from "../commissionModels.js";
import { resolveRate } from "../commission.js";
import type { CtvMeCtx } from "./shared.js";

export function registerCtvMeProfileRoutes(app: Express, ctx: CtvMeCtx) {
  /** % hoa hồng áp dụng cho SP (CTV đang login). */
  app.get("/api/shop/ctv/me/rate", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const ma = String(req.query.ma || "").trim().toUpperCase();
      if (!ma) return res.status(400).json({ error: "missing_ma" });
      const mainDb = await ctx.getDb();
      const resolved = await resolveRate(activeCtv.shopDb, mainDb, activeCtv.ctvCode, ma);
      const settings = await getCtvSettings(activeCtv.shopDb);
      return res.json({
        ok: true,
        ma,
        rate: resolved.rate,
        source: resolved.source,
        defaultRate: settings.defaultCommissionRate,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "rate_failed" });
    }
  });

  app.get("/api/shop/ctv/me/payout-bank", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const pb = (activeCtv.doc as any).payoutBank || null;
      return res.json({
        ok: true,
        payoutBank: pb
          ? {
              bankBin: String(pb.bankBin || ""),
              bankName: String(pb.bankName || ""),
              accountNumber: String(pb.accountNumber || ""),
              accountName: String(pb.accountName || ""),
              updatedAt: pb.updatedAt ? String(pb.updatedAt) : null,
            }
          : null,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "payout_bank_failed" });
    }
  });

  app.put("/api/shop/ctv/me/payout-bank", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      const bankBin = String(req.body?.bankBin || "").trim();
      const bankName = String(req.body?.bankName || "").trim();
      const accountNumber = String(req.body?.accountNumber || "")
        .trim()
        .replace(/\s+/g, "");
      const accountName = String(req.body?.accountName || "").trim();
      if (!bankBin || !bankName || !accountNumber || !accountName) {
        return res.status(400).json({ error: "missing_fields" });
      }
      if (!/^[0-9]{5,30}$/.test(accountNumber)) {
        return res.status(400).json({ error: "invalid_account_number" });
      }
      const payoutBank = {
        bankBin: bankBin.slice(0, 20),
        bankName: bankName.slice(0, 120),
        accountNumber,
        accountName: accountName.slice(0, 120),
        updatedAt: new Date().toISOString(),
      };
      await activeCtv.shopDb.collection(SHOP_ACCOUNTS).updateOne(
        shopAccountIdQuery(String((activeCtv.doc as any)._id)),
        { $set: { payoutBank, updatedAt: new Date() } }
      );
      return res.json({ ok: true, payoutBank });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "payout_bank_save_failed" });
    }
  });
}
