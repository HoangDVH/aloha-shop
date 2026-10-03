import type { Express, Response } from "express";
import type { AuthRequest } from "../../auth/middleware.js";
import type { GetShopDb } from "../../shopAuth/routes.js";
import { applyShopCors } from "../../shopCors.js";
import type { CartItemToEvaluate, PromotionDoc } from "../types.js";
import { evaluatePromotions, evaluateShippingPromotions } from "../evaluator.js";
import { DEFAULT_SHIPPING_REGIONS, matchRegionById } from "../../shopShipping/shippingRegions.js";

export type AdminGate = Array<(...args: any[]) => any>;

function previewItems(itemsRaw: any[]): CartItemToEvaluate[] {
  return itemsRaw.map((it: any) => ({
    ma: String(it.ma || it.productCode || "").trim().toUpperCase(),
    ten: String(it.ten || it.productName || "").trim(),
    price: Math.max(0, Number(it.price ?? it.gia ?? 0) || 0),
    quantity: Math.max(1, Math.floor(Number(it.quantity ?? it.qty ?? 1) || 1)),
    categoryId: it.categoryId ? String(it.categoryId).trim() : undefined,
  }));
}

/** Chương trình giả lập từ cấu hình form (chưa lưu). */
function mockPromotion(cfg: Partial<PromotionDoc>): PromotionDoc {
  const nowIso = new Date().toISOString();
  return {
    id: cfg.id || "preview_promo",
    name: cfg.name || "Preview Promotion",
    title: cfg.title || "Preview Title",
    type: cfg.type || "auto",
    discountType: cfg.discountType || "percentage",
    discountValue: Number(cfg.discountValue) || 10,
    maxDiscountVnd: cfg.maxDiscountVnd ? Number(cfg.maxDiscountVnd) : undefined,
    minOrderThreshold: cfg.minOrderThreshold ? Number(cfg.minOrderThreshold) : undefined,
    thresholdOperator: cfg.thresholdOperator || ">",
    scope: cfg.scope || "all",
    categoryIds: cfg.categoryIds || [],
    productMas: cfg.productMas || [],
    excludedProductMas: cfg.excludedProductMas || [],
    targetCustomer: cfg.targetCustomer || "retail",
    startDate: cfg.startDate,
    endDate: cfg.endDate,
    usageLimitTotal: cfg.usageLimitTotal,
    budgetTotal: cfg.budgetTotal,
    budgetUsed: 0,
    budgetHeld: 0,
    usedCount: 0,
    heldCount: 0,
    status: "active",
    priority: 999,
    revision: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function previewShipping(
  mockPromo: PromotionDoc,
  cfg: Partial<PromotionDoc>,
  items: CartItemToEvaluate[],
  buyer: { isNewWebBuyer: boolean; isWholesale: boolean; phone?: string },
  ship: Record<string, any>
) {
  mockPromo.benefitType = "shipping";
  mockPromo.regionId = cfg.regionId;
  mockPromo.type = "auto";
  mockPromo.discountType = "fixed";
  mockPromo.usageLimitPerCustomer = undefined;
  mockPromo.budgetTotal = undefined;
  const shippingFee =
    ship.fee === null || ship.fee === undefined || ship.fee === ""
      ? null
      : Math.max(0, Number(ship.fee) || 0);
  return evaluateShippingPromotions({
    items,
    buyer,
    promotions: [mockPromo],
    deliveryMethod: ship.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi",
    shippingFee,
    freeShipApplied: Boolean(ship.freeShipApplied),
    matchRegion: (regionId) =>
      matchRegionById(DEFAULT_SHIPPING_REGIONS, regionId, {
        province: ship.province,
        district: ship.district,
        ghnDistrictId: Number(ship.ghnDistrictId) || undefined,
      }),
  });
}

/** POST /api/shop/admin/promotions/preview — Mô phỏng / kiểm thử tính tiền. */
export function registerPromotionPreviewRoute(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  app.post("/api/shop/admin/promotions/preview", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      await getShopDb();
      const b = req.body || {};
      const cfg: Partial<PromotionDoc> = b.promotion || {};
      const items = previewItems(Array.isArray(b.items) ? b.items : []);
      const mockPromo = mockPromotion(cfg);
      const buyer = {
        isNewWebBuyer: b.buyer?.isNewWebBuyer !== false,
        isWholesale: Boolean(b.buyer?.isWholesale),
        phone: b.buyer?.phone,
      };
      if (cfg.benefitType === "shipping") {
        const shipping = previewShipping(mockPromo, cfg, items, buyer, b.shipping || {});
        return res.json({ ok: true, shipping });
      }
      const quote = evaluatePromotions({ items, buyer, promotions: [mockPromo], autoMode: true });
      res.json({ ok: true, quote });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi mô phỏng ưu đãi" });
    }
  });
}
