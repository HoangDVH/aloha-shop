/**
 * Tính ưu đãi ở server cho báo giá ship và tạo đơn — hai nơi phải ra cùng kết quả
 * (docs/KE_HOACH_UU_DAI_VOUCHER.md mục 24.7.2). Không nhận số tiền giảm từ client.
 */
import type { Db } from "mongodb";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  PROMOTION_CUSTOMER_USAGE_COL,
  type BuyerContext,
  type CartItemToEvaluate,
  type PromotionCodeDoc,
  type PromotionDoc,
  type PromotionQuoteResult,
  type ShippingPromotionResult,
} from "./types.js";
import { evaluatePromotions, evaluateShippingPromotions, isShippingPromotion } from "./evaluator.js";
import { loadShippingRegions, matchRegionById } from "../shopShipping/shippingRegions.js";

/** Cờ tính năng voucher hỗ trợ phí ship; mặc định tắt. */
export function shipVoucherEnabled(): boolean {
  return process.env.SHOP_SHIP_VOUCHER_ENABLED === "1";
}

export function customerKeyFor(userId?: string | null): string | undefined {
  const id = String(userId || "").trim();
  return id ? `acc:${id}` : undefined;
}

export function customerUsageId(promotionId: string, customerKey: string): string {
  return `${promotionId}:${customerKey}`;
}

export async function loadActivePromotions(shopDb: Db, now: Date): Promise<PromotionDoc[]> {
  const nowIso = now.toISOString();
  return shopDb
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({
      status: "active",
      $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: nowIso } }],
      $and: [
        {
          $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: nowIso } }],
        },
      ],
    } as any)
    .toArray();
}

export async function evaluateGoodsPromotions(
  shopDb: Db,
  args: {
    items: CartItemToEvaluate[];
    buyer: BuyerContext;
    customerKey?: string;
    promotions: PromotionDoc[];
    selectedCode?: string;
    autoMode?: boolean;
    now: Date;
  }
): Promise<PromotionQuoteResult> {
  const selectedCode = String(args.selectedCode || "").trim().toUpperCase();
  const limited = args.promotions.filter(
    (p) => !isShippingPromotion(p) && Number(p.usageLimitPerCustomer) > 0
  );
  const [codes, customerUsage] = await Promise.all([
    selectedCode
      ? shopDb
          .collection<PromotionCodeDoc>(PROMOTION_CODES_COL)
          .find({ code: selectedCode, active: { $ne: false } } as any)
          .toArray()
      : Promise.resolve([] as PromotionCodeDoc[]),
    loadCustomerUsage(shopDb, args.customerKey, limited.map((p) => p.id)),
  ]);
  return evaluatePromotions({
    items: args.items,
    buyer: args.buyer,
    promotions: args.promotions,
    codes,
    selectedCode,
    autoMode: args.autoMode !== false,
    customerUsage,
    now: args.now,
  });
}

async function loadCustomerUsage(
  shopDb: Db,
  customerKey: string | undefined,
  promotionIds: string[]
): Promise<Record<string, number>> {
  if (!customerKey || !promotionIds.length) return {};
  const rows = await shopDb
    .collection<any>(PROMOTION_CUSTOMER_USAGE_COL)
    .find({ _id: { $in: promotionIds.map((id) => customerUsageId(id, customerKey)) } })
    .toArray();
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.promotionId)] = Math.max(0, Number(r.count) || 0);
  return out;
}

/** null khi cờ tắt hoặc không có chương trình ship nào đang chạy. */
export async function evaluateShippingForCheckout(
  shopDb: Db,
  mainDb: Db,
  args: {
    items: CartItemToEvaluate[];
    buyer: BuyerContext;
    customerKey?: string;
    promotions: PromotionDoc[];
    deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
    shippingFee: number | null;
    freeShipApplied: boolean;
    address: { province?: string; district?: string; ghnDistrictId?: number | null };
    now: Date;
  }
): Promise<ShippingPromotionResult | null> {
  if (!shipVoucherEnabled()) return null;
  const shipPromos = args.promotions.filter(isShippingPromotion);
  if (!shipPromos.length) return null;
  const [regions, customerUsage] = await Promise.all([
    loadShippingRegions(mainDb),
    loadCustomerUsage(shopDb, args.customerKey, shipPromos.map((p) => p.id)),
  ]);
  return evaluateShippingPromotions({
    items: args.items,
    buyer: args.buyer,
    promotions: shipPromos,
    deliveryMethod: args.deliveryMethod,
    shippingFee: args.shippingFee,
    freeShipApplied: args.freeShipApplied,
    customerUsage,
    now: args.now,
    matchRegion: (regionId) => matchRegionById(regions, regionId, args.address),
  });
}

/** Lý do hiển thị cho khách khi không có voucher ship nào được áp. */
export function shippingPromotionHint(result: ShippingPromotionResult | null): string | undefined {
  if (!result || result.applied) return undefined;
  if (result.pending) {
    return `Được hỗ trợ tối đa ${result.pending.maxDiscount.toLocaleString("vi-VN")}đ phí ship khi shop báo phí`;
  }
  return result.candidates.find((c) => !c.eligible && c.ineligibleReason)?.ineligibleReason;
}
