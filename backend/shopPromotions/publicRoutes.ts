import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import type { GetShopDb } from "../shopAuth/routes.js";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { applyShopCors } from "../shopCors.js";
import {
  PROMOTIONS_COL,
  type PromotionDoc,
  type CartItemToEvaluate,
} from "./types.js";
import { isShippingPromotion } from "./evaluator.js";
import { checkIsNewWebBuyer } from "./customerEligibility.js";
import {
  customerKeyFor,
  evaluateGoodsPromotions,
  loadActivePromotions,
  shipVoucherEnabled,
} from "./checkoutPromotions.js";

export function registerShopPromotionsPublicRoutes(
  app: Express,
  getShopDb: GetShopDb
) {
  app.options("/api/shop/promotions/*", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  // GET /api/shop/promotions/available — Lấy danh sách ưu đãi công khai
  app.get("/api/shop/promotions/available", async (req, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const nowIso = new Date().toISOString();

      const promotions = await shopDb
        .collection<PromotionDoc>(PROMOTIONS_COL)
        .find({
          status: "active",
          isPublic: { $ne: false },
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: nowIso } },
          ],
          $and: [
            {
              $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: nowIso } },
              ],
            },
          ],
        })
        .sort({ priority: -1, createdAt: -1 })
        .toArray();

      const visible = shipVoucherEnabled()
        ? promotions
        : promotions.filter((p) => !isShippingPromotion(p));

      res.json({
        ok: true,
        items: visible.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description || "",
          type: p.type,
          benefitType: p.benefitType || "goods",
          discountType: p.discountType,
          discountValue: p.discountValue,
          maxDiscountVnd: p.maxDiscountVnd,
          minOrderThreshold: p.minOrderThreshold,
          thresholdOperator: p.thresholdOperator || ">",
          targetCustomer: p.targetCustomer,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải ưu đãi" });
    }
  });

  // POST /api/shop/promotions/quote — Báo giá giỏ hàng với ưu đãi
  app.post(
    "/api/shop/promotions/quote",
    async (req: Request, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const body = req.body || {};
        const itemsRaw = Array.isArray(body.items) ? body.items : [];
        const selectedCode = String(body.selectedCode || "").trim().toUpperCase();
        const autoMode = body.autoMode !== false;

        const items: CartItemToEvaluate[] = itemsRaw.map((it: any) => ({
          ma: String(it.ma || it.productCode || "").trim().toUpperCase(),
          ten: String(it.ten || it.productName || "").trim(),
          price: Math.max(0, Number(it.price ?? it.gia ?? 0) || 0),
          quantity: Math.max(1, Math.floor(Number(it.quantity ?? it.qty ?? 1) || 1)),
          categoryId: it.categoryId ? String(it.categoryId).trim() : undefined,
          categorySlug: it.categorySlug ? String(it.categorySlug).trim() : undefined,
          nhom: it.nhom ? String(it.nhom).trim() : undefined,
        }));

        const token =
          (req.cookies?.[ACCESS_COOKIE] as string | undefined) ||
          (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : undefined);
        let userAccount: any = null;
        if (token) {
          try {
            const payload = verifyShopAccessToken(token);
            if (payload?.sub) {
              userAccount = await shopDb
                .collection(SHOP_ACCOUNTS)
                .findOne(shopAccountIdQuery(payload.sub));
            }
          } catch {
            // Optional auth, token invalid
          }
        }

        const buyerPhone = String(body.phone || userAccount?.phone || "").trim();
        const buyerEmail = String(body.email || userAccount?.email || "").trim();
        const buyerUserId = userAccount?._id ? String(userAccount._id) : undefined;
        const isWholesale = Boolean(
          userAccount?.roles?.includes("si") || userAccount?.roles?.includes("wholesale")
        );

        // Kiểm tra điều kiện khách mới mua lần đầu trên web
        const isNewWebBuyer = await checkIsNewWebBuyer(shopDb, {
          phone: buyerPhone,
          email: buyerEmail,
          userId: buyerUserId,
        });

        const now = new Date();
        const quote = await evaluateGoodsPromotions(shopDb, {
          items,
          buyer: {
            phone: buyerPhone,
            email: buyerEmail,
            userId: buyerUserId,
            isNewWebBuyer,
            isWholesale,
          },
          customerKey: customerKeyFor(buyerUserId),
          promotions: await loadActivePromotions(shopDb, now),
          selectedCode,
          autoMode,
          now,
        });

        res.json({
          ok: true,
          quote,
        });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tính ưu đãi" });
      }
    }
  );
}
