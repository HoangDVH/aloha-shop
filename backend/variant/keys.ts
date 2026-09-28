export type ShopAttr = { attributeName: string; attributeValue: string };

export type VariantModel = {
  webPrice?: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  ma: string;
  ten: string;
  dvt: string;
  gia: number;
  ton: number;
  anh: string;
  images: string[];
  videos?: string[];
  path: string;
  attributes: ShopAttr[];
  masterCode: string | null;
};

export type Publicizer = (doc: Record<string, unknown>) => {
  webPrice?: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  ma: string;
  ten: string;
  dvt: string;
  gia: number;
  ton: number;
  anh: string;
  images: string[];
  videos?: string[];
  path: string;
};

export const RETAIL_DVT = new Set(
  ["cái", "cay", "cây", "chậu", "chau", "bịch", "bich", "gói", "goi", "set", "combo"].map((s) =>
    s.normalize("NFD").replace(/\p{M}/gu, "")
  )
);

export function normKey(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeAttrs(raw: unknown): ShopAttr[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  const out: ShopAttr[] = [];
  const seen = new Set<string>();
  for (const a of raw as any[]) {
    const attributeName = String(
      a?.attributeName || a?.AttributeName || a?.name || a?.Name || ""
    ).trim();
    const attributeValue = String(
      a?.attributeValue || a?.AttributeValue || a?.value || a?.Value || ""
    ).trim();
    if (!attributeName || !attributeValue) continue;
    const k = `${normKey(attributeName)}=${normKey(attributeValue)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ attributeName, attributeValue });
  }
  return out;
}

export function attrKeySet(attrs: ShopAttr[]): string {
  return [...new Set(attrs.map((a) => normKey(a.attributeName)))]
    .filter(Boolean)
    .sort()
    .join("|");
}

/** Tên gốc: bỏ các giá trị thuộc tính khỏi tên. */
export function baseName(ten: string, attrs: ShopAttr[]): string {
  let t = String(ten || "").trim();
  const vals = attrs
    .map((a) => a.attributeValue.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const v of vals) {
    const rx = new RegExp(
      `[\\s\\-_/]*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\-_/]*`,
      "gi"
    );
    t = t.replace(rx, " ");
  }
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Chuẩn hóa tên hàng để gom «cùng loại» (không phụ thuộc nhóm danh mục). */
export function normProductTen(ten: string): string {
  return String(ten || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Khóa nhóm biến thể — chỉ đọc.
 * Dùng đúng tên hàng + bộ tên thuộc tính (giống «Hàng hóa cùng loại» KV).
 * Không gắn nhom: SP CÓ HÌNH có thể nằm nhóm khác (vd. CHẬU CÓ HÌNH).
 * Không dùng baseName strip attr: «TRƠN» nằm trong tên → lệch khóa với «CÓ HÌNH».
 */
export function variantGroupKey(doc: {
  ten?: string;
  nhom?: string;
  nhomPath?: string;
  attributes?: unknown;
}): string {
  const attrs = normalizeAttrs(doc.attributes);
  if (!attrs.length) return "";
  const ten = normProductTen(String(doc.ten || ""));
  if (!ten) return "";
  return `${attrKeySet(attrs)}::${ten}`;
}

export function isRetailDvt(dvt: string): boolean {
  const n = normKey(dvt);
  if (!n) return true;
  if (n.includes("thung") || n === "thùng") return false;
  return RETAIL_DVT.has(n) || !n.includes("thung");
}

export function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function shopActiveAnd(): object[] {
  return [
    { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
    {
      $or: [{ banTrucTiep: { $ne: false } }, { banTrucTiep: { $exists: false } }],
    },
    {
      $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
    },
  ];
}

export const SIBLING_PROJ = {
  ma: 1,
  ten: 1,
  dvt: 1,
  nhom: 1,
  nhomPath: 1,
  attributes: 1,
  masterCode: 1,
  masterProductId: 1,
  conversionValue: 1,
  giaWeb: 1,
  giaSi: 1,
  allowBackorder: 1,
  giaBan: 1,
  giaChung: 1,
  basePrice: 1,
  anh: 1,
  images: 1,
  videos: 1,
  videoUrl: 1,
  ton: 1,
  onHand: 1,
  kvTon: 1,
  isActive: 1,
  banTrucTiep: 1,
  barcode: 1,
  description: 1,
  trongLuong: 1,
  type: 1,
  productType: 1,
  loai: 1,
  hasFormula: 1,
  productFormulas: 1,
  formulas: 1,
  hangThanhPhan: 1,
  thanhPhan: 1,
} as const;
