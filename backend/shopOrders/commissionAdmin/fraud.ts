import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_CTV_FRAUD_EVENTS } from "../commissionModels.js";
import {
  clearCommissionFraudFlag,
  confirmCommissionFraud,
  clearSoftPhoneRepeatFlags,
} from "../commission.js";

export function registerFraud(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/fraud", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const rows = await shopDb
        .collection(SHOP_CTV_FRAUD_EVENTS)
        .find({})
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
            .project({ code: 1, id: 1, kvInvoiceCode: 1, kvOrderCode: 1, legacyCodes: 1 })
            .toArray()
        : [];
      const displayByShopCode = new Map<string, string>();
      for (const o of orderDocs) {
        const shop = String((o as any).code || (o as any).id || "").trim();
        const display =
          String((o as any).kvInvoiceCode || "").trim() ||
          String((o as any).kvOrderCode || "").trim() ||
          shop;
        if (shop) displayByShopCode.set(shop, display);
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) displayByShopCode.set(L, display);
        }
      }
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const shopCode = String(rest.orderCode || "").trim();
          return {
            id: String(_id),
            ...rest,
            displayOrderCode: shopCode
              ? displayByShopCode.get(shopCode) || shopCode
              : null,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "fraud_list_failed" });
    }
  });

  /** Bỏ cờ gian → HH về held/eligible */
  app.post(
    "/api/shop/admin/ctv/commissions/clear-flag",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const result = await clearCommissionFraudFlag(shopDb, {
          id: req.body?.id ? String(req.body.id) : undefined,
          orderCode: req.body?.orderCode
            ? String(req.body.orderCode)
            : undefined,
          ctvCode: req.body?.ctvCode ? String(req.body.ctvCode) : undefined,
          ma: req.body?.ma ? String(req.body.ma) : undefined,
          by: req.auth?.username || "admin",
          note: req.body?.note ? String(req.body.note) : undefined,
        });
        if (!result.ok) return res.status(400).json(result);
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "clear_flag_failed" });
      }
    }
  );

  /** Xác nhận gian → hủy HH */
  app.post(
    "/api/shop/admin/ctv/commissions/confirm-fraud",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const result = await confirmCommissionFraud(shopDb, {
          id: req.body?.id ? String(req.body.id) : undefined,
          orderCode: req.body?.orderCode
            ? String(req.body.orderCode)
            : undefined,
          ctvCode: req.body?.ctvCode ? String(req.body.ctvCode) : undefined,
          ma: req.body?.ma ? String(req.body.ma) : undefined,
          by: req.auth?.username || "admin",
          reason: req.body?.reason ? String(req.body.reason) : undefined,
        });
        if (!result.ok) return res.status(400).json(result);
        return res.json(result);
      } catch (e: any) {
        return res
          .status(500)
          .json({ error: e?.message || "confirm_fraud_failed" });
      }
    }
  );

  /** Gỡ hàng loạt cờ cũ chỉ do trùng SĐT (không self-buy) */
  app.post(
    "/api/shop/admin/ctv/commissions/clear-soft-flags",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const modified = await clearSoftPhoneRepeatFlags(
          shopDb,
          req.auth?.username || "admin"
        );
        return res.json({ ok: true, modified });
      } catch (e: any) {
        return res
          .status(500)
          .json({ error: e?.message || "clear_soft_failed" });
      }
    }
  );

  /** Đánh dấu đã xử lý 1 fraud event — body { id, reviewStatus, note } */
  app.post(
    "/api/shop/admin/ctv/fraud/review",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const { ObjectId } = await import("mongodb");
        const id = String(req.body?.id || req.params?.id || "").trim();
        if (!id) return res.status(400).json({ error: "missing_id" });
        let filter: Record<string, unknown>;
        try {
          filter = { _id: new ObjectId(id) };
        } catch {
          filter = { _id: id as any };
        }
        const reviewStatus = String(req.body?.reviewStatus || "dismissed");
        if (!["dismissed", "confirmed", "open"].includes(reviewStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }
        const now = new Date().toISOString();
        const r = await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).updateOne(
          filter,
          {
            $set: {
              reviewStatus,
              reviewedAt: now,
              reviewedBy: req.auth?.username || "admin",
              reviewNote: String(req.body?.note || "").slice(0, 300),
            },
          }
        );
        if (!r.matchedCount) {
          return res.status(404).json({ error: "fraud_event_not_found" });
        }
        return res.json({ ok: true, modified: r.modifiedCount || 0 });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "review_failed" });
      }
    }
  );

  // Alias cũ (path param) — giữ tương thích
  app.post(
    "/api/shop/admin/ctv/fraud/:id/review",
    ...gate,
    async (req: AuthRequest, res) => {
      req.body = {
        ...(req.body || {}),
        id: String(req.params.id || ""),
        reviewStatus: req.body?.reviewStatus || "dismissed",
        note: req.body?.note || "",
      };
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const { ObjectId } = await import("mongodb");
        const id = String(req.params.id || "").trim();
        let filter: Record<string, unknown>;
        try {
          filter = { _id: new ObjectId(id) };
        } catch {
          filter = { _id: id as any };
        }
        const reviewStatus = String(req.body?.reviewStatus || "dismissed");
        if (!["dismissed", "confirmed", "open"].includes(reviewStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }
        const now = new Date().toISOString();
        const r = await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).updateOne(
          filter,
          {
            $set: {
              reviewStatus,
              reviewedAt: now,
              reviewedBy: req.auth?.username || "admin",
              reviewNote: String(req.body?.note || "").slice(0, 300),
            },
          }
        );
        if (!r.matchedCount) {
          return res.status(404).json({ error: "fraud_event_not_found" });
        }
        return res.json({ ok: true, modified: r.modifiedCount || 0 });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "review_failed" });
      }
    }
  );
}
