import type { PromotionDoc } from "../types.js";

export function newId(prefix = "pro"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TARGET_CUSTOMERS = ["all", "wholesale", "new_web", "retail"];

type Body = Record<string, any>;
type PayloadResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export function isPayloadFail<T>(
  r: PayloadResult<T>
): r is { ok: false; status: number; error: string } {
  return r.ok === false;
}

const upperMas = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((m: any) => String(m).trim().toUpperCase()) : [];

const targetCustomerOf = (v: unknown): PromotionDoc["targetCustomer"] =>
  (TARGET_CUSTOMERS.includes(v as string) ? v : "retail") as PromotionDoc["targetCustomer"];

const isoOrUndefined = (v: unknown): string | undefined =>
  v ? new Date(v as string).toISOString() : undefined;

/** Voucher ship: tự áp dụng, giảm VND cố định, bắt buộc vùng và tổng lượt (mục 24.4). */
export function shippingPromotionError(doc: Partial<PromotionDoc>): string | null {
  if (doc.benefitType !== "shipping") return null;
  if (!/^[a-z0-9_]{2,40}$/.test(String(doc.regionId || ""))) return "Chọn vùng áp dụng cho voucher ship";
  if (!(Number(doc.usageLimitTotal) >= 1)) return "Voucher ship bắt buộc nhập tổng lượt";
  if (!(Number(doc.discountValue) > 0)) return "Mệnh giá hỗ trợ ship phải lớn hơn 0";
  return null;
}

export function applyShippingPromotionDefaults(doc: Partial<PromotionDoc>): Partial<PromotionDoc> {
  if (doc.benefitType !== "shipping") return {};
  const budgetTotal =
    doc.budgetTotal != null && doc.budgetTotal > 0
      ? doc.budgetTotal
      : Math.round(Number(doc.usageLimitTotal) * Number(doc.discountValue));
  return { type: "auto", discountType: "fixed", maxDiscountVnd: undefined, budgetTotal };
}

/** "Khách phải bấm Lưu mã": tổng lượt lưu (0 = không giới hạn) và giờ mở lưu. */
function claimFieldsOf(b: Body): Partial<PromotionDoc> {
  const out: Partial<PromotionDoc> = {};
  if (b.claimRequired !== undefined) out.claimRequired = b.claimRequired === true;
  if (b.claimLimitTotal !== undefined) {
    const n = Math.floor(Number(b.claimLimitTotal) || 0);
    out.claimLimitTotal = n > 0 ? n : null;
  }
  if (b.claimStartDate !== undefined) out.claimStartDate = isoOrUndefined(b.claimStartDate) || null;
  return out;
}

function claimFieldsError(doc: Partial<PromotionDoc>): string | null {
  if (doc.claimStartDate && doc.endDate && doc.claimStartDate > doc.endDate) {
    return "Giờ mở lưu mã phải trước ngày kết thúc voucher";
  }
  return null;
}

/** Trường quyết định giá trị voucher — khoá khi đã có khách lưu để khách không bị đổi điều kiện. */
const LOCKED_WHEN_CLAIMED = [
  "discountType",
  "discountValue",
  "maxDiscountVnd",
  "minOrderThreshold",
  "thresholdOperator",
  "targetCustomer",
  "benefitType",
] as const;

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === null || v === "" ? null : v);
  return norm(a) === norm(b);
}

export function claimedEditError(existing: PromotionDoc, set: Partial<PromotionDoc>): string | null {
  const claimed = Number(existing.claimedCount) || 0;
  if (claimed <= 0) return null;
  const limit = set.claimLimitTotal;
  if (limit != null && limit > 0 && limit < claimed) {
    return `Đã có ${claimed} khách lưu voucher này, tổng lượt lưu không được nhỏ hơn ${claimed}.`;
  }
  const changed = LOCKED_WHEN_CLAIMED.filter(
    (k) => k in set && !sameValue(set[k], existing[k])
  );
  if (!changed.length) return null;
  return `Đã có ${claimed} khách lưu voucher này nên không sửa được giá trị và điều kiện. Hãy nhân bản thành voucher mới.`;
}

