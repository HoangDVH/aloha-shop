export interface RedemptionLog {
  _id: string;
  orderCode: string;
  promotionId: string;
  discountAmount: number;
  status: "held" | "used" | "released";
  buyerPhone?: string;
  createdAt: string;
}

export interface ReportOverview {
  activePromotionsCount: number;
  totalDiscountGiven: number;
  totalOrdersUsingDiscount: number;
}

export interface AllCodeItem {
  code: string;
  promotionId: string;
  promotionName: string;
  promotionTitle?: string;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  maxDiscountVnd?: number;
  maxUses?: number;
  usedCount: number;
  heldCount: number;
  assignedBuyerPhone?: string;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}
