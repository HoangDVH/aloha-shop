import type { Express } from "express";
import type { CommissionAdminCtx } from "./shared.js";
import { clearHeldCommissions } from "../commission.js";
import {
  SHOP_COMMISSIONS,
  SHOP_CTV_FRAUD_EVENTS,
  SHOP_COMMISSION_BILLS,
} from "../commissionModels.js";
import { SHOP_ACCOUNTS } from "../../shopAuth/models.js";

export function registerStats(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/stats", ...gate, async (_req, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const acc = shopDb.collection(SHOP_ACCOUNTS);
      const [
        ctvPending,
        fraudNew,
        heldAgg,
        eligibleAgg,
        billedAgg,
        unlockedBill,
      ] = await Promise.all([
        acc.countDocuments({ roles: "ctv", ctvStatus: "cho_duyet" }),
        shopDb.collection(SHOP_CTV_FRAUD_EVENTS).countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 86400_000).toISOString() },
        }),
        col.aggregate([{ $match: { status: "held" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        col.aggregate([{ $match: { status: "eligible" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        col.aggregate([{ $match: { status: "billed" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        shopDb.collection(SHOP_COMMISSION_BILLS).findOne({
          status: { $in: ["draft", "locked"] },
        }),
      ]);
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const periodBill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
      return res.json({
        ok: true,
        ctvPending,
        fraudNew,
        heldAmount: Number(heldAgg[0]?.t) || 0,
        heldCount: Number(heldAgg[0]?.n) || 0,
        eligibleAmount: Number(eligibleAgg[0]?.t) || 0,
        eligibleCount: Number(eligibleAgg[0]?.n) || 0,
        billedAmount: Number(billedAgg[0]?.t) || 0,
        billedCount: Number(billedAgg[0]?.n) || 0,
        currentPeriod: period,
        currentBillStatus: (periodBill as any)?.status || null,
        hasOpenBill: Boolean(unlockedBill),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "stats_failed" });
    }
  });
}
