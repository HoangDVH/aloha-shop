import { applyCatalogPrices } from "../shopOrders/orderRouteShared.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import type { Express, Request, Response } from "express";
import { applyShopCors } from "../shopCors.js";
import { requireShopAuth, type GetShopDb, type ShopAuthRequest } from "../shopAuth/routes.js";
import type { GetMainDb } from "../shopOrders/routes.js";
import {
  listGhnDistricts,
  listGhnProvinces,
  listGhnWards,
} from "./locationCache.js";
import { getShippingQuote } from "./quoteService.js";
import { hashQuoteItems, signQuoteToken, type ShippingCarrier } from "./quoteToken.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { checkIsNewWebBuyer } from "../shopPromotions/customerEligibility.js";
import {
  customerKeyFor,
  evaluateGoodsPromotions,
  evaluateShippingForCheckout,
  shippingPromotionHint,
} from "../shopPromotions/checkoutPromotions.js";
import { loadBuyerPromotions } from "../shopPromotions/wallet/walletRules.js";
import { resolveGoodsShipCombo } from "../shopPromotions/combineShip.js";
import { quoteWithCampaign } from "../shopCampaigns/quoteCampaign.js";

function parseQuoteItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any) => ({
      productCode: String(it?.productCode || it?.ma || "").trim(),
      productName: String(it?.productName || it?.ten || it?.name || "").trim(),
      trongLuong: Math.max(0, Number(it?.trongLuong ?? it?.weightGram ?? 0) || 0),
      quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
      price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
    }))
    .filter((it) => it.productCode);
}

function locCors(req: Request, res: Response, next: () => void) {
  applyShopCors(req, res);
  next();
}

