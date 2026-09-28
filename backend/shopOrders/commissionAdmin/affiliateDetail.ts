import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import {
  SHOP_ACCOUNTS,
  isValidCtvCode,
  normalizeCtvCode,
  toPublicShopAccount,
} from "../../shopAuth/models.js";
import {
  SHOP_COMMISSIONS,
  SHOP_COMMISSION_BILLS,
} from "../commissionModels.js";
import {
  clearHeldCommissions,
  voidUnpaidCommissionsForCtv,
} from "../commission.js";
import { recordFraudEvent } from "../ctvFraud.js";

export function registerAffiliateDetail(app: Express, ctx: CommissionAdminCtx) {
  const { getDb, getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/affiliates/:ctvCode", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const mainDb = await getDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);

      const ctvCode = normalizeCtvCode(String(req.params.ctvCode || ""));
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });

      const account = await shopDb.collection(SHOP_ACCOUNTS).findOne({ ctvCode });
      if (!account || !(account as any).roles?.includes?.("ctv")) {
        return res.status(404).json({ error: "ctv_not_found" });
      }

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
        to = new Date(ty, tm - 1, td + 1);
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

      const clicksCol = shopDb.collection("aloha_shop_ctv_clicks");
      const ordersCol = shopDb.collection("aloha_shop_orders");
      const commCol = shopDb.collection(SHOP_COMMISSIONS);
      const billsCol = shopDb.collection(SHOP_COMMISSION_BILLS);

      const useStrictRange = ymdRe.test(fromQ) && ymdRe.test(toQ);
      const clickOr = {
        $or: [
          { createdAt: { $gte: from, $lt: to } },
          { createdAtIso: { $gte: fromIso, $lt: toIso } },
        ],
      };
      const orderOr = {
        $or: [
          { createdAt: { $gte: fromIso, $lt: toIso } },
          { createdAt: { $gte: from, $lt: to } },
        ],
      };
      const commOr = {
        $or: [
          ...(useStrictRange ? [] : [{ billingPeriod: periodKey }]),
          { createdAt: { $gte: fromIso, $lt: toIso } },
          { createdAt: { $gte: from, $lt: to } },
          { deliveredAt: { $gte: fromIso, $lt: toIso } },
        ],
      };

      const [clicksCount, orders, commissions, billDocs] = await Promise.all([
        clicksCol.countDocuments({
          $and: [{ $or: [{ ctv: ctvCode }, { ctvCode }] }, clickOr],
        }),
        ordersCol
          .find({ ctvCodes: ctvCode, ...orderOr })
          .sort({ createdAt: -1 })
          .limit(80)
          .project({
            code: 1,
            total: 1,
            totalPayment: 1,
            orderStatus: 1,
            createdAt: 1,
            orderDetails: 1,
            kvInvoiceCode: 1,
            kvOrderCode: 1,
            legacyCodes: 1,
          })
          .toArray(),
        commCol
          .find({
            ctvCode,
            status: { $nin: ["cancelled"] },
            ...commOr,
          })
          .sort({ createdAt: -1 })
          .limit(100)
          .project({
            amount: 1,
            qty: 1,
            status: 1,
            ma: 1,
            productName: 1,
            imageUrl: 1,
            unitPrice: 1,
            lineTotal: 1,
            orderCode: 1,
            rate: 1,
            createdAt: 1,
            billingPeriod: 1,
          })
          .toArray(),
        billsCol
          .find({
            $or: [{ "ctvLines.ctvCode": ctvCode }, { "lines.ctvCode": ctvCode }],
          })
          .sort({ period: -1 })
          .limit(24)
          .project({
            period: 1,
            status: 1,
            lockedAt: 1,
            paidAt: 1,
            ctvLines: 1,
            lines: 1,
            totals: 1,
          })
          .toArray(),
      ]);

      const activeOrders = orders.filter(
        (o) => String((o as any).orderStatus) !== "huy"
      );

      const needMas = new Set<string>();
      for (const o of activeOrders) {
        const details = Array.isArray((o as any).orderDetails)
          ? (o as any).orderDetails
          : [];
        for (const d of details) {
          if (normalizeCtvCode(String(d?.ctvCode || "")) && normalizeCtvCode(String(d?.ctvCode || "")) !== ctvCode) {
            continue;
          }
          const ma = String(d?.productCode || d?.ma || "")
            .trim()
            .toUpperCase();
          if (ma) needMas.add(ma);
        }
      }
      for (const c of commissions) {
        const ma = String((c as any).ma || "")
          .trim()
          .toUpperCase();
        if (ma) needMas.add(ma);
      }

      const byMa = new Map<string, { anh: string; giaWeb: number; ten: string }>();
      if (needMas.size) {
        const mas = [...needMas];
        const products = await mainDb
          .collection("aloha_products")
          .find({
            deletedAt: null,
            $or: [{ ma: { $in: mas } }, { ma: { $in: mas.map((x) => x.toLowerCase()) } }],
          })
          .project({ ma: 1, ten: 1, anh: 1, images: 1, giaWeb: 1, giaBan: 1, giaChung: 1 })
          .toArray();
        for (const p of products) {
          const ma = String((p as any).ma || "")
            .trim()
            .toUpperCase();
          if (!ma) continue;
          const anh =
            String((p as any).anh || "").trim() ||
            String((Array.isArray((p as any).images) && (p as any).images[0]) || "").trim();
          byMa.set(ma, {
            anh,
            giaWeb:
              Number((p as any).giaWeb) ||
              Number((p as any).giaBan) ||
              Number((p as any).giaChung) ||
              0,
            ten: String((p as any).ten || "").trim(),
          });
        }
      }

      const displayCodeOf = (o: any) =>
        String(o?.kvInvoiceCode || "").trim() ||
        String(o?.kvOrderCode || "").trim() ||
        String(o?.code || "").trim();

      const displayByShopCode = new Map<string, string>();
      for (const o of activeOrders) {
        const display = displayCodeOf(o);
        const shop = String((o as any).code || "").trim();
        if (shop) displayByShopCode.set(shop, display);
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) displayByShopCode.set(L, display);
        }
      }

      // Bổ sung map mã KV cho đơn chỉ có trong hoa hồng (không nằm trong list orders kỳ)
      const missingCommCodes = [
        ...new Set(
          commissions
            .map((c: any) => String(c.orderCode || "").trim())
            .filter((c) => c && !displayByShopCode.has(c))
        ),
      ];
      if (missingCommCodes.length) {
        const extraOrders = await ordersCol
          .find({
            $or: [
              { code: { $in: missingCommCodes } },
              { id: { $in: missingCommCodes } },
              { legacyCodes: { $in: missingCommCodes } },
            ],
          })
          .project({ code: 1, id: 1, kvInvoiceCode: 1, kvOrderCode: 1, legacyCodes: 1 })
          .toArray();
        for (const o of extraOrders) {
          const display = displayCodeOf(o);
          const shop = String((o as any).code || (o as any).id || "").trim();
          if (shop) displayByShopCode.set(shop, display);
          for (const leg of Array.isArray((o as any).legacyCodes)
            ? (o as any).legacyCodes
            : []) {
            const L = String(leg || "").trim();
            if (L) displayByShopCode.set(L, display);
          }
        }
      }

      let gmv = 0;
      let commissionTotal = 0;
      const productMap = new Map<
        string,
        {
          ma: string;
          name: string;
          imageUrl?: string;
          price: number;
          orderCount: number;
          qty: number;
        }
      >();

      const orderList = activeOrders.map((o: any) => {
        const total = Number(o.total ?? o.totalPayment) || 0;
        gmv += total;
        const details = Array.isArray(o.orderDetails) ? o.orderDetails : [];
        const myLines = details.filter((d: any) => {
          const code = normalizeCtvCode(String(d?.ctvCode || ""));
          return !code || code === ctvCode;
        });
        for (const d of myLines.length ? myLines : details) {
          const ma = String(d?.productCode || d?.ma || "")
            .trim()
            .toUpperCase();
          if (!ma) continue;
          const cat = byMa.get(ma);
          const qty = Math.max(1, Math.floor(Number(d?.quantity ?? d?.qty) || 1));
          const price =
            Math.max(0, Number(d?.price ?? d?.gia) || 0) || (cat?.giaWeb ?? 0);
          const prev = productMap.get(ma);
          if (!prev) {
            productMap.set(ma, {
              ma,
              name: String(d?.productName || d?.ten || "").trim() || cat?.ten || ma,
              imageUrl: String(d?.imageUrl || "").trim() || cat?.anh || undefined,
              price: cat?.giaWeb || price,
              orderCount: 1,
              qty,
            });
          } else {
            prev.orderCount += 1;
            prev.qty += qty;
          }
        }
        const shopCode = String(o.code || "");
        const displayCode = displayByShopCode.get(shopCode) || displayCodeOf(o) || shopCode;
        return {
          code: shopCode,
          displayCode,
          total,
          orderStatus: String(o.orderStatus || ""),
          createdAt: o.createdAt ? String(o.createdAt) : null,
        };
      });

      const commissionList = commissions.map((c: any, idx: number) => {
        const amount = Number(c.amount) || 0;
        commissionTotal += amount;
        const ma = String(c.ma || "")
          .trim()
          .toUpperCase();
        const cat = ma ? byMa.get(ma) : undefined;
        const shopCode = String(c.orderCode || "");
        const displayCode = displayByShopCode.get(shopCode) || shopCode;
        return {
          id: String(c._id || `${c.orderCode}-${ma}-${idx}`),
          orderCode: shopCode,
          displayOrderCode: displayCode,
          ma,
          productName: String(c.productName || "").trim() || cat?.ten || ma || "Sản phẩm",
          imageUrl: String(c.imageUrl || "").trim() || cat?.anh || undefined,
          amount,
          status: String(c.status || ""),
          createdAt: c.createdAt ? String(c.createdAt) : null,
        };
      });

      const payouts = billDocs
        .map((b: any) => {
          const lines = Array.isArray(b.ctvLines)
            ? b.ctvLines
            : Array.isArray(b.lines)
              ? b.lines
              : [];
          const mine = lines.find(
            (l: any) => normalizeCtvCode(String(l.ctvCode || "")) === ctvCode
          );
          if (!mine) return null;
          return {
            period: String(b.period || ""),
            status: String(b.status || ""),
            amount: Number(mine.net ?? mine.amount ?? mine.commission) || 0,
            orderCount: Number(mine.orderCount) || 0,
            lockedAt: b.lockedAt ? String(b.lockedAt) : null,
            paidAt: b.paidAt ? String(b.paidAt) : null,
          };
        })
        .filter(Boolean);

      const products = [...productMap.values()].sort((a, b) => b.orderCount - a.orderCount);

      const recentHistory = [
        ...orderList.slice(0, 8).map((o) => ({
          type: "order" as const,
          id: o.code,
          label: `Đơn #${o.displayCode || o.code}`,
          amount: o.total,
          badge: "Đơn hàng",
          at: o.createdAt,
        })),
        ...commissionList.slice(0, 8).map((c) => ({
          type: "commission" as const,
          id: c.id,
          label: c.displayOrderCode
            ? `Đơn #${c.displayOrderCode}`
            : c.productName,
          amount: c.amount,
          badge: "Hoa hồng",
          at: c.createdAt,
        })),
      ]
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 10);

      const origin = String(process.env.SHOP_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SHOP_ORIGIN || "")
        .trim()
        .replace(/\/$/, "");
      const referralPath = `/?ctv=${encodeURIComponent(ctvCode)}`;
      const referralUrl = origin ? `${origin}${referralPath}` : referralPath;

      return res.json({
        ok: true,
        period: periodKey,
        account: toPublicShopAccount(account),
        referralUrl,
        metrics: {
          clicks: clicksCount,
          orders: activeOrders.length,
          revenue: gmv,
          commission: commissionTotal,
        },
        products,
        recentHistory,
        orders: orderList,
        commissions: commissionList,
        payouts,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "affiliate_detail_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/:ctvCode/ban", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const raw = String(req.params.ctvCode || "").trim().toLowerCase();
      // Tránh nuốt nhầm path tĩnh (fraud/commissions/settings…)
      if (
        ["fraud", "commissions", "settings", "bills", "stats", "overview", "overrides", "product-rates", "affiliates"].includes(
          raw
        )
      ) {
        return res.status(404).json({ error: "not_found" });
      }
      const ctvCode = normalizeCtvCode(String(req.params.ctvCode || ""));
      const reason = String(req.body?.reason || "fraud").slice(0, 200);
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });
      const now = new Date().toISOString();
      await shopDb.collection(SHOP_ACCOUNTS).updateOne(
        { ctvCode },
        {
          $set: {
            ctvStatus: "khoa",
            lockedReason: reason,
            bannedAt: now,
            updatedAt: now,
          },
        }
      );
      const voided = await voidUnpaidCommissionsForCtv(shopDb, ctvCode, reason);
      await recordFraudEvent(shopDb, {
        type: "manual_ban",
        ctvCode,
        details: [reason],
        by: req.auth?.username || "admin",
        severity: "high",
        reviewStatus: "confirmed",
      });
      try {
        const { syncBus } = await import("../../syncBus.js");
        syncBus.publish(["aloha_shop_ctv_fraud"], "ctv-ban", { ctvCode });
      } catch {
        /* ignore */
      }
      return res.json({ ok: true, voided });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "ban_failed" });
    }
  });
}
