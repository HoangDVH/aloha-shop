import dayjs from "dayjs";

export const SHIPPING_REGION_OPTIONS = [
  { value: "hcm_pre_2025", label: "TP.HCM (ranh giới trước 01/07/2025)" },
  { value: "toan_quoc", label: "Toàn quốc" },
];

export function shippingRegionLabel(regionId?: string): string {
  return SHIPPING_REGION_OPTIONS.find((r) => r.value === regionId)?.label || regionId || "—";
}

export const formatThousands = (v: unknown) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const parseThousands = (v: string | undefined) =>
  Number(String(v || "").replace(/[^\d.]/g, "")) || 0;

export interface PromotionItem {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: "auto" | "code";
  benefitType?: "goods" | "shipping";
  regionId?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ">" | ">=";
  scope: "all" | "category" | "product";
  categoryIds?: string[];
  productMas?: string[];
  excludedProductMas?: string[];
  targetCustomer: "all" | "retail" | "wholesale" | "new_web";
  startDate?: string;
  endDate?: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  budgetTotal?: number;
  budgetUsed?: number;
  budgetHeld?: number;
  usedCount?: number;
  heldCount?: number;
  status: "draft" | "active" | "paused" | "archived";
  isPublic?: boolean;
  priority?: number;
  revision?: number;
  combineWithShip?: boolean;
  excludeFlash?: boolean;
  claimRequired?: boolean;
  claimLimitTotal?: number | null;
  claimedCount?: number;
  claimStartDate?: string | null;
}

export type TimeMode = "range" | "unlimited";
export type CustomerMode = "all" | "specific";
export type PresetKey = "first10" | "bigOrder" | "coupon" | "shipHcm";

/** Giá trị form khi mở modal (sửa hoặc tạo mới). */
export function initialFormValues(editingItem?: PromotionItem | null) {
  if (!editingItem) {
    return {
      benefitType: "goods",
      regionId: SHIPPING_REGION_OPTIONS[0].value,
      name: "",
      code: "",
      discountValue: 10,
      discountType: "percentage",
      maxDiscountVnd: 200000,
      timeMode: "range",
      timeRange: [dayjs(), dayjs().add(6, "month")],
      status: "active",
      minOrderThreshold: 0,
      scope: "all",
      productMasText: "",
      excludedProductMasText: "",
      description: "",
      isAutoApply: true,
      allowStack: false,
      branchScope: "all",
      customerMode: "all",
      targetCustomer: "all",
      usageLimitTotal: undefined,
      usageLimitPerCustomer: undefined,
      budgetTotal: undefined,
      priority: 0,
      combineWithShip: true,
      excludeFlash: false,
      claimRequired: false,
      claimLimitTotal: undefined,
      claimStartDate: undefined,
    };
  }
  const hasDates = !!(editingItem.startDate && editingItem.endDate);
  const isSpecificCust = editingItem.targetCustomer && editingItem.targetCustomer !== "all";
  return {
    benefitType: editingItem.benefitType || "goods",
    regionId: editingItem.regionId || SHIPPING_REGION_OPTIONS[0].value,
    name: editingItem.name,
    code: editingItem.id || "",
    discountValue: editingItem.discountValue || 0,
    discountType: editingItem.discountType || "percentage",
    maxDiscountVnd: editingItem.maxDiscountVnd,
    timeMode: hasDates ? "range" : "unlimited",
    timeRange: hasDates
      ? [dayjs(editingItem.startDate), dayjs(editingItem.endDate)]
      : [dayjs(), dayjs().add(6, "month")],
    status: editingItem.status === "active" ? "active" : "draft",
    minOrderThreshold: editingItem.minOrderThreshold || 0,
    scope: editingItem.scope || "all",
    productMasText: editingItem.productMas?.join(", ") || "",
    excludedProductMasText: editingItem.excludedProductMas?.join(", ") || "",
    description: editingItem.description || "",
    isAutoApply: editingItem.type === "auto",
    allowStack: false,
    branchScope: "all",
    customerMode: isSpecificCust ? "specific" : "all",
    targetCustomer: editingItem.targetCustomer || "all",
    usageLimitTotal: editingItem.usageLimitTotal,
    usageLimitPerCustomer: editingItem.usageLimitPerCustomer,
    budgetTotal: editingItem.budgetTotal,
    priority: editingItem.priority || 0,
    combineWithShip: editingItem.combineWithShip !== false,
    excludeFlash: editingItem.excludeFlash === true,
    claimRequired: editingItem.claimRequired === true,
    claimLimitTotal: editingItem.claimLimitTotal || undefined,
    claimStartDate: editingItem.claimStartDate ? dayjs(editingItem.claimStartDate) : undefined,
  };
}