/** Dựng chương trình mới từ body admin; lỗi nhập liệu trả về status 400. */
export function buildNewPromotion(
  b: Body,
  actor: string,
  nowIso: string
): PayloadResult<PromotionDoc> {
  const name = String(b.name || "").trim();
  const title = String(b.title || name).trim();
  if (!name) return { ok: false, status: 400, error: "Vui lòng nhập tên chương trình" };

  const discountValue = Number(b.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { ok: false, status: 400, error: "Giá trị giảm giá phải lớn hơn 0" };
  }
  const discountType =
    b.benefitType === "shipping" || b.discountType === "fixed" ? "fixed" : "percentage";
  if (discountType === "percentage" && discountValue > 100) {
    return { ok: false, status: 400, error: "Giảm theo % không được quá 100%" };
  }

  const doc: PromotionDoc = {
    id: newId("pro"),
    name,
    title,
    description: b.description ? String(b.description).trim() : "",
    type: b.type === "code" ? "code" : "auto",
    benefitType: b.benefitType === "shipping" ? "shipping" : "goods",
    regionId: b.benefitType === "shipping" ? String(b.regionId || "").trim() : undefined,
    discountType,
    discountValue,
    maxDiscountVnd: b.maxDiscountVnd ? Math.max(0, Number(b.maxDiscountVnd)) : undefined,
    minOrderThreshold: b.minOrderThreshold ? Math.max(0, Number(b.minOrderThreshold)) : undefined,
    thresholdOperator: b.thresholdOperator === ">=" ? ">=" : ">",
    scope: ["category", "product"].includes(b.scope) ? b.scope : "all",
    categoryIds: Array.isArray(b.categoryIds) ? b.categoryIds.map(String) : [],
    productMas: upperMas(b.productMas),
    excludedProductMas: upperMas(b.excludedProductMas),
    targetCustomer: targetCustomerOf(b.targetCustomer),
    startDate: isoOrUndefined(b.startDate),
    endDate: isoOrUndefined(b.endDate),
    usageLimitTotal: b.usageLimitTotal ? Math.max(1, Number(b.usageLimitTotal)) : undefined,
    usageLimitPerCustomer: b.usageLimitPerCustomer ? Math.max(1, Number(b.usageLimitPerCustomer)) : undefined,
    budgetTotal: b.budgetTotal ? Math.max(0, Number(b.budgetTotal)) : undefined,
    budgetUsed: 0,
    budgetHeld: 0,
    usedCount: 0,
    heldCount: 0,
    status: ["active", "paused"].includes(b.status) ? b.status : "draft",
    isPublic: b.isPublic !== false,
    combineWithShip: b.combineWithShip !== false,
    excludeFlash: b.excludeFlash === true,
    ...claimFieldsOf(b),
    claimedCount: 0,
    priority: Number(b.priority) || 0,
    revision: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: actor,
  };

  const shipErr = shippingPromotionError(doc) || claimFieldsError(doc);
  if (shipErr) return { ok: false, status: 400, error: shipErr };
  Object.assign(doc, applyShippingPromotionDefaults(doc));
  return { ok: true, value: doc };
}

function applyBasicFields(b: Body, set: Partial<PromotionDoc>): void {
  if (b.name !== undefined) set.name = String(b.name).trim();
  if (b.title !== undefined) set.title = String(b.title).trim();
  if (b.description !== undefined) set.description = String(b.description).trim();
  if (b.type !== undefined) set.type = b.type === "code" ? "code" : "auto";
  if (b.discountType !== undefined) {
    set.discountType = b.discountType === "fixed" ? "fixed" : "percentage";
  }
  if (b.discountValue !== undefined) {
    const val = Number(b.discountValue);
    if (val > 0) set.discountValue = val;
  }
  if (b.maxDiscountVnd !== undefined) {
    set.maxDiscountVnd = b.maxDiscountVnd ? Math.max(0, Number(b.maxDiscountVnd)) : undefined;
  }
  if (b.minOrderThreshold !== undefined) {
    set.minOrderThreshold = b.minOrderThreshold ? Math.max(0, Number(b.minOrderThreshold)) : undefined;
  }
  if (b.thresholdOperator !== undefined) {
    set.thresholdOperator = b.thresholdOperator === ">=" ? ">=" : ">";
  }
}

