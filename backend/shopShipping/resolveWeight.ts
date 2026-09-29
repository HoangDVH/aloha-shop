import { parseWeightGramFromText } from "./parseWeight.js";
import { shipSizeFromCategory } from "./categorySizeMap.js";
import {
  DEFAULT_SIZE_CLASS,
  DEFAULT_WEIGHT_GRAM,
  SIZE_PRESETS,
  type ShipSizeClass,
  type SizePreset,
} from "./sizePresets.js";

export type PackageDataSource = "measured" | "verified_preset" | "inferred" | "unknown";

export type ProductShipMeta = {
  ma?: string;
  ten?: string;
  trongLuong?: number;
  donViTrongLuong?: string;
  dvt?: string;
  shipSizeClass?: string;
  /** Nhóm vận chuyển shop cấu hình cho danh mục (kể cả kế thừa nhóm mẹ). */
  categoryShipSizeClass?: string;
  categoryId?: number;
  nhomPath?: string;
  nhom?: string;
  categoryName?: string;
  ancestor?: string[];
  chieuDaiCm?: number;
  chieuRongCm?: number;
  chieuCaoCm?: number;
  isFragile?: boolean;
  packageIncluded?: boolean;
  requiresSpecialHandling?: boolean;
};

export type ResolvedWeightInfo = {
  weightGram: number;
  source: PackageDataSource;
  needsConfirmation: boolean;
  confirmationReason?: string;
};

function normalizeSizeClass(raw: unknown): ShipSizeClass | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "nho" || s === "vua" || s === "to" || s === "dat_giath") return s;
  if (s === "nhỏ") return "nho";
  if (s === "vừa" || s === "trung") return "vua";
  if (s === "lớn" || s === "lon") return "to";
  return null;
}

export function inferSizeFromMaTen(ma: string, ten = ""): ShipSizeClass | null {
  const hay = `${ma} ${ten}`.toUpperCase();
  const c = hay.match(/\bC(\d{1,3})\b/);
  if (c) {
    const n = parseInt(c[1], 10);
    if (n >= 60) return "to";
    if (n >= 35) return "vua";
    if (n >= 10) return "nho";
  }
  const dia = hay.match(/(?:CHAU|CHẬU|SIZE|KICH|KÍCH)\s*[-:]?\s*(\d{2,3})/);
  if (dia) {
    const n = parseInt(dia[1], 10);
    if (n >= 60) return "to";
    if (n >= 35) return "vua";
    if (n >= 15) return "nho";
  }
  return null;
}

export function resolveSizeClassWithSource(doc: ProductShipMeta): {
  sizeClass: ShipSizeClass | null;
  source: PackageDataSource;
} {
  const fromMongo = normalizeSizeClass(doc.shipSizeClass);
  if (fromMongo) return { sizeClass: fromMongo, source: "verified_preset" };

  const fromCategoryConfig = normalizeSizeClass(doc.categoryShipSizeClass);
  if (fromCategoryConfig) return { sizeClass: fromCategoryConfig, source: "verified_preset" };

  const ancestor = Array.isArray(doc.ancestor)
    ? doc.ancestor.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const nhomPath = String(
    (ancestor.length ? ancestor.join(" >> ") : "") ||
      doc.categoryName ||
      doc.nhomPath ||
      doc.nhom ||
      ""
  ).trim();
  const ten = String(doc.ten || "").trim();
  const ma = String(doc.ma || "").trim();

  const fromCat = shipSizeFromCategory(nhomPath, ten);
  if (fromCat) return { sizeClass: fromCat, source: "verified_preset" };

  const fromCode = inferSizeFromMaTen(ma, ten);
  if (fromCode) return { sizeClass: fromCode, source: "inferred" };

  return { sizeClass: null, source: "unknown" };
}

export function resolveSizeClass(doc: ProductShipMeta): ShipSizeClass {
  const res = resolveSizeClassWithSource(doc);
  return res.sizeClass || DEFAULT_SIZE_CLASS;
}

/**
 * Chuẩn hóa trọng lượng ra gram, phân biệt chuẩn xác 30g vs 30kg (SH04).
 */