export function registerShopShippingRoutes(
  app: Express,
  _getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  const locOpts = ["/api/shop/shipping/locations/provinces", "/api/shop/shipping/locations/districts", "/api/shop/shipping/locations/wards"];
  for (const p of locOpts) {
    app.options(p, (req, res) => {
      applyShopCors(req, res);
      res.sendStatus(204);
    });
  }

  app.get("/api/shop/shipping/locations/provinces", locCors, async (_req, res) => {
    try {
      const items = await listGhnProvinces();
      return res.json({
        ok: true,
        source: "ghn",
        items: items.map((p) => ({ id: p.ProvinceID, name: p.ProvinceName })),
      });
    } catch (e: any) {
      return res.status(503).json({ ok: false, error: e?.message || "Chưa cấu hình GHN_TOKEN", items: [] });
    }
  });

  app.get("/api/shop/shipping/locations/districts", locCors, async (req, res) => {
    try {
      const provinceId = Number(req.query.provinceId || 0);
      if (!provinceId) return res.status(400).json({ error: "Thiếu provinceId" });
      const items = await listGhnDistricts(provinceId);
      return res.json({
        ok: true,
        items: items.map((d) => ({ id: d.DistrictID, provinceId: d.ProvinceID, name: d.DistrictName })),
      });
    } catch (e: any) {
      return res.status(503).json({ error: e?.message || "Lỗi tải quận/huyện" });
    }
  });

  app.get("/api/shop/shipping/locations/wards", locCors, async (req, res) => {
    try {
      const districtId = Number(req.query.districtId || 0);
      if (!districtId) return res.status(400).json({ error: "Thiếu districtId" });
      const items = await listGhnWards(districtId);
      return res.json({
        ok: true,
        items: items.map((w) => ({ code: w.WardCode, districtId: w.DistrictID, name: w.WardName })),
      });
    } catch (e: any) {
      return res.status(503).json({ error: e?.message || "Lỗi tải phường/xã" });
    }
  });

  app.options("/api/shop/shipping/quote", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  app.post(
    "/api/shop/shipping/quote",
    (req, res, next) => {
      applyShopCors(req, res);
      next();
    },
    requireShopAuth(_getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (!(await shopRateLimitOrReject(req, res, "shop_ship_quote", 40, 60_000))) {
          return;
        }
        const body = req.body || {};
        let items = parseQuoteItems(body.items || body.orderDetails);
        const buyer = await (await _getShopDb()).collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
        const priced = await applyCatalogPrices(await _getShopDb(), items, { account: buyer });
        if (!priced.ok) return res.status(400).json({ error: priced.error });
        items = items.map((item, i) => ({ ...item, price: priced.details[i].price }));
        const province = String(body.province || "").trim();
        const district = String(body.district || "").trim();
        const ward = String(body.ward || "").trim();
        const ghnDistrictId = Number(body.ghnDistrictId || 0) || undefined;
        const ghnWardCode = String(body.ghnWardCode || "").trim() || undefined;
        const deliveryMethod = body.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi";

        if (deliveryMethod === "nhan_cua_hang") {
          const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
          const now = new Date();
          const estimatedAt = now.toISOString();
          const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
          const itemsKey = hashQuoteItems(items);
          const quoteToken = signQuoteToken({
            carrier: null,
            fee: 0,
            subtotal,
            totalWeightGram: 0,
            province: "",
            district: "",
            ward: "",
            itemsKey,
            freeShipApplied: true,
            shippingEstimateStatus: "estimated",
            pricingSource: "shop_policy",
            packageDataSource: "verified_preset",
            estimatedShippingFee: 0,
          });
          return res.json({
            ok: true,
            subtotal,
            totalWeightGram: 0,
            freeShipApplied: true,
            freeShipMinVnd: 0,
            freeShipMaxUnitVnd: 0,
            quotes: [],
            cheapest: null,
            selected: null,
            quoteToken,
            shippingEstimateStatus: "estimated",
            estimatedShippingFee: 0,
            pricingSource: "shop_policy",
            packageDataSource: "verified_preset",
            estimatedAt,
            expiresAt,
          });
        }

        if (!items.length) {
          return res.status(400).json({ error: "Thiếu sản phẩm để báo giá ship" });
        }
        if (!province || !ward) {
          return res.status(400).json({ error: "Chọn đủ tỉnh, quận/huyện và phường/xã" });
        }

        const preferred =
          body.carrier === "ghtk" || body.carrier === "ghn" || body.carrier === "spx"
            ? (body.carrier as ShippingCarrier)
            : undefined;
        const db = await getMainDb();
        const shopDb = await _getShopDb();
        const now = new Date();
        const userId = req.shopAuth!.userId;
        const buyerPhone = String(body.customerPhone || buyer?.phone || "").trim();
        const buyerEmail = buyer?.email ? String(buyer.email) : "";
        // Cùng giá flash với lúc tạo đơn: voucher, ngưỡng hỗ trợ ship và miễn ship đều tính trên giá khách trả.
        const campaign = await quoteWithCampaign(
          shopDb,
          items.map((i) => ({ ma: i.productCode, ten: i.productName, price: i.price, quantity: i.quantity })),
          { accountId: userId, account: buyer, phone: buyerPhone, email: buyerEmail }
        );
        const evalItems = campaign.items;
        const buyerCtx = {
          phone: buyerPhone,
          email: buyerEmail,
          userId,
          isNewWebBuyer: await checkIsNewWebBuyer(shopDb, { phone: buyerPhone, email: buyerEmail, userId }),
          isWholesale: Boolean(req.shopAuth?.roles?.includes("si") || req.shopAuth?.roles?.includes("wholesale")),
        };
        const customerKey = customerKeyFor(userId);
        const selectedCode = String(body.promotionCode || "").trim().toUpperCase();
        const buyerPromos = await loadBuyerPromotions(shopDb, {
          now,
          accountId: userId,
          account: buyer,
          phone: buyerPhone,
          email: buyerEmail,
          selectedCode,
        });
        const promotions = buyerPromos.promotions;
        const evalGoods = (list: typeof promotions) =>
          evaluateGoodsPromotions(shopDb, {
            items: evalItems,
            buyer: buyerCtx,
            customerKey,
            promotions: list,
            selectedCode,
            autoMode: body.autoPromotion !== false,
            now,
          });
        const quoteFor = (discountTotal: number) =>
          getShippingQuote(db, {
            items,
            province,
            district,
            ward,
            ghnDistrictId,
            ghnWardCode,
            preferredCarrier: preferred,
            discountTotal: campaign.flashSavings + discountTotal,
            freeShipItems: campaign.lines,
          });
        const evalShip = (q: Awaited<ReturnType<typeof quoteFor>>) =>
          q.shippingEstimateStatus === "unavailable"
            ? Promise.resolve(null)
            : evaluateShippingForCheckout(shopDb, db, {
                items: evalItems,
                buyer: buyerCtx,
                customerKey,
                promotions,
                deliveryMethod,
                shippingFee: q.shippingEstimateStatus === "needs_confirmation" ? null : q.estimatedShippingFee,
                freeShipApplied: q.freeShipApplied,
                address: { province, district, ghnDistrictId },
                now,
              });
        const firstGoods = await evalGoods(promotions);
        let quote = await quoteFor(firstGoods.discountTotal);
        const combo = await resolveGoodsShipCombo({
          goods: firstGoods,
          ship: await evalShip(quote),
          promotions,
          manualCode: Boolean(selectedCode),
          reevaluateGoods: evalGoods,
        });
        const goods = combo.goods;
        let ship = combo.ship;
        if (goods !== firstGoods) {
          // Giảm hàng thay đổi → ngưỡng miễn ship có thể đổi; báo giá lại với số giảm mới.
          quote = await quoteFor(goods.discountTotal);
          ship = await evalShip(quote);
        }
        return res.json({
          ...quote,
          goodsDiscountTotal: goods.discountTotal,
          shippingDiscount: ship?.applied?.discountAmount || 0,
          shippingPromotion: ship?.applied
            ? {
                promotionId: ship.applied.promotionId,
                title: ship.applied.title,
                discountAmount: ship.applied.discountAmount,
              }
            : null,
          shippingPromotionHint: quote.freeShipApplied ? null : shippingPromotionHint(ship) || null,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Báo giá ship thất bại" });
      }
    }
  );
}
