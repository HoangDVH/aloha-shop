/**
 * Route: GET /api/shop/ctv/me/stats
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import { normalizeCtvCode } from "../../shopAuth/models.js";
import {
  SHOP_COMMISSIONS,
  ensureCommissionIndexes,
  getCtvSettings,
} from "../commissionModels.js";
import { clearHeldCommissions } from "../commission.js";
import type { CtvMeCtx } from "./shared.js";

export function registerCtvMeStatsRoute(app: Express, ctx: CtvMeCtx) {
  app.get("/api/shop/ctv/me/stats", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      await ensureCommissionIndexes(activeCtv.shopDb);
      await clearHeldCommissions(activeCtv.shopDb, { ctvCode: activeCtv.ctvCode });
      const col = activeCtv.shopDb.collection(SHOP_COMMISSIONS);
      const [held, eligible, billed, paid, flagged, cancelled, pendingOrders] =
        await Promise.all([
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "held" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "eligible" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "billed" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "paid_out" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "flagged" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          col
            .aggregate([
              { $match: { ctvCode: activeCtv.ctvCode, status: "cancelled" } },
              { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } },
            ])
            .toArray(),
          activeCtv.shopDb
            .collection("aloha_shop_orders")
            .find({
              ctvCodes: activeCtv.ctvCode,
              orderStatus: { $nin: ["hoan_thanh", "huy"] },
            })
            .project({
              code: 1,
              orderStatus: 1,
              paymentStatus: 1,
              method: 1,
              usingCod: 1,
              total: 1,
              totalPayment: 1,
              createdAt: 1,
              orderDetails: 1,
              customerName: 1,
            })
            .sort({ createdAt: -1 })
            .limit(40)
            .toArray(),
        ]);

      const settings = await getCtvSettings(activeCtv.shopDb);
      const pending = pendingOrders.map((o: any) => {
        const details = Array.isArray(o.orderDetails) ? o.orderDetails : [];
        const myLines = details.filter(
          (d: any) => normalizeCtvCode(String(d.ctvCode || "")) === activeCtv.ctvCode
        );
        const pay = String(o.paymentStatus || "").toLowerCase();
        const st = String(o.orderStatus || "").toLowerCase();
        const isCod = Boolean(o.usingCod) || pay === "cod" || String(o.method) === "Cash";
        let payLabel = "Chờ thanh toán";
        if (pay === "paid" || pay === "da_thanh_toan") payLabel = "Đã thanh toán";
        else if (isCod) payLabel = "COD — thu khi giao";
        else if (pay === "pending" || pay === "cho_ck" || st === "cho_thanh_toan")
          payLabel = "Chờ chuyển khoản";
        let orderLabel = "Đang xử lý";
        if (st === "dang_giao") orderLabel = "Đang giao";
        else if (st === "cho_xu_ly" || st === "cho") orderLabel = "Chờ xử lý";
        else if (st === "cho_thanh_toan") orderLabel = "Chờ thanh toán";
        return {
          code: String(o.code || ""),
          orderStatus: st,
          paymentStatus: pay,
          payLabel,
          orderLabel,
          isCod,
          total: Number(o.total ?? o.totalPayment) || 0,
          createdAt: o.createdAt || null,
          items: myLines.map((d: any) => ({
            ma: String(d.productCode || d.ma || "").toUpperCase(),
            ten: String(d.productName || d.ten || ""),
            qty: Math.max(1, Math.floor(Number(d.quantity ?? d.qty) || 1)),
            price: Math.max(0, Number(d.price ?? d.gia) || 0),
            imageUrl: String(d.imageUrl || "").trim() || undefined,
          })),
        };
      });

      const bucket = (rows: any[]) => ({
        amount: Number(rows[0]?.t) || 0,
        count: Number(rows[0]?.n) || 0,
      });

      return res.json({
        ok: true,
        ctvCode: activeCtv.ctvCode,
        returnHoldDays: settings.returnHoldDays,
        held: bucket(held),
        eligible: bucket(eligible),
        billed: bucket(billed),
        paidOut: bucket(paid),
        flagged: bucket(flagged),
        cancelled: bucket(cancelled),
        pendingOrders: {
          count: pending.length,
          amount: pending.reduce((s, p) => s + (Number(p.total) || 0), 0),
          items: pending,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "stats_failed" });
    }
  });
}
