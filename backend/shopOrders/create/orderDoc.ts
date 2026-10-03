import type { ShopOrderDetail } from "../models.js";
import type { VerifiedQuote } from "./shippingQuoteCheck.js";
import type { CampaignHolds } from "../../shopCampaigns/flash/flashTypes.js";

export type OrderDocInput = {
  code: string;
  accountId: string;
  user: any;
  isTest: boolean;
  addressId: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  province: string;
  district: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  shippingAddress: string;
  orderDetails: ShopOrderDetail[];
  ctvCodes: string[];
  subtotal: number;
  discount: number;
  total: number;
  shippingFeeCharged: number;
  shippingFeeOriginal: number;
  shippingDiscount: number;
  shippingPromotion: any;
  shippingPromotionPending: unknown;
  shippingCarrier?: string;
  freeShipApplied: boolean;
  totalWeightGram: number;
  quoteToken: string;
  quoteVerified: VerifiedQuote | null;
  appliedPromotion: unknown;
  method: string;
  usingCod: boolean;
  hasPreOrder: boolean;
  customerNoteStored: string;
  reviewFirst: boolean;
  isTransfer: boolean;
  reviewKvDescription: string;
  paymentCode?: string;
  idempotencyKey: string;
  bodyHash: string;
  expiresAt?: Date;
  now: string;
  campaignHolds?: CampaignHolds | null;
  flashSavings?: number;
  anchorSavings?: number;
};

function shippingEstimateFor(input: OrderDocInput) {
  const { deliveryMethod, quoteVerified, now } = input;
  if (deliveryMethod === "nhan_cua_hang") {
    return {
      status: "estimated",
      estimatedFee: 0,
      pricingSource: "shop_policy",
      packageDataSource: "verified_preset",
      estimatedAt: now,
    };
  }
  if (quoteVerified) {
    return {
      status: quoteVerified.shippingEstimateStatus || "estimated",
      estimatedFee: quoteVerified.estimatedShippingFee ?? quoteVerified.fee ?? null,
      pricingSource:
        quoteVerified.pricingSource ||
        (quoteVerified.freeShipApplied ? "shop_policy" : "carrier_api"),
      packageDataSource: quoteVerified.packageDataSource || "inferred",
      estimatedAt: now,
    };
  }
  return {
    status: "needs_confirmation",
    estimatedFee: null,
    pricingSource: "shop_policy",
    packageDataSource: "unknown",
    estimatedAt: now,
  };
}

function shippingPromotionSnapshot(input: OrderDocInput) {
  const p = input.shippingPromotion;
  if (!p) return null;
  return {
    promotionId: p.promotionId,
    title: p.title,
    discountAmount: input.shippingDiscount,
    regionId: p.regionId,
    regionVersion: p.regionVersion,
    regionSource: p.regionSource,
    thresholdBasis: "goods_before_order_discount",
  };
}

function statusFields(input: OrderDocInput) {
  const { reviewFirst, isTransfer, usingCod, method, total } = input;
  const unpaidAtStart = reviewFirst || isTransfer || usingCod;
  return {
    totalPayment: unpaidAtStart ? 0 : total,
    paidAmount: unpaidAtStart ? 0 : total,
    remainingAmount: unpaidAtStart ? total : 0,
    method: reviewFirst ? "Pending" : method,
    usingCod: reviewFirst || isTransfer ? false : usingCod,
    paymentStatus: reviewFirst || isTransfer ? "unpaid" : "cod",
    orderStatus: reviewFirst ? "cho_xac_nhan" : isTransfer ? "cho_thanh_toan" : "cho_xu_ly",
    status: reviewFirst ? "cho_xac_nhan" : isTransfer ? "cho_thanh_toan" : "cho",
    statusValue: reviewFirst ? "Chờ Aloha gửi ảnh" : isTransfer ? "Chờ thanh toán" : "Đặt hàng",
  };
}

/** Dựng bản ghi đơn lưu vào aloha_shop_orders. */
export function buildOrderDoc(input: OrderDocInput): Record<string, unknown> {
  const { user, deliveryMethod, now } = input;
  const ship = deliveryMethod === "giao_tan_noi";
  const isSi = user?.siStatus === "active" && user?.roles?.includes("si");
  const status = statusFields(input);
  return {
    id: input.code,
    code: input.code,
    revision: 0,
    kvOrderId: null,
    kvOrderCode: null,
    kvInvoiceId: null,
    kvInvoiceCode: null,
    kvPushError: null,
    isTest: input.isTest,
    shopAccountId: input.accountId,
    kvCustomerId: user?.kvCustomerId || null,
    kvPushStatus: isSi ? "queued" : undefined,
    priceMode: isSi ? "si" : "web",
    siRegion: user?.siRegion || null,
    addressId: input.addressId || null,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: user?.email ? String(user.email) : null,
    deliveryMethod,
    province: ship ? input.province : "",
    district: ship ? input.district : "",
    ward: ship ? input.ward : "",
    ghnDistrictId: ship ? input.ghnDistrictId || null : null,
    ghnWardCode: ship ? input.ghnWardCode || null : null,
    shippingAddress: ship ? input.shippingAddress : "",
    orderDetails: input.orderDetails,
    ctvCodes: input.ctvCodes,
    subtotal: input.subtotal,
    shippingFee: input.shippingFeeCharged,
    shippingFeeOriginal: input.shippingFeeOriginal,
    shippingDiscount: input.shippingDiscount,
    shippingPromotion: shippingPromotionSnapshot(input),
    shippingPromotionPending: input.shippingPromotionPending || null,
    freeShipThresholdBasis: "goods_after_discount",
    shippingCarrier: input.shippingCarrier || null,
    freeShipApplied: input.freeShipApplied,
    totalWeightGram: ship ? input.totalWeightGram : 0,
    quoteToken: ship ? input.quoteToken : null,
    shipment: ship ? { status: "pending", carrier: input.shippingCarrier || null } : null,
    total: input.total,
    totalPayment: status.totalPayment,
    paidAmount: status.paidAmount,
    remainingAmount: status.remainingAmount,
    discount: input.discount,
    shippingEstimate: shippingEstimateFor(input),
    promotion: input.appliedPromotion || null,
    method: status.method,
    usingCod: status.usingCod,
    hasPreOrder: input.hasPreOrder,
    customerNote: input.customerNoteStored,
    paymentStatus: status.paymentStatus,
    orderStatus: status.orderStatus,
    ...(input.reviewFirst
      ? { policyAcceptedAt: now, reviewNote: input.reviewKvDescription }
      : {}),
    ...(input.paymentCode ? { paymentCode: input.paymentCode } : {}),
    ...(input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey, bodyHash: input.bodyHash }
      : {}),
    expiresAt: input.expiresAt || null,
    ...(input.campaignHolds ? { campaignHolds: input.campaignHolds } : {}),
    ...(input.flashSavings > 0 ? { flashSavings: input.flashSavings } : {}),
    ...(input.anchorSavings > 0 ? { anchorSavings: input.anchorSavings } : {}),
    stockApplied: false,
    stockHeld: false,
    status: status.status,
    statusValue: status.statusValue,
    done: false,
    purchaseDate: now,
    source: "shop_web",
    createdAt: now,
    updatedAt: now,
  };
}