/** Giá trị điền sẵn cho từng mẫu gợi ý; kèm chế độ nhóm khách tương ứng. */
export function presetValues(preset: PresetKey): {
  values: Record<string, unknown>;
  customerMode: CustomerMode;
} {
  if (preset === "shipHcm") {
    return {
      customerMode: "all",
      values: {
        benefitType: "shipping",
        regionId: SHIPPING_REGION_OPTIONS[0].value,
        name: "Hỗ trợ phí ship nội thành TP.HCM 30k",
        discountType: "fixed",
        discountValue: 30000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 0,
        isAutoApply: true,
        customerMode: "all",
        targetCustomer: "all",
        usageLimitTotal: 100,
        usageLimitPerCustomer: 1,
        budgetTotal: undefined,
        description: "Tự động giảm tối đa 30.000đ phí giao hàng cho địa chỉ TP.HCM (ranh giới cũ)",
      },
    };
  }
  if (preset === "first10") {
    return {
      customerMode: "specific",
      values: {
        name: "Ưu đãi khách mới web 10%",
        discountType: "percentage",
        discountValue: 10,
        maxDiscountVnd: 200000,
        minOrderThreshold: 0,
        isAutoApply: true,
        customerMode: "specific",
        targetCustomer: "new_web",
        description: "Tự động áp dụng cho khách hàng chưa từng mua trên website",
      },
    };
  }
  if (preset === "bigOrder") {
    return {
      customerMode: "all",
      values: {
        name: "Ưu đãi đơn hàng trên 1 triệu (Giảm 100k)",
        discountType: "fixed",
        discountValue: 100000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 1000000,
        isAutoApply: true,
        customerMode: "all",
        targetCustomer: "retail",
        description: "Tự động giảm 100k khi tổng tiền hàng đạt từ 1.000.000đ",
      },
    };
  }
  return {
    customerMode: "all",
    values: {
      name: "Mã giảm giá chiến dịch 50k",
      discountType: "fixed",
      discountValue: 50000,
      maxDiscountVnd: undefined,
      minOrderThreshold: 300000,
      isAutoApply: false,
      customerMode: "all",
      targetCustomer: "all",
      description: "Khách nhập mã khuyến mại trong giỏ hàng hoặc xác nhận đơn hàng",
    },
  };
}

function splitMas(text: unknown): string[] {
  return String(text || "")
    .split(/[,;\s]+/)
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);
}

/** Dựng body gửi API từ giá trị form. */
export function buildPromotionPayload(
  values: any,
  customerMode: CustomerMode,
  editingItem?: PromotionItem | null
) {
  const isShipping = values.benefitType === "shipping";
  let startDate: string | undefined;
  let endDate: string | undefined;
  if (values.timeMode === "range" && values.timeRange) {
    startDate = values.timeRange[0]?.toISOString();
    endDate = values.timeRange[1]?.toISOString();
  }
  const specificTarget =
    values.targetCustomer && values.targetCustomer !== "all" ? values.targetCustomer : "retail";
  const targetCustomer = customerMode === "all" ? "all" : specificTarget;
  const discountType = isShipping ? "fixed" : values.discountType || "percentage";
  const optionalNumber = (v: unknown) => (v ? Number(v) : null);
  return {
    name: values.name,
    title: values.name,
    description: values.description,
    benefitType: isShipping ? "shipping" : "goods",
    regionId: isShipping ? values.regionId : undefined,
    type: isShipping || values.isAutoApply ? "auto" : "code",
    discountType,
    discountValue: Number(values.discountValue) || 0,
    maxDiscountVnd:
      discountType === "percentage" && values.maxDiscountVnd
        ? Number(values.maxDiscountVnd)
        : undefined,
    minOrderThreshold: Number(values.minOrderThreshold) || 0,
    thresholdOperator: ">=",
    scope: values.scope || "all",
    productMas: splitMas(values.productMasText),
    excludedProductMas: splitMas(values.excludedProductMasText),
    targetCustomer,
    startDate,
    endDate,
    usageLimitTotal: optionalNumber(values.usageLimitTotal),
    usageLimitPerCustomer: optionalNumber(values.usageLimitPerCustomer),
    budgetTotal: optionalNumber(values.budgetTotal),
    status: values.status || "active",
    priority: Number(values.priority) || 0,
    combineWithShip: isShipping ? undefined : values.combineWithShip !== false,
    excludeFlash: isShipping ? undefined : values.excludeFlash === true,
    claimRequired: values.claimRequired === true,
    claimLimitTotal: values.claimRequired ? Number(values.claimLimitTotal) || 0 : 0,
    claimStartDate: values.claimRequired && values.claimStartDate ? values.claimStartDate.toISOString() : null,
    revision: editingItem?.revision,
  };
}