export function normalizeTrongLuongGram(raw: number, textContext = "", unitHint = ""): number {
  const tl = Number(raw) || 0;
  if (tl <= 0) return 0;

  const hint = String(unitHint || "").trim().toLowerCase();
  if (hint === "g" || hint === "gram") return Math.round(tl);
  if (hint === "kg" || hint === "kilo" || hint === "kilogram") return Math.round(tl * 1000);

  // Phân tích từ ngữ cảnh text (tên/mã SP) nếu có
  const text = String(textContext || "").toUpperCase();
  if (text) {
    const isExplicitKg = /\b\d+(\.\d+)?\s*(KG|KILO)\b/.test(text);
    const isExplicitG = /\b\d+(\.\d+)?\s*(G|GRAM)\b/.test(text);
    if (isExplicitG && !isExplicitKg) {
      return Math.round(tl);
    }
    if (isExplicitKg) {
      if (tl < 100) return Math.round(tl * 1000);
      return Math.round(tl);
    }
  }

  // >= 100 → đã là gram (500, 1100, 3000…)
  if (tl >= 100) return Math.round(tl);

  // < 50: nếu không có text khẳng định là gram, coi là kg từ KiotViet (1.5, 3, 12…) → gram
  if (tl > 0 && tl < 50) return Math.round(tl * 1000);

  return Math.round(tl);
}

/** ĐVT bán theo khối lượng ("KG", "500g", "1,5 kg") → gram của 1 đơn vị bán; ĐVT khác → 0. */
export function gramPerSaleUnit(dvt: unknown): number {
  const m = String(dvt || "")
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)?\s*(kg|kilo|kilogram|g|gr|gram)$/);
  if (!m) return 0;
  const qty = m[1] ? Number(m[1].replace(",", ".")) : 1;
  if (!(qty > 0)) return 0;
  const perUnit = m[2].startsWith("k") ? 1000 : 1;
  return Math.round(qty * perUnit);
}

/** ĐVT bán nguyên thùng/kiện/hộp nhiều cái — preset của 1 món không dùng được. */
export function isBulkSaleUnit(dvt: unknown): boolean {
  return /^(?:\d+\s*)?(?:thùng|kiện|hộp|bịch|sấp|lốc)(?!\p{L})/iu.test(String(dvt || "").trim());
}

/**
 * Trả về trọng lượng gram kèm nguồn dữ liệu (Level 1..4 theo Section 5.1).
 */
export function resolveWeightWithSource(doc: ProductShipMeta): ResolvedWeightInfo {
  const ma = String(doc.ma || "").trim();
  const ten = String(doc.ten || "").trim();
  const textCombo = `${ma} ${ten}`;

  // Kiểm tra hàng đặc thù / dễ vỡ / vượt khổ (SH07)
  if (doc.isFragile || doc.requiresSpecialHandling) {
    return {
      weightGram: DEFAULT_WEIGHT_GRAM,
      source: "unknown",
      needsConfirmation: true,
      confirmationReason: "Hàng đặc thù/dễ vỡ cần shop xác nhận cách đóng gói",
    };
  }

  // Mức 1: Có trọng lượng thực hoặc kích thước đo
  const rawTl = Number(doc.trongLuong) || 0;
  if (rawTl > 0) {
    const norm = normalizeTrongLuongGram(rawTl, textCombo, doc.donViTrongLuong);
    if (norm > 0) {
      // Nếu trọng lượng quá lớn (> 50kg) chuyển xác nhận (SH07)
      if (norm > 50_000) {
        return {
          weightGram: norm,
          source: "measured",
          needsConfirmation: true,
          confirmationReason: "Kiện hàng lớn (>50kg) cần shop báo phí vận chuyển",
        };
      }
      return { weightGram: norm, source: "measured", needsConfirmation: false };
    }
  }

  const unitGram = gramPerSaleUnit(doc.dvt) || parseWeightGramFromText(String(doc.dvt || "")) || 0;
  if (unitGram > 0) {
    return { weightGram: unitGram, source: "inferred", needsConfirmation: false };
  }

  const ownSizeClass = normalizeSizeClass(doc.shipSizeClass);
  if (ownSizeClass) {
    return { weightGram: SIZE_PRESETS[ownSizeClass].weightGram, source: "verified_preset", needsConfirmation: false };
  }

  if (isBulkSaleUnit(doc.dvt)) {
    return {
      weightGram: DEFAULT_WEIGHT_GRAM,
      source: "unknown",
      needsConfirmation: true,
      confirmationReason: "Hàng bán nguyên thùng/kiện cần shop báo phí vận chuyển",
    };
  }

  // Khối lượng ghi trên tên SP cụ thể hơn nhóm danh mục.
  const fromTenEarly = parseWeightGramFromText(ten);
  if (fromTenEarly) {
    return { weightGram: fromTenEarly, source: "inferred", needsConfirmation: false };
  }

  if (/^bao(?!\p{L})/iu.test(String(doc.dvt || "").trim())) {
    return { weightGram: SIZE_PRESETS.dat_giath.weightGram, source: "verified_preset", needsConfirmation: false };
  }

  // Mức 2: Mẫu preset đã kiểm chứng từ danh mục/biến thể
  const sizeRes = resolveSizeClassWithSource(doc);
  if (sizeRes.source === "verified_preset" && sizeRes.sizeClass) {
    const preset = SIZE_PRESETS[sizeRes.sizeClass];
    return {
      weightGram: preset.weightGram,
      source: "verified_preset",
      needsConfirmation: false,
    };
  }

  // Mức 3: Gợi ý từ mã/tên (VD: 500G, 2KG...)
  const fromMa = parseWeightGramFromText(ma);
  if (fromMa) {
    return { weightGram: fromMa, source: "inferred", needsConfirmation: false };
  }

  // Mức 4: Không nhận diện được hoặc dữ liệu mâu thuẫn -> Chờ shop báo phí (SH03)
  // Không tự động gán hàng 500g tùy tiện làm phí sai lệch
  return {
    weightGram: DEFAULT_WEIGHT_GRAM,
    source: "unknown",
    needsConfirmation: true,
    confirmationReason: "Chưa có thông số kích thước/khối lượng xác thực",
  };
}