function applyScopeFields(b: Body, set: Partial<PromotionDoc>): void {
  if (b.scope !== undefined) {
    set.scope = ["category", "product"].includes(b.scope) ? b.scope : "all";
  }
  if (b.categoryIds !== undefined) {
    set.categoryIds = Array.isArray(b.categoryIds) ? b.categoryIds.map(String) : [];
  }
  if (b.productMas !== undefined) set.productMas = upperMas(b.productMas);
  if (b.excludedProductMas !== undefined) set.excludedProductMas = upperMas(b.excludedProductMas);
  if (b.targetCustomer !== undefined) set.targetCustomer = targetCustomerOf(b.targetCustomer);
}

function applyLimitFields(b: Body, set: Partial<PromotionDoc>): void {
  if (b.regionId !== undefined) set.regionId = String(b.regionId || "").trim() || undefined;
  if (b.startDate !== undefined) set.startDate = isoOrUndefined(b.startDate);
  if (b.endDate !== undefined) set.endDate = isoOrUndefined(b.endDate);
  if (b.usageLimitTotal !== undefined) {
    set.usageLimitTotal = b.usageLimitTotal ? Math.max(1, Number(b.usageLimitTotal)) : undefined;
  }
  if (b.usageLimitPerCustomer !== undefined) {
    set.usageLimitPerCustomer = b.usageLimitPerCustomer
      ? Math.max(1, Number(b.usageLimitPerCustomer))
      : undefined;
  }
  if (b.budgetTotal !== undefined) {
    set.budgetTotal = b.budgetTotal ? Math.max(0, Number(b.budgetTotal)) : undefined;
  }
  if (b.status !== undefined && ["draft", "active", "paused", "archived"].includes(b.status)) {
    set.status = b.status;
  }
  if (b.isPublic !== undefined) set.isPublic = b.isPublic !== false;
  if (b.combineWithShip !== undefined) set.combineWithShip = b.combineWithShip !== false;
  if (b.excludeFlash !== undefined) set.excludeFlash = b.excludeFlash === true;
  if (b.priority !== undefined) set.priority = Number(b.priority) || 0;
}

/** Dựng `$set` cho PATCH; giữ nguyên thứ tự kiểm tra như route cũ. */
export function buildPromotionUpdate(
  b: Body,
  existing: PromotionDoc,
  actor: string,
  nowIso: string
): PayloadResult<Partial<PromotionDoc>> {
  const set: Partial<PromotionDoc> = {
    updatedAt: nowIso,
    updatedBy: actor,
    revision: (existing.revision || 1) + 1,
  };
  applyBasicFields(b, set);
  applyScopeFields(b, set);
  if (b.benefitType !== undefined) {
    const nextBenefit = b.benefitType === "shipping" ? "shipping" : "goods";
    const currentBenefit = existing.benefitType || "goods";
    if (nextBenefit !== currentBenefit && (existing.usedCount || 0) + (existing.heldCount || 0) > 0) {
      return {
        ok: false,
        status: 400,
        error: "Không đổi loại ưu đãi khi chương trình đã có lượt dùng. Hãy nhân bản thành chương trình mới.",
      };
    }
    set.benefitType = nextBenefit;
  }
  applyLimitFields(b, set);
  Object.assign(set, claimFieldsOf(b));

  const merged = { ...existing, ...set } as PromotionDoc;
  const shipErr = shippingPromotionError(merged) || claimFieldsError(merged) || claimedEditError(existing, set);
  if (shipErr) return { ok: false, status: 400, error: shipErr };
  Object.assign(set, applyShippingPromotionDefaults(merged));
  return { ok: true, value: set };
}
