/**
 * Route: GET /api/shop/ctv/me/commissions
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import { SHOP_COMMISSIONS } from "../commissionModels.js";
import { clearHeldCommissions } from "../commission.js";
import type { CtvMeCtx } from "./shared.js";

export function registerCtvMeCommissionsRoute(app: Express, ctx: CtvMeCtx) {
  app.get("/api/shop/ctv/me/commissions", ctx.auth, async (req: ShopAuthRequest, res) => {
    try {
      const activeCtv = await ctx.requireActiveCtv(req, res);
      if (!activeCtv) return;
      await clearHeldCommissions(activeCtv.shopDb, { ctvCode: activeCtv.ctvCode });
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
      const rows = await activeCtv.shopDb
        .collection(SHOP_COMMISSIONS)
        .find({ ctvCode: activeCtv.ctvCode })
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
        const orders = await activeCtv.shopDb
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
        ...new Set<string>(
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
        const mainDb = await ctx.getDb();
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
}