export function resolveWeightGram(doc: ProductShipMeta): number {
  return resolveWeightWithSource(doc).weightGram;
}

export function resolveDimensions(doc: ProductShipMeta): SizePreset {
  const l = Number(doc.chieuDaiCm) || 0;
  const w = Number(doc.chieuRongCm) || 0;
  const h = Number(doc.chieuCaoCm) || 0;
  if (l > 0 && w > 0 && h > 0) {
    return {
      weightGram: resolveWeightGram(doc),
      lengthCm: l,
      widthCm: w,
      heightCm: h,
    };
  }
  return SIZE_PRESETS[resolveSizeClass(doc)];
}

export function resolveLineWeightGram(doc: ProductShipMeta, qty: number): number {
  const q = Math.max(1, Math.floor(qty) || 1);
  return resolveWeightGram(doc) * q;
}

export type PackageLine = {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  quantity?: number;
  packageIncluded?: boolean;
};

function stackDimsForQty(
  dim: Pick<PackageLine, "lengthCm" | "widthCm" | "heightCm">,
  qty: number
): Pick<PackageLine, "lengthCm" | "widthCm" | "heightCm"> {
  const q = Math.max(1, Math.floor(qty) || 1);
  if (q <= 1) return dim;
  const f = Math.cbrt(q);
  return {
    lengthCm: Math.ceil(dim.lengthCm * f),
    widthCm: Math.ceil(dim.widthCm * f),
    heightCm: Math.ceil(dim.heightCm * f),
  };
}

/** Gộp nhiều dòng → 1 kiện (cân tổng, kích thước max sau khi phóng theo qty). */
export function mergePackage(lines: PackageLine[]): SizePreset {
  if (!lines.length) {
    return { ...SIZE_PRESETS[DEFAULT_SIZE_CLASS], weightGram: DEFAULT_WEIGHT_GRAM };
  }
  let weightGram = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let heightCm = 0;
  for (const ln of lines) {
    weightGram += ln.weightGram;
    const stacked = stackDimsForQty(ln, ln.quantity ?? 1);
    lengthCm = Math.max(lengthCm, stacked.lengthCm);
    widthCm = Math.max(widthCm, stacked.widthCm);
    heightCm = Math.max(heightCm, stacked.heightCm);
  }
  return { weightGram: Math.max(weightGram, DEFAULT_WEIGHT_GRAM), lengthCm, widthCm, heightCm };
}
