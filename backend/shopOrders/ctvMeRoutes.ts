/**
 * Portal CTV — stats / commissions / bills (JWT shop).
 */
import type { Express, Response } from "express";
import {
  requireShopAuth,
  type ShopAuthRequest,
  type GetShopDb,
} from "../shopAuth/routes.js";
import {
  SHOP_ACCOUNTS,
  normalizeCtvCode,
  shopAccountIdQuery,
} from "../shopAuth/models.js";
import type { GetDb } from "../auth/middleware.js";
import {
  SHOP_COMMISSIONS,
  SHOP_COMMISSION_BILLS,
  ensureCommissionIndexes,
  getCtvSettings,
} from "./commissionModels.js";
import { clearHeldCommissions, resolveRate } from "./commission.js";

export function registerShopCtvMeRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getDb: GetDb
) {
  const auth = requireShopAuth(getShopDb);

  async function requireActiveCtv(req: ShopAuthRequest, res: Response) {
    const user = req.shopAuth;
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }
    const shopDb = await getShopDb();
    const doc = await shopDb
      .collection(SHOP_ACCOUNTS)
      .findOne(shopAccountIdQuery(user.userId));
    if (!doc || !(doc as any).roles?.includes?.("ctv")) {
      res.status(403).json({ error: "not_ctv" });
      return null;
    }
    if ((doc as any).ctvStatus !== "active") {
      res.status(403).json({ error: "ctv_not_active", status: (doc as any).ctvStatus });
      return null;
    }
    const ctvCode = normalizeCtvCode(String((doc as any).ctvCode || ""));
    if (!ctvCode) {
      res.status(403).json({ error: "missing_ctv_code" });
      return null;
    }
    return { shopDb, doc, ctvCode };
  }

  app.get("/api/shop/ctv/me/stats", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      await ensureCommissionIndexes(ctx.shopDb);
      await clearHeldCommissions(ctx.shopDb);
      const col = ctx.shopDb.collection(SHOP_COMMISSIONS);
      const [held, eligible, billed, paid] = await Promise.all([
        col
          .aggregate([
            { $match: { ctvCode: ctx.ctvCode, status: "held" } },
            { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: { ctvCode: ctx.ctvCode, status: "eligible" } },
            { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: { ctvCode: ctx.ctvCode, status: "billed" } },
            { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: { ctvCode: ctx.ctvCode, status: "paid_out" } },
            { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
          ])
          .toArray(),
      ]);
      return res.json({
        ok: true,
        ctvCode: ctx.ctvCode,
        held: { amount: Number(held[0]?.t) || 0, count: Number(held[0]?.n) || 0 },
        eligible: {
          amount: Number(eligible[0]?.t) || 0,
          count: Number(eligible[0]?.n) || 0,
        },
        billed: { amount: Number(billed[0]?.t) || 0, count: Number(billed[0]?.n) || 0 },
        paidOut: { amount: Number(paid[0]?.t) || 0, count: Number(paid[0]?.n) || 0 },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "stats_failed" });
    }
  });

  app.get("/api/shop/ctv/me/commissions", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      await clearHeldCommissions(ctx.shopDb);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
      const rows = await ctx.shopDb
        .collection(SHOP_COMMISSIONS)
        .find({ ctvCode: ctx.ctvCode })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      // Bổ sung ảnh + giá web từ catalog nếu dòng cũ thiếu
      const needMas = [
        ...new Set(
          rows
            .map((r) => String((r as any).ma || "").trim().toUpperCase())
            .filter(Boolean)
        ),
      ];
      const byMa = new Map<
        string,
        { anh: string; giaWeb: number; ten: string }
      >();
      if (needMas.length) {
        const mainDb = await getDb();
        const products = await mainDb
          .collection("aloha_products")
          .find({
            deletedAt: null,
            $or: [
              { ma: { $in: needMas } },
              { ma: { $in: needMas.map((m) => m.toLowerCase()) } },
            ],
          })
          .project({ ma: 1, ten: 1, anh: 1, images: 1, giaWeb: 1, giaBan: 1, giaChung: 1 })
          .toArray();
        for (const p of products) {
          const ma = String((p as any).ma || "").trim().toUpperCase();
          if (!ma) continue;
          const anh =
            String((p as any).anh || "").trim() ||
            String((Array.isArray((p as any).images) && (p as any).images[0]) || "").trim();
          const giaWeb =
            Number((p as any).giaWeb) ||
            Number((p as any).giaBan) ||
            Number((p as any).giaChung) ||
            0;
          byMa.set(ma, {
            anh,
            giaWeb,
            ten: String((p as any).ten || "").trim(),
          });
        }
      }

      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const ma = String(rest.ma || "").trim().toUpperCase();
          const cat = byMa.get(ma);
          const qty = Math.max(1, Math.floor(Number(rest.qty) || 1));
          const unitPrice =
            Number(rest.unitPrice) ||
            (Number(rest.lineTotal) > 0 ? Math.round(Number(rest.lineTotal) / qty) : 0) ||
            (cat?.giaWeb ?? 0);
          const imageUrl =
            String(rest.imageUrl || "").trim() || cat?.anh || "";
          const productName =
            String(rest.productName || "").trim() || cat?.ten || ma;
          return {
            id: String(_id),
            ...rest,
            ma,
            productName,
            imageUrl: imageUrl || undefined,
            unitPrice,
            giaWeb: unitPrice,
            amount: Number(rest.amount) || 0,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "list_failed" });
    }
  });

  app.get("/api/shop/ctv/me/bills", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      const rows = await ctx.shopDb
        .collection(SHOP_COMMISSION_BILLS)
        .find({ status: { $in: ["locked", "paid"] } })
        .sort({ period: -1 })
        .limit(24)
        .toArray();
      const mine = rows
        .map((b) => {
          const lines = Array.isArray((b as any).ctvLines) ? (b as any).ctvLines : [];
          const line = lines.find((l: any) => String(l.ctvCode) === ctx.ctvCode);
          if (!line) return null;
          return {
            period: (b as any).period,
            billStatus: (b as any).status,
            net: Number(line.net) || 0,
            orderCount: Number(line.orderCount) || 0,
            paidAt: line.paidAt || (b as any).paidAt || null,
          };
        })
        .filter(Boolean);
      return res.json({ ok: true, data: mine });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "bills_failed" });
    }
  });

  /** % hoa hồng áp dụng cho SP (CTV đang login). */
  app.get("/api/shop/ctv/me/rate", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      const ma = String(req.query.ma || "").trim().toUpperCase();
      if (!ma) return res.status(400).json({ error: "missing_ma" });
      const mainDb = await getDb();
      const resolved = await resolveRate(ctx.shopDb, mainDb, ctx.ctvCode, ma);
      const settings = await getCtvSettings(ctx.shopDb);
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
}
