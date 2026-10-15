import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { isWholesaleAccount } from "../shopAuth/roles.js";
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
import { publicMystery } from "./mystery.js";
import { customerKeyFor, evaluateGoodsPromotions, shipVoucherEnabled } from "./checkoutPromotions.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { requestPromotionReview } from "./reviewService.js";
import { loadVoucherReturns, type VoucherReturn } from "./voucherHistory.js";
import { loadBuyerPromotions, withBuyerNotices } from "./wallet/walletRules.js";
import { applyCatalogPrices, parseOrderDetails } from "../shopOrders/orderRouteShared.js";
import { quoteWithCampaign } from "../shopCampaigns/quoteCampaign.js";
import { allowsWholesaleShipping, isWholesaleTinh, isWholesaleHcm } from "./tinhShipping.js";
import { voucherMatchesBuyer } from "../../shared/voucherAudience.js";
import { z } from "zod";
import { loadActivePromotions } from "./checkoutPromotions.js";
import { getCurrentCampaign } from "../shopCampaigns/currentCampaign.js";
import { campaignEnabled, voucherWalletEnabled } from "../shopCampaigns/flags.js";
import { buildPublicSharePreview } from "./publicSharePreview.js";

/**
 * Giá tính ưu đãi luôn lấy từ catalog (giá client gửi lên bị bỏ qua).
 * Sản phẩm không còn trong catalog bị loại khỏi báo giá thay vì làm hỏng cả giỏ.
 */
