import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";
import { SHOP_COMMISSIONS } from "../commissionModels.js";
import { clearHeldCommissions } from "../commission.js";

export function registerOverview(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  /** Tổng quan dashboard — aggregate thật, không số demo */
  app.get("/api/shop/admin/ctv/overview", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);

      const period = String(req.query.period || "").trim();
      const fromQ = String(req.query.from || "").trim();
      const toQ = String(req.query.to || "").trim();
      const now = new Date();
      const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
      let from: Date;
      let to: Date;
      let periodKey: string;
      if (ymdRe.test(fromQ) && ymdRe.test(toQ)) {
        const [fy, fm, fd] = fromQ.split("-").map(Number);
        const [ty, tm, td] = toQ.split("-").map(Number);
        from = new Date(fy, fm - 1, fd);
        to = new Date(ty, tm - 1, td + 1); // exclusive
        periodKey = `${ty}-${String(tm).padStart(2, "0")}`;
      } else {
        const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (m) {
          periodKey = period;
          const y = Number(m[1]);
          const mo = Number(m[2]);
          const cycle = m[3] as "K1" | "K2" | undefined;
          if (cycle === "K1") {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo - 1, 16);
          } else if (cycle === "K2") {
            from = new Date(y, mo - 1, 16);
            to = new Date(y, mo, 1);
          } else {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo, 1);
          }
        } else {
          periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const [y, mNum] = periodKey.split("-").map(Number);
          from = new Date(y, mNum - 1, 1);
          to = new Date(y, mNum, 1);
        }
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = from;
      const prevFrom = new Date(prevTo.getTime() - rangeMs);
      const prevFromIso = prevFrom.toISOString();
      const prevToIso = prevTo.toISOString();

      // Xác định prevPeriodKey chuẩn theo kỳ đợt K1/K2 hoặc cả tháng
      let prevPeriodKey: string;
      const mCycle = /^(\d{4})-(\d{2})-(K[12])$/.exec(periodKey);
      if (mCycle) {
        const y = Number(mCycle[1]);
        const mo = Number(mCycle[2]);
        const cyc = mCycle[3];
        if (cyc === "K2") {
          // Kỳ liền trước của K2 cùng tháng là K1
          prevPeriodKey = `${y}-${String(mo).padStart(2, "0")}-K1`;
        } else {
          // Kỳ liền trước của K1 là K2 của tháng trước
          const prevMoDate = new Date(y, mo - 2, 1);
          const py = prevMoDate.getFullYear();
          const pmo = prevMoDate.getMonth() + 1;
          prevPeriodKey = `${py}-${String(pmo).padStart(2, "0")}-K2`;
        }
      } else {
        prevPeriodKey = `${prevFrom.getFullYear()}-${String(prevFrom.getMonth() + 1).padStart(2, "0")}`;
      }

      const acc = shopDb.collection(SHOP_ACCOUNTS);
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const clicks = shopDb.collection("aloha_shop_ctv_clicks");

      // Range tùy ý: chỉ theo ngày. Kỳ tháng: thêm khớp billingPeriod.
      const useStrictRange = ymdRe.test(fromQ) && ymdRe.test(toQ);
      const periodMatch = (fromIsoX: string, toIsoX: string, periodX: string) => ({
        status: { $nin: ["cancelled"] },
        $or: [
          ...(useStrictRange ? [] : [{ billingPeriod: periodX }]),
          { deliveredAt: { $gte: fromIsoX, $lt: toIsoX } },
          { createdAtIso: { $gte: fromIsoX, $lt: toIsoX } },
          { createdAt: { $gte: fromIsoX, $lt: toIsoX } },
        ],
      });

      const [
        ctvTotal,
        ctvActive,
        clicksInPeriod,
        clicksPrev,
        gmvAgg,
        gmvPrevAgg,
        payableAgg,
        commissionByStatus,
        topAgg,
        dailyAgg,
      ] = await Promise.all([
        acc.countDocuments({ roles: "ctv" }),
        acc.countDocuments({ roles: "ctv", ctvStatus: "active" }),
        clicks.countDocuments({
          $or: [
            { createdAt: { $gte: from, $lt: to } },
            { createdAtIso: { $gte: fromIso, $lt: toIso } },
          ],
        }),
        clicks.countDocuments({
          $or: [
            { createdAt: { $gte: prevFrom, $lt: prevTo } },
            { createdAtIso: { $gte: prevFromIso, $lt: prevToIso } },
          ],
        }),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $group: {
                _id: null,
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(prevFromIso, prevToIso, prevPeriodKey) },
            {
              $group: {
                _id: null,
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: { status: { $in: ["held", "eligible", "billed"] } } },
            { $group: { _id: null, t: { $sum: "$amount" } } },
          ])
          .toArray(),
        col
          .aggregate([
            {
              $group: {
                _id: "$status",
                amount: { $sum: "$amount" },
                n: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $group: {
                _id: "$ctvCode",
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
            { $sort: { gmv: -1 } },
            { $limit: 10 },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $addFields: {
                dayKey: {
                  $substr: [
                    {
                      $ifNull: [
                        "$deliveredAt",
                        { $ifNull: ["$createdAtIso", ""] },
                      ],
                    },
                    0,
                    10,
                  ],
                },
              },
            },
            { $match: { dayKey: { $regex: /^\d{4}-\d{2}-\d{2}$/ } } },
            {
              $group: {
                _id: "$dayKey",
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray(),
      ]);

      const pctChange = (cur: number, prev: number) => {
        if (!prev && !cur) return null;
        if (!prev) return cur > 0 ? 100 : null;
        return Math.round(((cur - prev) / prev) * 1000) / 10;
      };

      const gmvInPeriod = Number(gmvAgg[0]?.gmv) || 0;
      const commissionInPeriod = Number(gmvAgg[0]?.commission) || 0;
      const ordersInPeriod = Array.isArray(gmvAgg[0]?.orders)
        ? gmvAgg[0].orders.length
        : 0;
      const gmvPrev = Number(gmvPrevAgg[0]?.gmv) || 0;
      const ordersPrev = Array.isArray(gmvPrevAgg[0]?.orders)
        ? gmvPrevAgg[0].orders.length
        : 0;
      const commissionPrev = Number(gmvPrevAgg[0]?.commission) || 0;

      const statusMap: Record<string, { amount: number; n: number }> = {};
      for (const r of commissionByStatus) {
        statusMap[String(r._id || "")] = {
          amount: Number(r.amount) || 0,
          n: Number(r.n) || 0,
        };
      }

      const topCodes = topAgg
        .map((r: any) => normalizeCtvCode(String(r._id || "")))
        .filter(Boolean);
      const topAccounts = topCodes.length
        ? await acc
            .find({ ctvCode: { $in: topCodes } })
            .project({ ctvCode: 1, fullName: 1, avatarUrl: 1, ctvStatus: 1 })
            .toArray()
        : [];
      const topAccByCode = new Map(
        topAccounts.map((a: any) => [
          normalizeCtvCode(String(a.ctvCode || "")),
          a,
        ])
      );

      return res.json({
        ok: true,
        period: periodKey,
        prevPeriod: prevPeriodKey,
        ctvTotal,
        ctvActive,
        clicksInPeriod,
        ordersInPeriod,
        gmvInPeriod,
        commissionInPeriod,
        payableAmount: Number(payableAgg[0]?.t) || 0,
        changes: {
          clicks: pctChange(clicksInPeriod, clicksPrev),
          orders: pctChange(ordersInPeriod, ordersPrev),
          gmv: pctChange(gmvInPeriod, gmvPrev),
          commission: pctChange(commissionInPeriod, commissionPrev),
        },
        commissionByStatus: statusMap,
        daily: dailyAgg.map((r: any) => ({
          day: String(r._id || ""),
          gmv: Number(r.gmv) || 0,
          commission: Number(r.commission) || 0,
        })),
        topCtv: topAgg.map((r: any) => {
          const code = normalizeCtvCode(String(r._id || ""));
          const a = topAccByCode.get(code) as any;
          return {
            ctvCode: code,
            fullName: String(a?.fullName || "").trim() || code,
            avatarUrl: String(a?.avatarUrl || "").trim() || null,
            ctvStatus: a?.ctvStatus ? String(a.ctvStatus) : null,
            gmv: Number(r.gmv) || 0,
            commission: Number(r.commission) || 0,
            orderCount: Array.isArray(r.orders) ? r.orders.length : 0,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overview_failed" });
    }
  });
}
