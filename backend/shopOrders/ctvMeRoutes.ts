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
      const [held, eligible, billed, paid, pendingOrders] = await Promise.all([
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
        ctx.shopDb
          .collection("aloha_shop_orders")
          .find({
            ctvCodes: ctx.ctvCode,
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

      const settings = await getCtvSettings(ctx.shopDb);
      const pending = pendingOrders.map((o: any) => {
        const details = Array.isArray(o.orderDetails) ? o.orderDetails : [];
        const myLines = details.filter(
          (d: any) => normalizeCtvCode(String(d.ctvCode || "")) === ctx.ctvCode
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

      return res.json({
        ok: true,
        ctvCode: ctx.ctvCode,
        returnHoldDays: settings.returnHoldDays,
        held: { amount: Number(held[0]?.t) || 0, count: Number(held[0]?.n) || 0 },
        eligible: {
          amount: Number(eligible[0]?.t) || 0,
          count: Number(eligible[0]?.n) || 0,
        },
        billed: { amount: Number(billed[0]?.t) || 0, count: Number(billed[0]?.n) || 0 },
        paidOut: { amount: Number(paid[0]?.t) || 0, count: Number(paid[0]?.n) || 0 },
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

  /** Tổng quan kiểu sàn — metrics + danh sách SP (ảnh/tên/giá web) theo kỳ. */
  app.get("/api/shop/ctv/me/overview", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      const now = new Date();
      let from = new Date(String(req.query.from || ""));
      let to = new Date(String(req.query.to || ""));
      if (!Number.isFinite(from.getTime())) {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!Number.isFinite(to.getTime())) {
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      if (to < from) {
        const t = from;
        from = to;
        to = t;
      }
      // Chuẩn hóa cuối ngày cho `to` dạng date-only
      if (String(req.query.to || "").length <= 10) {
        to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      const clicksCol = ctx.shopDb.collection("aloha_shop_ctv_clicks");
      const ordersCol = ctx.shopDb.collection("aloha_shop_orders");
      const commCol = ctx.shopDb.collection(SHOP_COMMISSIONS);

      const [clicksCount, clickDocs, orders, commissions] = await Promise.all([
        clicksCol.countDocuments({
          ctv: ctx.ctvCode,
          $or: [
            { createdAt: { $gte: from, $lte: to } },
            { createdAtIso: { $gte: fromIso, $lte: toIso } },
          ],
        }),
        clicksCol
          .find({
            ctv: ctx.ctvCode,
            $or: [
              { createdAt: { $gte: from, $lte: to } },
              { createdAtIso: { $gte: fromIso, $lte: toIso } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(80)
          .project({ ma: 1, path: 1, createdAt: 1, createdAtIso: 1 })
          .toArray(),
        ordersCol
          .find({
            ctvCodes: ctx.ctvCode,
            $or: [
              { createdAt: { $gte: fromIso, $lte: toIso } },
              { createdAt: { $gte: from, $lte: to } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(120)
          .project({
            code: 1,
            customerPhone: 1,
            customerName: 1,
            total: 1,
            totalPayment: 1,
            orderStatus: 1,
            paymentStatus: 1,
            method: 1,
            usingCod: 1,
            createdAt: 1,
            orderDetails: 1,
          })
          .toArray(),
        commCol
          .find({
            ctvCode: ctx.ctvCode,
            status: { $nin: ["cancelled"] },
            $or: [
              { createdAt: { $gte: fromIso, $lte: toIso } },
              { createdAt: { $gte: from, $lte: to } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(80)
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
          if (normalizeCtvCode(String(d?.ctvCode || "")) !== ctx.ctvCode) continue;
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
      for (const c of clickDocs) {
        const ma = String((c as any).ma || "")
          .trim()
          .toUpperCase();
        if (ma) needMas.add(ma);
      }

      const byMa = new Map<
        string,
        { anh: string; giaWeb: number; ten: string }
      >();
      if (needMas.size) {
        const mas = [...needMas];
        const mainDb = await getDb();
        const products = await mainDb
          .collection("aloha_products")
          .find({
            deletedAt: null,
            $or: [
              { ma: { $in: mas } },
              { ma: { $in: mas.map((m) => m.toLowerCase()) } },
            ],
          })
          .project({
            ma: 1,
            ten: 1,
            anh: 1,
            images: 1,
            giaWeb: 1,
            giaBan: 1,
            giaChung: 1,
          })
          .toArray();
        for (const p of products) {
          const ma = String((p as any).ma || "")
            .trim()
            .toUpperCase();
          if (!ma) continue;
          const anh =
            String((p as any).anh || "").trim() ||
            String(
              (Array.isArray((p as any).images) && (p as any).images[0]) || ""
            ).trim();
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

      const enrichItem = (d: any) => {
        const ma = String(d?.productCode || d?.ma || "")
          .trim()
          .toUpperCase();
        const cat = ma ? byMa.get(ma) : undefined;
        const qty = Math.max(1, Math.floor(Number(d?.quantity ?? d?.qty) || 1));
        const price =
          Math.max(0, Number(d?.price ?? d?.gia) || 0) || (cat?.giaWeb ?? 0);
        const giaWeb = cat?.giaWeb || price;
        return {
          ma,
          ten: String(d?.productName || d?.ten || "").trim() || cat?.ten || ma,
          qty,
          price,
          giaWeb,
          imageUrl:
            String(d?.imageUrl || "").trim() || cat?.anh || undefined,
        };
      };

      let gmv = 0;
      let qtySold = 0;
      const phones = new Set<string>();
      const orderList: Array<{
        code: string;
        orderStatus: string;
        orderLabel: string;
        payLabel: string;
        total: number;
        createdAt: string | null;
        items: ReturnType<typeof enrichItem>[];
      }> = [];
      const productLines: Array<{
        id: string;
        orderCode: string;
        ma: string;
        productName: string;
        imageUrl?: string;
        giaWeb: number;
        qty: number;
        lineTotal: number;
        orderLabel: string;
      }> = [];
      const buyerMap = new Map<
        string,
        {
          phone: string;
          phoneMasked: string;
          name: string;
          orderCount: number;
          total: number;
          items: ReturnType<typeof enrichItem>[];
        }
      >();

      for (const o of activeOrders) {
        const total = Number((o as any).total ?? (o as any).totalPayment) || 0;
        gmv += total;
        const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
        if (phone.length >= 9) phones.add(phone);
        const st = String((o as any).orderStatus || "").toLowerCase();
        const pay = String((o as any).paymentStatus || "").toLowerCase();
        const isCod =
          Boolean((o as any).usingCod) ||
          pay === "cod" ||
          String((o as any).method) === "Cash";
        let payLabel = "Chờ thanh toán";
        if (pay === "paid" || pay === "da_thanh_toan") payLabel = "Đã thanh toán";
        else if (isCod) payLabel = "COD — thu khi giao";
        else if (pay === "pending" || pay === "cho_ck" || st === "cho_thanh_toan")
          payLabel = "Chờ chuyển khoản";
        let orderLabel = "Đang xử lý";
        if (st === "hoan_thanh") orderLabel = "Hoàn thành";
        else if (st === "dang_giao") orderLabel = "Đang giao";
        else if (st === "cho_xu_ly" || st === "cho") orderLabel = "Chờ xử lý";
        else if (st === "cho_thanh_toan") orderLabel = "Chờ thanh toán";
        else if (st === "thieu_hang") orderLabel = "Thiếu hàng";

        const details = Array.isArray((o as any).orderDetails)
          ? (o as any).orderDetails
          : [];
        const myLines = details
          .filter(
            (d: any) =>
              normalizeCtvCode(String(d?.ctvCode || "")) === ctx.ctvCode
          )
          .map(enrichItem);
        // Nếu dòng không gắn ctvCode từng SP, vẫn hiện toàn bộ SP trong đơn CTV
        const items =
          myLines.length > 0
            ? myLines
            : details.map(enrichItem).filter((it: any) => it.ma);

        for (const it of items) {
          qtySold += it.qty;
          productLines.push({
            id: `${(o as any).code}-${it.ma}-${productLines.length}`,
            orderCode: String((o as any).code || ""),
            ma: it.ma,
            productName: it.ten,
            imageUrl: it.imageUrl,
            giaWeb: it.giaWeb,
            qty: it.qty,
            lineTotal: it.price * it.qty,
            orderLabel,
          });
        }

        orderList.push({
          code: String((o as any).code || ""),
          orderStatus: st,
          orderLabel,
          payLabel,
          total,
          createdAt: (o as any).createdAt
            ? String((o as any).createdAt)
            : null,
          items,
        });

        if (phone.length >= 9) {
          const prev = buyerMap.get(phone);
          const masked =
            phone.length >= 10
              ? `${phone.slice(0, 3)}***${phone.slice(-3)}`
              : `${phone.slice(0, 2)}***`;
          if (!prev) {
            buyerMap.set(phone, {
              phone,
              phoneMasked: masked,
              name: String((o as any).customerName || "").trim() || "Khách",
              orderCount: 1,
              total,
              items: [...items],
            });
          } else {
            prev.orderCount += 1;
            prev.total += total;
            prev.items.push(...items);
          }
        }
      }

      let estimatedCommission = 0;
      const commissionLines = commissions.map((c: any, idx: number) => {
        const amount = Number(c.amount) || 0;
        estimatedCommission += amount;
        const ma = String(c.ma || "")
          .trim()
          .toUpperCase();
        const cat = ma ? byMa.get(ma) : undefined;
        const qty = Math.max(1, Math.floor(Number(c.qty) || 1));
        const giaWeb =
          Number(c.unitPrice) ||
          (Number(c.lineTotal) > 0
            ? Math.round(Number(c.lineTotal) / qty)
            : 0) ||
          (cat?.giaWeb ?? 0);
        return {
          id: String(c._id || `${c.orderCode}-${ma}-${idx}`),
          orderCode: String(c.orderCode || ""),
          ma,
          productName:
            String(c.productName || "").trim() || cat?.ten || ma || "Sản phẩm",
          imageUrl: String(c.imageUrl || "").trim() || cat?.anh || undefined,
          giaWeb,
          qty,
          amount,
          status: String(c.status || ""),
          rate: c.rate != null ? Number(c.rate) : undefined,
        };
      });

      const clickLines = clickDocs.map((c: any, idx: number) => {
        const ma = String(c.ma || "")
          .trim()
          .toUpperCase();
        const cat = ma ? byMa.get(ma) : undefined;
        return {
          id: String(c._id || `click-${idx}`),
          ma: ma || "",
          productName: cat?.ten || ma || String(c.path || "Click CTV"),
          imageUrl: cat?.anh || undefined,
          giaWeb: cat?.giaWeb || 0,
          path: String(c.path || ""),
          createdAt: c.createdAtIso || c.createdAt || null,
        };
      });

      return res.json({
        ok: true,
        from: fromIso.slice(0, 10),
        to: toIso.slice(0, 10),
        metrics: {
          clicks: clicksCount,
          orders: activeOrders.length,
          qtySold,
          gmv,
          estimatedCommission,
          buyers: phones.size,
        },
        lists: {
          orders: orderList,
          lines: productLines,
          commissions: commissionLines,
          clicks: clickLines,
          buyers: [...buyerMap.values()].map((b) => ({
            phoneMasked: b.phoneMasked,
            name: b.name,
            orderCount: b.orderCount,
            total: b.total,
            items: b.items,
          })),
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overview_failed" });
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

      const orderCodes = [
        ...new Set(
          rows
            .map((r) => String((r as any).orderCode || "").trim())
            .filter(Boolean)
        ),
      ];
      const orderByCode = new Map<string, Record<string, unknown>>();
      if (orderCodes.length) {
        const orders = await ctx.shopDb
          .collection("aloha_shop_orders")
          .find({ code: { $in: orderCodes } })
          .project({
            code: 1,
            orderStatus: 1,
            paymentStatus: 1,
            method: 1,
            usingCod: 1,
            deliveredAt: 1,
          })
          .toArray();
        for (const o of orders) {
          const code = String((o as any).code || "").trim();
          if (code) orderByCode.set(code, o as any);
        }
      }

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
          const ord = orderByCode.get(String(rest.orderCode || "").trim());
          const pay = String(ord?.paymentStatus || "").toLowerCase();
          const st = String(ord?.orderStatus || "").toLowerCase();
          const isCod =
            Boolean(ord?.usingCod) ||
            pay === "cod" ||
            String(ord?.method || "") === "Cash";
          let payLabel = "";
          if (ord) {
            if (pay === "paid" || pay === "da_thanh_toan" || st === "hoan_thanh")
              payLabel = isCod ? "Đã thu COD / đã giao" : "Đã thanh toán";
            else if (isCod) payLabel = "COD — thu khi giao";
            else payLabel = "Chờ thanh toán";
          }
          let orderLabel = "";
          if (st === "hoan_thanh") orderLabel = "Đã giao thành công";
          else if (st === "dang_giao") orderLabel = "Đang giao";
          else if (st === "huy") orderLabel = "Đã hủy";
          else if (st) orderLabel = "Đang xử lý";
          return {
            id: String(_id),
            ...rest,
            ma,
            productName,
            imageUrl: imageUrl || undefined,
            unitPrice,
            giaWeb: unitPrice,
            amount: Number(rest.amount) || 0,
            orderStatus: st || undefined,
            paymentStatus: pay || undefined,
            payLabel: payLabel || undefined,
            orderLabel: orderLabel || undefined,
            isCod: ord ? isCod : undefined,
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

  /**
   * Báo cáo chuyển đổi — đơn gắn CTV trong kỳ (filter + dòng SP / HH).
   */
  app.get("/api/shop/ctv/me/conversions", auth, async (req: ShopAuthRequest, res) => {
    try {
      const ctx = await requireActiveCtv(req, res);
      if (!ctx) return;
      const now = new Date();
      let from = new Date(String(req.query.from || ""));
      let to = new Date(String(req.query.to || ""));
      if (!Number.isFinite(from.getTime())) {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!Number.isFinite(to.getTime())) {
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      if (String(req.query.to || "").length <= 10) {
        to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
      }
      if (to < from) {
        const t = from;
        from = to;
        to = t;
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const orderQ = String(req.query.orderCode || req.query.q || "")
        .trim()
        .toUpperCase();
      const statusFilter = String(req.query.orderStatus || "")
        .trim()
        .toLowerCase();
      const payFilter = String(req.query.paymentStatus || "")
        .trim()
        .toLowerCase();

      const orders = await ctx.shopDb
        .collection("aloha_shop_orders")
        .find({
          ctvCodes: ctx.ctvCode,
          $or: [
            { createdAt: { $gte: fromIso, $lte: toIso } },
            { createdAt: { $gte: from, $lte: to } },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .project({
          code: 1,
          kvInvoiceCode: 1,
          kvOrderCode: 1,
          legacyCodes: 1,
          customerPhone: 1,
          customerName: 1,
          total: 1,
          totalPayment: 1,
          orderStatus: 1,
          paymentStatus: 1,
          method: 1,
          usingCod: 1,
          createdAt: 1,
          deliveredAt: 1,
          completedAt: 1,
          orderDetails: 1,
        })
        .toArray();

      const codes = orders
        .map((o) => String((o as any).code || "").trim())
        .filter(Boolean);
      const [comms, clicks] = await Promise.all([
        codes.length
          ? ctx.shopDb
              .collection(SHOP_COMMISSIONS)
              .find({
                ctvCode: ctx.ctvCode,
                orderCode: { $in: codes },
                status: { $nin: ["cancelled"] },
              })
              .project({
                orderCode: 1,
                amount: 1,
                ma: 1,
                productName: 1,
                qty: 1,
                status: 1,
                createdAt: 1,
              })
              .toArray()
          : Promise.resolve([]),
        ctx.shopDb
          .collection("aloha_shop_ctv_clicks")
          .find({
            ctv: ctx.ctvCode,
            $or: [
              { createdAt: { $gte: from, $lte: to } },
              { createdAtIso: { $gte: fromIso, $lte: toIso } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(300)
          .project({ ma: 1, createdAt: 1, createdAtIso: 1 })
          .toArray(),
      ]);

      const commByOrder = new Map<string, typeof comms>();
      for (const c of comms) {
        const code = String((c as any).orderCode || "").trim();
        if (!code) continue;
        const arr = commByOrder.get(code) || [];
        arr.push(c);
        commByOrder.set(code, arr);
      }

      // Click gần nhất theo mã SP (ước lượng)
      const clickByMa = new Map<string, string>();
      for (const c of clicks) {
        const ma = String((c as any).ma || "")
          .trim()
          .toUpperCase();
        if (!ma || clickByMa.has(ma)) continue;
        const at = (c as any).createdAtIso || (c as any).createdAt;
        if (at) clickByMa.set(ma, String(at));
      }

      // Đếm số đơn theo SĐT để phân loại khách mới / đã tồn tại
      const phoneCounts = new Map<string, number>();
      for (const o of orders) {
        const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
        if (phone.length >= 9) {
          phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
        }
      }

      const rows: Array<Record<string, unknown>> = [];
      for (const o of orders) {
        const code = String((o as any).code || "").trim();
        const kvInvoiceCode = String((o as any).kvInvoiceCode || "").trim();
        const kvOrderCode = String((o as any).kvOrderCode || "").trim();
        /** Ưu tiên mã HĐ KV (CK), rồi ĐH KV (COD), rồi mã shop WEB-/DH- */
        const displayCode = kvInvoiceCode || kvOrderCode || code;
        const legacy = Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes.map((x: unknown) => String(x || "").toUpperCase())
          : [];
        if (
          orderQ &&
          !displayCode.toUpperCase().includes(orderQ) &&
          !code.toUpperCase().includes(orderQ) &&
          !kvInvoiceCode.toUpperCase().includes(orderQ) &&
          !kvOrderCode.toUpperCase().includes(orderQ) &&
          !legacy.some((x: string) => x.includes(orderQ))
        ) {
          continue;
        }
        const stRaw = String((o as any).orderStatus || "").toLowerCase();
        const st =
          stRaw === "cho" || stRaw === "cho_xu_ly"
            ? "cho_xu_ly"
            : stRaw;
        if (st === "huy" && statusFilter !== "huy") continue;
        if (statusFilter && statusFilter !== "all") {
          if (statusFilter === "cho_xu_ly") {
            if (st !== "cho_xu_ly") continue;
          } else if (st !== statusFilter) continue;
        }
        const pay = String((o as any).paymentStatus || "").toLowerCase();
        const isCod =
          Boolean((o as any).usingCod) ||
          pay === "cod" ||
          String((o as any).method) === "Cash";
        const isPaid = pay === "paid" || pay === "da_thanh_toan";
        const isUnpaid =
          !isPaid &&
          !isCod &&
          (pay === "unpaid" ||
            pay === "pending" ||
            pay === "processing" ||
            pay === "cho_ck" ||
            pay === "" ||
            st === "cho_thanh_toan");
        if (payFilter === "paid" && !isPaid) continue;
        if (payFilter === "cod" && !isCod) continue;
        if (payFilter === "pending" && !isUnpaid) continue;
        if (payFilter === "underpaid" && pay !== "underpaid") continue;

        let payLabel = "Chờ thanh toán";
        if (pay === "paid" || pay === "da_thanh_toan") payLabel = "Đã thanh toán";
        else if (isCod) payLabel = "COD — thu khi giao";
        else if (pay === "pending" || pay === "cho_ck" || st === "cho_thanh_toan")
          payLabel = "Chờ chuyển khoản";

        let orderLabel = "Đang xử lý";
        if (st === "hoan_thanh") orderLabel = "Hoàn thành";
        else if (st === "dang_giao") orderLabel = "Đang giao";
        else if (st === "cho_xu_ly" || st === "cho") orderLabel = "Chờ xử lý";
        else if (st === "cho_thanh_toan") orderLabel = "Chờ thanh toán";
        else if (st === "thieu_hang") orderLabel = "Thiếu hàng";
        else if (st === "huy") orderLabel = "Đã hủy";

        const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
        const buyerStatus =
          phone.length >= 9 && (phoneCounts.get(phone) || 0) > 1
            ? "Đã tồn tại"
            : "Khách mới";

        const orderComms = commByOrder.get(code) || [];
        const totalCommission = orderComms.reduce(
          (s, c) => s + (Number((c as any).amount) || 0),
          0
        );
        const details = Array.isArray((o as any).orderDetails)
          ? (o as any).orderDetails
          : [];
        const firstMa = String(
          details[0]?.productCode || details[0]?.ma || orderComms[0]?.ma || ""
        )
          .trim()
          .toUpperCase();
        const purchasedAt = (o as any).createdAt
          ? String((o as any).createdAt)
          : null;
        const completedAt = (o as any).deliveredAt || (o as any).completedAt || null;
        const clickAt = firstMa ? clickByMa.get(firstMa) || null : null;

        const productNames = [
          ...new Set(
            [
              ...details.map((d: any) =>
                String(d.productName || d.ten || d.productCode || d.ma || "").trim()
              ),
              ...orderComms.map((c: any) =>
                String(c.productName || c.ma || "").trim()
              ),
            ].filter(Boolean)
          ),
        ].slice(0, 3);

        rows.push({
          orderCode: displayCode,
          shopOrderCode: code,
          kvInvoiceCode: kvInvoiceCode || null,
          kvOrderCode: kvOrderCode || null,
          purchasedAt,
          clickAt,
          completedAt: completedAt ? String(completedAt) : null,
          orderStatus: st,
          orderLabel,
          payLabel,
          paymentStatus: pay,
          total: Number((o as any).total ?? (o as any).totalPayment) || 0,
          itemCommission: totalCommission,
          totalCommission,
          buyerStatus,
          productSummary: productNames.join(", ") || "—",
          commissionStatus:
            orderComms.length === 0
              ? "Chưa phát sinh"
              : orderComms.some((c) => (c as any).status === "paid_out")
                ? "Đã chi"
                : orderComms.some((c) =>
                      ["eligible", "billed"].includes(String((c as any).status))
                    )
                  ? "Đủ điều kiện"
                  : "Tạm giữ",
        });
      }

      return res.json({
        ok: true,
        from: fromIso.slice(0, 10),
        to: toIso.slice(0, 10),
        total: rows.length,
        data: rows,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "conversions_failed" });
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