export async function withServerPrices(
  shopDb: Db,
  items: CartItemToEvaluate[],
  account: Record<string, unknown> | null
): Promise<CartItemToEvaluate[]> {
  const valid = items.filter((it) => it.ma);
  const price = (list: CartItemToEvaluate[]) =>
    applyCatalogPrices(
      shopDb,
      parseOrderDetails(list.map((it) => ({ productCode: it.ma, quantity: it.quantity }))),
      { account, quoteOnly: true }
    );
  if (!valid.length) return [];
  const all = await price(valid);
  if (all.ok) return valid.map((it, i) => ({ ...it, ma: all.details[i].productCode, price: all.details[i].price, categoryId: all.details[i].categoryId, volumePricing: all.details[i].volumePricing }));
  const out: CartItemToEvaluate[] = [];
  for (const it of valid) {
    const one = await price([it]);
    if (one.ok && one.details[0]) out.push({ ...it, ma: one.details[0].productCode, price: one.details[0].price, categoryId: one.details[0].categoryId, volumePricing: one.details[0].volumePricing });
  }
  return out;
}

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
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const shopDb = await getShopDb();
      const nowIso = new Date().toISOString();
      let account: any = null;
      try {
        const token = req.cookies?.[ACCESS_COOKIE] || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
        if (token) {
          const payload = verifyShopAccessToken(token);
          const row = await shopDb.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(payload.sub));
          if (row?.active !== false && Number(payload.iat || 0) >= Number(row?.authInvalidBefore || 0)) account = row;
        }
      } catch { /* Optional authentication. */ }
      const buyerPromos = await loadBuyerPromotions(shopDb, { now: new Date(), account,
        accountId: account?._id ? String(account._id) : undefined, phone: account?.phone, email: account?.email });
      const allowed = new Set(buyerPromos.promotions.map(p => p.id));
      const claimable = new Set(buyerPromos.notices.filter(p => p.needsClaim).map(p => p.promotionId));
      const wholesale = isWholesaleAccount(account);

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
        viewer: { newBuyer: buyerPromos.buyerContext?.newBuyer },
        items: visible.filter(p => voucherMatchesBuyer(p.targetCustomer, buyerPromos.buyerContext)).map((p) => ({
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
          claimRequired: p.claimRequired === true,
          audienceEligible: (allowed.has(p.id) || claimable.has(p.id)) && !(p.targetCustomer === "retail" && wholesale && !allowsWholesaleShipping(p, account)) && !(p.targetCustomer === "wholesale" && !wholesale),
          ineligibleReason: buyerPromos.notices.find(n => n.promotionId === p.id && !n.needsClaim)?.ineligibleReason,
          scope: p.scope || "all",
          categoryIds: p.categoryIds,
          productMas: p.productMas,
          excludedProductMas: p.excludedProductMas,
          excludeFlash: p.excludeFlash === true,
          startDate: p.startDate,
          endDate: p.endDate,
          ...(p.mystery ? { mystery: publicMystery(p) } : {}),
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
        if (!(await shopRateLimitOrReject(req as any, res as any, "shop_promo_quote", 60, 60_000))) {
          return;
        }
        const shopDb = await getShopDb();
        const body = req.body || {};
        if (body.sharePreview === true) {
          res.setHeader("Cache-Control", "private, no-store");
          const parsed = z.object({ items: z.array(z.object({ ma: z.string().trim().min(1).max(100) })).length(1) }).safeParse(body);
          if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid share product" });
          const now = new Date();
          const items = await withServerPrices(shopDb, [{ ma: parsed.data.items[0].ma.toUpperCase(), price: 0, quantity: 1 }], null);
          if (!items.length) return res.status(404).json({ ok: false, error: "Product unavailable" });
          const [campaign, promotions, state] = await Promise.all([
            quoteWithCampaign(shopDb, items, {}), loadActivePromotions(shopDb, now),
            campaignEnabled() ? getCurrentCampaign(shopDb, now.getTime(), { isTestBuyer: false }) : Promise.resolve({ active: null }),
          ]);
          return res.json({ ok: true, preview: buildPublicSharePreview(campaign, promotions, state.active, voucherWalletEnabled(), now) });
        }
        const itemsRaw = Array.isArray(body.items) ? body.items : [];
        const selectedCode = String(body.selectedCode || "").trim().toUpperCase();
        const autoMode = body.autoMode !== false;

        const clientItems: CartItemToEvaluate[] = itemsRaw.map((it: any) => ({
          ma: String(it.ma || it.productCode || "").trim().toUpperCase(),
          ten: String(it.ten || it.productName || "").trim(),
          price: 0,
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
        const isWholesale = isWholesaleAccount(userAccount);

        // Kiểm tra điều kiện khách mới mua lần đầu trên web

        const now = new Date();
        const items = await withServerPrices(shopDb, clientItems, userAccount);
        const campaign = await quoteWithCampaign(shopDb, items, {
          accountId: buyerUserId,
          account: userAccount,
          phone: buyerPhone,
          email: buyerEmail,
        });
        const buyerPromos = await loadBuyerPromotions(shopDb, {
          now,
          accountId: buyerUserId,
          account: userAccount,
          phone: buyerPhone,
          email: buyerEmail,
          selectedCode,
        });
        const quote = await evaluateGoodsPromotions(shopDb, {
          items: campaign.items,
          buyer: {
            phone: buyerPhone,
            email: buyerEmail,
            userId: buyerUserId,
            ...buyerPromos.buyerContext,
            isWholesale,
            isWholesaleTinh: isWholesaleTinh(userAccount),
          isWholesaleHcm: isWholesaleHcm(userAccount),
          },
          customerKey: customerKeyFor(buyerUserId),
          promotions: buyerPromos.promotions,
          selectedCode,
          autoMode,
          now,
        });

        const returns = await loadVoucherReturns(shopDb, customerKeyFor(buyerUserId)).catch(
          () => new Map<string, VoucherReturn>()
        );
        const noticed = withBuyerNotices(quote, buyerPromos, selectedCode);
        res.json({
          ok: true,
          quote: returns.size
            ? {
                ...noticed,
                candidates: noticed.candidates.map((c) => {
                  const r = c.eligible ? returns.get(c.promotionId) : undefined;
                  return r ? { ...c, returnedFrom: { orderCode: r.orderCode, reason: r.reason } } : c;
                }),
              }
            : noticed,
          prices: Object.fromEntries(items.map((it) => [it.ma, it.price])),
          lines: campaign.lines,
          flashSavings: campaign.flashSavings,
          volumeSavings: campaign.volumeSavings,
          anchorSavings: campaign.anchorSavings,
          campaignNotices: campaign.notices,
        });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tính ưu đãi" });
      }
    }
  );

  // POST /api/shop/promotions/review/request — Khách hàng gửi yêu cầu xem xét lại ưu đãi (mục 8, 9, 10)
  app.post(
    "/api/shop/promotions/review/request",
    async (req: Request, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const body = req.body || {};
        const orderId = String(body.orderId || "").trim();
        const accountId = String(body.accountId || "").trim();
        const buyerPhone = String(body.buyerPhone || "").trim();
        const reason = String(body.reason || "").trim();

        if (!orderId || !accountId || !buyerPhone) {
          return res.status(400).json({ ok: false, error: "Thiếu thông tin đơn hàng hoặc số điện thoại" });
        }

        const result = await requestPromotionReview(shopDb, {
          orderId,
          accountId,
          buyerPhone,
          reason,
        });

        if (!result.ok) {
          return res.status((result as any).code === "rate_limited" ? 429 : 400).json(result);
        }

        res.json(result);
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi gửi yêu cầu xem xét" });
      }
    }
  );
}
