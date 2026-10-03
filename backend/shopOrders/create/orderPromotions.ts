import type { StepFail } from "./stepResult.js";
import type { Db } from "mongodb";
import { qualifiesFreeShip } from "../../shopShipping/freeShip.js";
import { checkIsNewWebBuyer } from "../../shopPromotions/customerEligibility.js";
import {
  customerKeyFor,
  evaluateGoodsPromotions,
  evaluateShippingForCheckout,
} from "../../shopPromotions/checkoutPromotions.js";
import { loadBuyerPromotions } from "../../shopPromotions/wallet/walletRules.js";
import { resolveGoodsShipCombo } from "../../shopPromotions/combineShip.js";
import type { ShopOrderDetail } from "../models.js";
import type { ShippingQuoteResult } from "./shippingQuoteCheck.js";

type QuoteOk = Extract<ShippingQuoteResult, { ok: true }>;

/** Giảm theo mã → từng dòng; mã có dòng flash + dòng giá thường chia theo tiền dòng, quà luôn 0. */
export function splitLineDiscounts(details: ShopOrderDetail[], byMa: Record<string, number>): void {
  const groups = new Map<string, ShopOrderDetail[]>();
  for (const d of details) {
    d.discount = 0;
    if (d.isGift) continue;
    groups.set(d.productCode, [...(groups.get(d.productCode) || []), d]);
  }
  for (const [ma, lines] of groups) {
    let left = byMa[ma] || 0;
    const total = lines.reduce((n, d) => n + d.price * d.quantity, 0);
    lines.forEach((d, i) => {
      const share = i === lines.length - 1 || total <= 0 ? left : Math.floor(((byMa[ma] || 0) * d.price * d.quantity) / total);
      d.discount = share;
      left -= share;
    });
  }
}

export type OrderPromotionInput = {
  body: any;
  accountId?: string;
  roles?: string[];
  customerPhone: string;
  buyerEmail: string;
  deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
  orderDetails: ShopOrderDetail[];
  subtotal: number;
  quote: QuoteOk;
  address: { province: string; district: string; ghnDistrictId?: number };
};

export type OrderPromotionResult =
  | {
      ok: true;
      customerKey: string;
      discount: number;
      appliedPromotion: any;
      shippingPromotion: any;
      shippingPending: unknown;
      shippingDiscount: number;
      shippingFeeOriginal: number;
      shippingFeeCharged: number;
      isNewWebPromo: boolean;
    }
  | StepFail;

/** Tính lại ưu đãi hàng + hỗ trợ ship ở server; ghi phân bổ giảm giá vào từng dòng. */
export async function evaluateOrderPromotions(
  shopDb: Db,
  mainDb: Db,
  input: OrderPromotionInput
): Promise<OrderPromotionResult> {
  const { body, orderDetails, subtotal, quote, deliveryMethod } = input;
  const now = new Date();
  const requestedCode = String(body.promotionCode || "").trim().toUpperCase();
  const autoMode = body.autoPromotion !== false;
  const isNewWeb = await checkIsNewWebBuyer(shopDb, {
    phone: input.customerPhone,
    email: input.buyerEmail,
    userId: input.accountId,
  });
  const buyerPromos = await loadBuyerPromotions(shopDb, {
    now,
    accountId: input.accountId,
    phone: input.customerPhone,
    email: input.buyerEmail,
    selectedCode: requestedCode,
  });
  const activePromos = buyerPromos.promotions;
  const evalItems = orderDetails
    .filter((d) => !d.isGift)
    .map((d) => ({
      ma: d.productCode,
      ten: d.productName,
      price: d.price,
      quantity: d.quantity,
      flash: Boolean(d.flash),
    }));
  const buyer = {
    phone: input.customerPhone,
    email: input.buyerEmail,
    userId: input.accountId,
    isNewWebBuyer: isNewWeb,
    isWholesale: Boolean(input.roles?.includes("si") || input.roles?.includes("wholesale")),
  };
  const customerKey = customerKeyFor(input.accountId);
  const evalGoods = (promotions: typeof activePromos) =>
    evaluateGoodsPromotions(shopDb, {
      items: evalItems,
      buyer,
      customerKey,
      promotions,
      selectedCode: requestedCode,
      autoMode,
      now,
    });
  const firstGoods = await evalGoods(activePromos);

  const verified = quote.quoteVerified;
  const shippingFee = quote.shippingFee;
  const shipEval = await evaluateShippingForCheckout(shopDb, mainDb, {
    items: evalItems,
    buyer,
    customerKey,
    promotions: activePromos,
    deliveryMethod,
    shippingFee:
      deliveryMethod === "nhan_cua_hang" ? 0 : verified && verified.fee != null ? shippingFee : null,
    freeShipApplied: quote.freeShipApplied,
    address: input.address,
    now,
  });
  const combo = await resolveGoodsShipCombo({
    goods: firstGoods,
    ship: shipEval,
    promotions: activePromos,
    manualCode: Boolean(requestedCode),
    reevaluateGoods: evalGoods,
  });
  const promoQuote = combo.goods;
  const shipPromoEval = combo.ship;
  const discount = promoQuote.discountTotal || 0;
  const appliedPromotion = promoQuote.applied;
  splitLineDiscounts(orderDetails, promoQuote.lineDiscounts);

  // Miễn ship xét trên tiền hàng sau giảm, cùng cơ sở với báo giá (mục 24.7.2)
  if (verified && verified.fee != null) {
    const stillFree = qualifiesFreeShip(
      Math.max(0, subtotal - discount),
      orderDetails.map((d) => ({ productCode: d.productCode, quantity: d.quantity, price: d.price }))
    );
    if (Boolean(verified.freeShipApplied) !== stillFree) {
      return {
        ok: false,
        status: 409,
        body: {
          code: "quote_stale",
          error: stillFree
            ? "Đơn đã đủ điều kiện miễn ship — báo giá ship lại"
            : "Đơn không còn đủ điều kiện freeship — báo giá ship lại",
        },
      };
    }
  }

  const shippingPromotion = shipPromoEval?.applied || null;
  const shippingDiscount = Math.min(shippingFee, shippingPromotion?.discountAmount || 0);

  const isNewWebPromo =
    (appliedPromotion as any)?.targetCustomer === "new_web" ||
    (shippingPromotion as any)?.targetCustomer === "new_web" ||
    activePromos.find((p) => p.id === appliedPromotion?.promotionId)?.targetCustomer === "new_web" ||
    activePromos.find((p) => p.id === shippingPromotion?.promotionId)?.targetCustomer === "new_web";

  return {
    ok: true,
    customerKey,
    discount,
    appliedPromotion,
    shippingPromotion,
    shippingPending: shipPromoEval?.pending || null,
    shippingDiscount,
    // shippingFee lưu/đẩy KiotViet = phí khách trả sau hỗ trợ ship (mục 24.7.4); phí gốc lưu riêng.
    shippingFeeOriginal: shippingFee,
    shippingFeeCharged: Math.max(0, shippingFee - shippingDiscount),
    isNewWebPromo,
  };
}
