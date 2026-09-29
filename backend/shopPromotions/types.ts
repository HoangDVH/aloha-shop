export const PROMOTIONS_COL = "aloha_shop_promotions";
export const PROMOTION_CODES_COL = "aloha_shop_promotion_codes";
export const PROMOTION_REDEMPTIONS_COL = "aloha_shop_promotion_redemptions";
export const PROMOTION_AUDIT_COL = "aloha_shop_promotion_audit";
export const PROMOTION_CUSTOMER_USAGE_COL = "aloha_shop_promotion_customer_usage";

export type PromotionType = "auto" | "code";
export type PromotionBenefitType = "goods" | "shipping";
export type DiscountType = "percentage" | "fixed";
export type ThresholdOperator = ">" | ">=";
export type PromotionScope = "all" | "category" | "product";
export type TargetCustomer = "all" | "retail" | "wholesale" | "new_web";
export type PromotionStatus = "draft" | "active" | "paused" | "archived";

export interface PromotionDoc {
  id: string;
  name: string; // Tên nội bộ
  title: string; // Tiêu đề khách thấy (VD: "Giảm 10% cho khách mua lần đầu")
  description?: string;
  type: PromotionType; // "auto" (tự động) | "code" (cần nhập mã)
  benefitType?: PromotionBenefitType; // thiếu = "goods" (giảm tiền hàng); "shipping" = hỗ trợ phí ship
  regionId?: string; // Vùng giao hàng, bắt buộc với benefitType "shipping"
  discountType: DiscountType; // "percentage" | "fixed"
  discountValue: number; // % (1-100) hoặc số tiền VND
  maxDiscountVnd?: number; // Trần giảm tối đa (bắt buộc với %)
  minOrderThreshold?: number; // Ngưỡng giá trị đơn hàng
  thresholdOperator?: ThresholdOperator; // ">" (trên) hoặc ">=" (từ), default: ">"
  scope: PromotionScope; // "all" | "category" | "product"
  categoryIds?: string[];
  productMas?: string[];
  excludedProductMas?: string[];
  targetCustomer: TargetCustomer; // "all" | "retail" | "wholesale" | "new_web"
  startDate?: string; // ISO string UTC
  endDate?: string; // ISO string UTC
  usageLimitTotal?: number; // Tổng lượt tối đa của toàn chương trình
  usageLimitPerCustomer?: number; // Lượt tối đa cho mỗi khách
  budgetTotal?: number; // Ngân sách tối đa (VND)
  budgetUsed: number; // Ngân sách đã tiêu thụ (đơn thành công)
  budgetHeld: number; // Ngân sách đang giữ tạm thời (đơn mới tạo, chờ thanh toán)
  usedCount: number; // Lượt đã dùng
  heldCount: number; // Lượt đang giữ
  status: PromotionStatus; // "draft" | "active" | "paused" | "archived"
  isPublic?: boolean; // Hiển thị trong danh sách ưu đãi công khai
  combineWithShip?: boolean; // Cho phép kết hợp cùng chính sách miễn ship
  priority: number; // Độ ưu tiên khi chọn ưu đãi tự động tốt nhất (số càng cao ưu tiên càng lớn)
  revision: number; // Phiên bản sửa đổi để chống ghi đè đồng thời
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PromotionCodeDoc {
  code: string; // Mã uppercase unique, vd: "ALOHA10", "WELCOME80"
  promotionId: string;
  assignedBuyerPhone?: string; // Mã riêng cho khách chỉ định
  assignedBuyerEmail?: string;
  maxUses?: number; // 1 với mã dùng 1 lần, hoặc số lượng nhất định
  usedCount: number;
  heldCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

export interface PromotionRedemptionDoc {
  id: string;
  orderCode: string;
  promotionId: string;
  promotionCode?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerId?: string;
  customerKey?: string; // Khóa đếm lượt mỗi khách (PROMOTION_CUSTOMER_USAGE_COL)
  benefitType?: PromotionBenefitType;
  discountAmount: number;
  status: "held" | "used" | "released";
  idempotencyKey?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionAuditDoc {
  id: string;
  promotionId: string;
  action: string;
  actor: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface CartItemToEvaluate {
  ma: string;
  ten?: string;
  price: number;
  quantity: number;
  categoryId?: string;
  categorySlug?: string;
  nhom?: string;
}

export interface BuyerContext {
  userId?: string;
  phone?: string;
  email?: string;
  fullName?: string;
  isNewWebBuyer?: boolean;
  isWholesale?: boolean;
}

export interface EvaluatedCandidate {
  promotionId: string;
  title: string;
  type: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ThresholdOperator;
  eligible: boolean;
  ineligibleReason?: string;
  calculatedDiscount: number;
  code?: string;
  isPublic?: boolean;
  scope?: PromotionScope;
  targetCustomer?: TargetCustomer;
  endDate?: string;
  description?: string;
}

export interface PromotionQuoteResult {
  applied?: {
    promotionId: string;
    title: string;
    type: PromotionType;
    code?: string;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
  };
  lineDiscounts: Record<string, number>; // ma -> discount amount for that line
  subtotal: number;
  discountTotal: number;
  finalTotal: number;
  candidates: EvaluatedCandidate[];
}

export interface ShippingPromotionCandidate {
  promotionId: string;
  title: string;
  eligible: boolean;
  ineligibleReason?: string;
  calculatedDiscount: number;
  maxDiscount: number;
  minOrderThreshold?: number;
  thresholdOperator?: ThresholdOperator;
}

export interface ShippingPromotionResult {
  applied?: {
    promotionId: string;
    title: string;
    discountAmount: number;
    regionId: string;
    regionVersion: number;
    regionSource: "ghn_district" | "name";
  };
  /** Đủ điều kiện nhưng phí ship chưa có (chờ shop báo phí) — chưa trừ tiền, chưa giữ lượt. */
  pending?: { promotionId: string; title: string; maxDiscount: number };
  candidates: ShippingPromotionCandidate[];
}
