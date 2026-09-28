import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_COMMISSIONS } from "../commissionModels.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";
import { clearHeldCommissions } from "../commission.js";

export function registerCommissions(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/commissions", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);
      const status = String(req.query.status || "").trim();
      const ctvCode = normalizeCtvCode(String(req.query.ctvCode || ""));
      const q = String(req.query.q || "").trim();
      const period = String(req.query.period || "").trim();
      const fromYmd = String(req.query.from || "").trim();
      const toYmd = String(req.query.to || "").trim();
      const inBill = req.query.inBill === "1" || req.query.inBill === "true";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const filter: Record<string, unknown> = {};
      if (status) {
        if (status.includes(",")) {
          filter.status = { $in: status.split(",").map((s) => s.trim()).filter(Boolean) };
        } else {
          filter.status = status;
        }
      }
      if (ctvCode) filter.ctvCode = ctvCode;

      const ymdOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (ymdOk(fromYmd) && ymdOk(toYmd)) {
        const [fy, fm, fd] = fromYmd.split("-").map(Number);
        const [ty, tm, td] = toYmd.split("-").map(Number);
        const fromIso = new Date(fy, fm - 1, fd).toISOString();
        const toIso = new Date(ty, tm - 1, td + 1).toISOString(); // exclusive
        filter.$and = [
          ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
          {
            $or: [
              { eligibleAt: { $gte: fromIso, $lt: toIso } },
              {
                $and: [
                  { $or: [{ eligibleAt: null }, { eligibleAt: { $exists: false } }] },
                  { createdAt: { $gte: fromIso, $lt: toIso } },
                ],
              },
            ],
          },
        ];
      } else {
        const periodMatch = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (periodMatch) {
          const y = Number(periodMatch[1]);
          const mo = Number(periodMatch[2]);
          const cycle = periodMatch[3] as "K1" | "K2" | undefined;
          let pStart: string;
          let pEnd: string;
          if (cycle === "K1") {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
          } else if (cycle === "K2") {
            pStart = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
          } else {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
          }
          if (inBill) {
            filter.billingPeriod = period;
          } else {
            // Kỳ: đã vào bill kỳ này HOẶC (chưa vào bill nào và eligibleAt thuộc phạm vi đợt)
            const unbilledEligibleOr = [
              {
                billingPeriod: { $in: [null, ""] },
                eligibleAt: { $gte: pStart, $lt: pEnd },
              },
              ...(cycle === "K2"
                ? [
                    {
                      status: "eligible",
                      billingPeriod: { $in: [null, ""] },
                      eligibleAt: {
                        $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                        $lt: pEnd,
                      },
                    },
                  ]
                : []),
            ];

            filter.$and = [
              ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
              {
                $or: [
                  { billingPeriod: period },
                  ...unbilledEligibleOr,
                ],
              },
            ];
          }
        }
      }

      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = { $regex: escaped, $options: "i" };
        const nameHits = await shopDb
          .collection(SHOP_ACCOUNTS)
          .find({
            roles: "ctv",
            $or: [{ fullName: rx }, { email: rx }, { phone: rx }, { ctvCode: rx }],
          })
          .project({ ctvCode: 1 })
          .limit(80)
          .toArray();
        const nameCodes = [
          ...new Set(
            nameHits
              .map((a) => normalizeCtvCode(String((a as any).ctvCode || "")))
              .filter(Boolean)
          ),
        ];
        const or: Record<string, unknown>[] = [
          { orderCode: rx },
          { ctvCode: rx },
          { ma: rx },
          { productName: rx },
        ];
        if (nameCodes.length) or.push({ ctvCode: { $in: nameCodes } });
        filter.$or = or;
      }
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .sort({ eligibleAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      const orderCodes = [
        ...new Set(
          rows
            .map((r) => String((r as any).orderCode || "").trim())
            .filter(Boolean)
        ),
      ];
      const orderDocs = orderCodes.length
        ? await shopDb
            .collection("aloha_shop_orders")
            .find({
              $or: [
                { code: { $in: orderCodes } },
                { id: { $in: orderCodes } },
                { legacyCodes: { $in: orderCodes } },
              ],
            })
            .project({
              code: 1,
              id: 1,
              kvInvoiceCode: 1,
              kvOrderCode: 1,
              legacyCodes: 1,
              createdAt: 1,
            })
            .toArray()
        : [];
      const displayByShopCode = new Map<string, string>();
      const purchasedByShopCode = new Map<string, string>();
      const toIso = (v: unknown): string => {
        if (v == null || v === "") return "";
        if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString();
        const s = String(v);
        const t = new Date(s).getTime();
        return Number.isFinite(t) ? new Date(t).toISOString() : s;
      };
      for (const o of orderDocs) {
        const shop = String((o as any).code || (o as any).id || "").trim();
        const display =
          String((o as any).kvInvoiceCode || "").trim() ||
          String((o as any).kvOrderCode || "").trim() ||
          shop;
        const purchasedAt =
          toIso((o as any).createdAt) || toIso((o as any).createdAtIso);
        if (shop) {
          displayByShopCode.set(shop, display);
          if (purchasedAt) purchasedByShopCode.set(shop, purchasedAt);
        }
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) {
            displayByShopCode.set(L, display);
            if (purchasedAt) purchasedByShopCode.set(L, purchasedAt);
          }
        }
        const kvInv = String((o as any).kvInvoiceCode || "").trim();
        const kvOrd = String((o as any).kvOrderCode || "").trim();
        if (kvInv && purchasedAt) purchasedByShopCode.set(kvInv, purchasedAt);
        if (kvOrd && purchasedAt) purchasedByShopCode.set(kvOrd, purchasedAt);
        if (kvInv) displayByShopCode.set(kvInv, display || kvInv);
        if (kvOrd) displayByShopCode.set(kvOrd, display || kvOrd);
      }

      const ctvCodesOnPage = [
        ...new Set(
          rows
            .map((r) => normalizeCtvCode(String((r as any).ctvCode || "")))
            .filter(Boolean)
        ),
      ];
      const accDocs = ctvCodesOnPage.length
        ? await shopDb
            .collection(SHOP_ACCOUNTS)
            .find({ ctvCode: { $in: ctvCodesOnPage } })
            .project({ ctvCode: 1, fullName: 1, displayName: 1 })
            .toArray()
        : [];
      const nameByCtv = new Map<string, string>();
      for (const a of accDocs) {
        const code = normalizeCtvCode(String((a as any).ctvCode || ""));
        if (!code) continue;
        const name =
          String((a as any).fullName || "").trim() ||
          String((a as any).displayName || "").trim();
        if (name) nameByCtv.set(code, name);
      }
      const clickDocs = ctvCodesOnPage.length
        ? await shopDb
            .collection("aloha_shop_ctv_clicks")
            .find({ ctv: { $in: ctvCodesOnPage } })
            .sort({ createdAt: -1 })
            .limit(Math.min(3000, Math.max(200, ctvCodesOnPage.length * 80)))
            .project({ ctv: 1, ma: 1, createdAt: 1, createdAtIso: 1 })
            .toArray()
        : [];
      type ClickHit = { ma: string; at: string; t: number };
      const clicksByCtv = new Map<string, ClickHit[]>();
      for (const c of clickDocs) {
        const ctv = normalizeCtvCode(String((c as any).ctv || ""));
        const at =
          toIso((c as any).createdAtIso) || toIso((c as any).createdAt);
        const t = new Date(at).getTime();
        if (!ctv || !at || !Number.isFinite(t)) continue;
        const arr = clicksByCtv.get(ctv) || [];
        arr.push({
          ma: String((c as any).ma || "")
            .trim()
            .toUpperCase(),
          at,
          t,
        });
        clicksByCtv.set(ctv, arr);
      }
      for (const arr of clicksByCtv.values()) {
        arr.sort((a, b) => b.t - a.t);
      }
      function pickClickAt(
        ctvCode: string,
        ma: string,
        purchasedAt: string | null
      ): string | null {
        const arr = clicksByCtv.get(ctvCode) || [];
        if (!arr.length) return null;
        const before = purchasedAt
          ? new Date(purchasedAt).getTime()
          : Number.POSITIVE_INFINITY;
        let fallback: string | null = null;
        for (const c of arr) {
          if (Number.isFinite(before) && c.t > before) continue;
          if (ma && c.ma === ma) return c.at;
          if (!fallback) fallback = c.at;
        }
        return fallback;
      }

      const sumEligible = await col
        .aggregate([
          { $match: { status: "eligible" } },
          { $group: { _id: null, t: { $sum: "$amount" } } },
        ])
        .toArray();
      const sumHeld = await col
        .aggregate([
          { $match: { status: "held" } },
          { $group: { _id: null, t: { $sum: "$amount" } } },
        ])
        .toArray();

      let periodCounts:
        | {
            inBill: number;
            inBillSum: number;
            eligible: number;
            eligibleSum: number;
            all: number;
            allSum: number;
          }
        | undefined;

      if (ctvCode && period) {
        const periodMatch = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (periodMatch) {
          const y = Number(periodMatch[1]);
          const mo = Number(periodMatch[2]);
          const cycle = periodMatch[3] as "K1" | "K2" | undefined;
          let pStart: string;
          let pEnd: string;
          let eligibleQuery: Record<string, unknown>;
          if (cycle === "K1") {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            eligibleQuery = { eligibleAt: { $gte: pStart, $lt: pEnd } };
          } else if (cycle === "K2") {
            pStart = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
            // Đợt 2: gom đơn từ ngày 01 đến hết tháng thuộc cùng tháng yyyy-mm còn sót
            eligibleQuery = {
              eligibleAt: {
                $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                $lt: pEnd,
              },
            };
          } else {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
            eligibleQuery = { eligibleAt: { $gte: pStart, $lt: pEnd } };
          }

          const [inBillAgg, eligibleAgg, allAgg] = await Promise.all([
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    $or: [
                      { billingPeriod: period },
                      { status: { $in: ["billed", "paid_out"] }, billingPeriod: period },
                    ],
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    status: "eligible",
                    billingPeriod: { $in: [null, ""] },
                    ...eligibleQuery,
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    $or: [
                      { billingPeriod: period },
                      {
                        billingPeriod: { $in: [null, ""] },
                        eligibleAt: { $gte: pStart, $lt: pEnd },
                      },
                      ...(cycle === "K2"
                        ? [
                            {
                              status: "eligible",
                              billingPeriod: { $in: [null, ""] },
                              eligibleAt: {
                                $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                                $lt: pEnd,
                              },
                            },
                          ]
                        : []),
                    ],
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
          ]);

          periodCounts = {
            inBill: Number(inBillAgg[0]?.count) || 0,
            inBillSum: Number(inBillAgg[0]?.sum) || 0,
            eligible: Number(eligibleAgg[0]?.count) || 0,
            eligibleSum: Number(eligibleAgg[0]?.sum) || 0,
            all: Number(allAgg[0]?.count) || 0,
            allSum: Number(allAgg[0]?.sum) || 0,
          };
        }
      }

      return res.json({
        ok: true,
        total,
        page,
        limit,
        sums: {
          eligible: Number(sumEligible[0]?.t) || 0,
          held: Number(sumHeld[0]?.t) || 0,
        },
        periodCounts,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const shopCode = String(rest.orderCode || "").trim();
          const ctvCode = normalizeCtvCode(String(rest.ctvCode || ""));
          const ma = String(rest.ma || "")
            .trim()
            .toUpperCase();
          const purchasedAt =
            purchasedByShopCode.get(shopCode) ||
            toIso(rest.orderCreatedAt) ||
            null;
          return {
            id: String(_id),
            ...rest,
            ctvName: nameByCtv.get(ctvCode) || "",
            displayOrderCode: displayByShopCode.get(shopCode) || shopCode,
            purchasedAt,
            clickAt: pickClickAt(ctvCode, ma, purchasedAt),
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "commissions_failed" });
    }
  });
}
