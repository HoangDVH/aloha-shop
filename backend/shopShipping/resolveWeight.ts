import { parseWeightGramFromText } from "./parseWeight.js";
import { shipSizeFromCategory } from "./categorySizeMap.js";
import {
  DEFAULT_SIZE_CLASS,
  DEFAULT_WEIGHT_GRAM,
  SIZE_PRESETS,
  type ShipSizeClass,
  type SizePreset,
} from "./sizePresets.js";

export type ProductShipMeta = {
  ma?: string;
  ten?: string;
  trongLuong?: number;
  shipSizeClass?: string;
  nhomPath?: string;
  nhom?: string;
  chieuDaiCm?: number;
  chieuRongCm?: number;
  chieuCaoCm?: number;
};

function normalizeSizeClass(raw: unknown): ShipSizeClass | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "nho" || s === "vua" || s === "to" || s === "dat_giath") return s;
  if (s === "nhỏ" || s === "nho") return "nho";
  if (s === "vừa" || s === "vua" || s === "trung") return "vua";
  if (s === "lớn" || s === "lon" || s === "to") return "to";
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

export function resolveSizeClass(doc: ProductShipMeta): ShipSizeClass {
  const fromMongo = normalizeSizeClass(doc.shipSizeClass);
  if (fromMongo) return fromMongo;

  const nhomPath = String(doc.nhomPath || doc.nhom || "").trim();
  const ten = String(doc.ten || "").trim();
  const ma = String(doc.ma || "").trim();
  const fromCat = shipSizeFromCategory(nhomPath, ten);
  if (fromCat) return fromCat;

  const fromCode = inferSizeFromMaTen(ma, ten);
  if (fromCode) return fromCode;

  return DEFAULT_SIZE_CLASS;
}

/**
 * KiotViet lưu `weight` theo kg (vd 1.5, 3).
 * Job enrich / nhập tay thường là gram (500, 3000).
 */
export function normalizeTrongLuongGram(raw: number): number {
  const tl = Number(raw) || 0;
  if (tl <= 0) return 0;
  // >= 100 → đã là gram (500, 1100, 3000…)
  if (tl >= 100) return Math.round(tl);
  // < 50 → coi là kg từ KiotViet (1.5, 3, 12…) → gram
  // = 50 giữ nguyên gram (gói 50G), tránh nhân nhầm thành 50kg
  if (tl > 0 && tl < 50) return Math.round(tl * 1000);
  return Math.round(tl);
}

export function resolveWeightGram(doc: ProductShipMeta): number {
  const tl = normalizeTrongLuongGram(Number(doc.trongLuong) || 0);
  if (tl > 0) return tl;

  const ma = String(doc.ma || "").trim();
  const ten = String(doc.ten || "").trim();
  const fromMa = parseWeightGramFromText(ma);
  if (fromMa) return fromMa;
  const fromTen = parseWeightGramFromText(ten);
  if (fromTen) return fromTen;

  const envDefault = Math.max(0, Number(process.env.SHOP_DEFAULT_WEIGHT_GRAM) || 0);
  if (envDefault > 0) return Math.round(envDefault);

  const size = resolveSizeClass(doc);
  return SIZE_PRESETS[size].weightGram;
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
  /** Số lượng SP dòng — dùng phóng kích thước kiện (cân đã nhân qty ở weightGram). */
  quantity?: number;
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
