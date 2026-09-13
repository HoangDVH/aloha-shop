/**
 * Gom biến thể / ĐVT cho shop — CHỈ ĐỌC Mongo, không ghi aloha_products.
 */
import type { Db, Document } from "mongodb";

export type ShopAttr = { attributeName: string; attributeValue: string };

export type VariantModel = {
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

const RETAIL_DVT = new Set(
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

export function parseAttrQuery(raw: unknown): ShopAttr[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  const out: ShopAttr[] = [];
  for (const item of list) {
    const s = String(item || "").trim();
    if (!s) continue;
    const i = s.indexOf(":");
    if (i <= 0) continue;
    const attributeName = s.slice(0, i).trim();
    const attributeValue = s.slice(i + 1).trim();
    if (attributeName && attributeValue) out.push({ attributeName, attributeValue });
  }
  return out;
}

export function parseDvtQuery(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  return [...new Set(list.map((x) => String(x || "").trim()).filter(Boolean))];
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gom ĐVT lẻ tẻ (THÙNG 96…, CÁI/Cái) → nhãn chuẩn cho bộ lọc.
 * Chỉ dùng khi đọc/hiển thị — không ghi Mongo.
 */
export function canonicalizeDvt(raw: string): string | null {
  const k = normKey(raw).replace(/\s+/g, " ");
  if (!k) return null;
  if (k.includes("thung")) return "Thùng";
  if (k === "cay" || k === "cay.") return "Cây";
  if (k === "chau" || k === "chau.") return "Chậu";
  if (k === "cai" || k === "cai.") return "Cái";
  if (k === "goi" || k.startsWith("goi ")) return "Gói";
  if (k === "bao" || k.startsWith("bao ") || /^bao\d/.test(k)) return "Bao";
  if (k === "bich" || k.startsWith("bich ")) return "Bịch";
  if (k === "tui" || k.startsWith("tui ")) return "Túi";
  if (k === "bo" || k.startsWith("bo ")) return "Bộ";
  if (k === "set" || k.startsWith("set ")) return "Set";
  if (k === "hop" || k.startsWith("hop ") || k.includes("hop ")) return "Hộp";
  if (k.includes("loc ") || k.startsWith("loc") || k.includes("lốc")) return "Lốc";
  if (k === "kg" || k.includes(" kg") || k.endsWith("kg") || k.startsWith("1 kg") || k.includes("1kg"))
    return "Kg";
  if (k.includes("gram")) return "Gram";
  if (k === "chai" || k.startsWith("chai ")) return "Chai";
  if (k === "hu" || k.startsWith("hu ")) return "Hũ";
  if (k === "con" || k.startsWith("con ")) return "Con";
  if (k === "vi" || k.startsWith("vi ")) return "Vỉ";
  // Quá cụ thể / lạ → không đưa vào facet (tránh tường chip)
  return null;
}

/** Match lọc ĐVT theo nhãn đã gom (Thùng khớp mọi dvt chứa thùng…). */
export function mongoDvtFilter(selected: string[]): Record<string, unknown> | null {
  if (!selected.length) return null;
  const ors: Record<string, unknown>[] = [];
  for (const s of selected) {
    const bucket = canonicalizeDvt(s) || s.trim();
    const bk = normKey(bucket);
    if (bk === "thung") ors.push({ dvt: { $regex: /thùng|thung/i } });
    else if (bk === "cay") ors.push({ dvt: { $regex: /^cây$|^cay$/i } });
    else if (bk === "chau") ors.push({ dvt: { $regex: /^chậu$|^chau$/i } });
    else if (bk === "cai") ors.push({ dvt: { $regex: /^cái$|^cai$/i } });
    else if (bk === "goi") ors.push({ dvt: { $regex: /gói|goi/i } });
    else if (bk === "bao") ors.push({ dvt: { $regex: /^bao|\bbao/i } });
    else if (bk === "bich") ors.push({ dvt: { $regex: /bịch|bich/i } });
    else if (bk === "tui") ors.push({ dvt: { $regex: /túi|tui/i } });
    else if (bk === "bo") ors.push({ dvt: { $regex: /^bộ$|^bo$/i } });
    else if (bk === "set") ors.push({ dvt: { $regex: /^set/i } });
    else if (bk === "hop") ors.push({ dvt: { $regex: /hộp|hop/i } });
    else if (bk === "loc") ors.push({ dvt: { $regex: /lốc|loc/i } });
    else if (bk === "kg") ors.push({ dvt: { $regex: /kg/i } });
    else if (bk === "gram") ors.push({ dvt: { $regex: /gram/i } });
    else if (bk === "chai") ors.push({ dvt: { $regex: /chai/i } });
    else if (bk === "hu") ors.push({ dvt: { $regex: /^hũ$|^hu$/i } });
    else if (bk === "con") ors.push({ dvt: { $regex: /^con$/i } });
    else if (bk === "vi") ors.push({ dvt: { $regex: /^vỉ$|^vi$/i } });
    else ors.push({ dvt: new RegExp(`^${escapeRx(s)}$`, "i") });
  }
  return ors.length === 1 ? ors[0] : { $or: ors };
}

/** Gom + xếp ĐVT facet; bỏ giá trị lẻ không map được. */
export function compactDvtFacetLabels(
  rows: { label: string; count: number }[],
  max = 10
): string[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const b = canonicalizeDvt(r.label);
    if (!b) continue;
    map.set(b, (map.get(b) || 0) + (Number(r.count) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
    .slice(0, max)
    .map(([k]) => k);
}

/** Giới hạn section attr + số value (theo count). */
export function compactAttributeFacets(
  rows: { name: string; value: string; count: number }[],
  opts?: { maxAttrs?: number; maxValues?: number }
): Record<string, string[]> {
  const maxAttrs = opts?.maxAttrs ?? 6;
  const maxValues = opts?.maxValues ?? 16;
  const byName = new Map<string, { value: string; count: number }[]>();
  const nameCount = new Map<string, number>();
  for (const r of rows) {
    const n = String(r.name || "").trim();
    const v = String(r.value || "").trim();
    if (!n || !v) continue;
    if (!byName.has(n)) byName.set(n, []);
    const arr = byName.get(n)!;
    if (!arr.some((x) => normKey(x.value) === normKey(v))) {
      arr.push({ value: v, count: Number(r.count) || 0 });
    }
    nameCount.set(n, (nameCount.get(n) || 0) + (Number(r.count) || 0));
  }
  const names = [...nameCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxAttrs)
    .map(([n]) => n);
  const out: Record<string, string[]> = {};
  for (const n of names) {
    const vals = (byName.get(n) || [])
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi"))
      .slice(0, maxValues)
      .map((x) => x.value);
    if (vals.length) out[n] = vals;
  }
  return out;
}

/** Lọc Mongo theo loại hàng KV (chỉ đọc). */
export function mongoLoaiFilter(loaiRaw: string): Record<string, unknown> | null {
  const s = String(loaiRaw || "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  let kind = "";
  if (s === "thuong" || low === "hàng hóa thường" || low === "hang hoa thuong") kind = "thuong";
  else if (
    s === "san_xuat" ||
    s === "sx" ||
    low.includes("sản xuất") ||
    low.includes("san xuat")
  )
    kind = "san_xuat";
  else if (s === "combo" || low.startsWith("combo")) kind = "combo";
  else if (s === "dich_vu" || low === "dịch vụ" || low === "dich vu") kind = "dich_vu";
  else if (s === "1") kind = "combo";
  else if (s === "3") kind = "dich_vu";
  else return null;

  const hasFormulaClause = {
    $or: [
      { productFormulas: { $exists: true, $type: "array", $ne: [] } },
      { ProductFormulas: { $exists: true, $type: "array", $ne: [] } },
      { isProcessedGoods: true },
    ],
  };
  const noFormulaClause = {
    $nor: [
      { productFormulas: { $exists: true, $type: "array", $ne: [] } },
      { ProductFormulas: { $exists: true, $type: "array", $ne: [] } },
      { isProcessedGoods: true },
    ],
  };
  const typeMatch = (n: number, labels: string[]) => ({
    $or: [
      { type: n },
      { productType: n },
      { loai: n },
      { loai: String(n) },
      ...labels.map((l) => ({ loai: l })),
    ],
  });

  if (kind === "combo") {
    return typeMatch(1, ["Combo - đóng gói", "Combo"]);
  }
  if (kind === "dich_vu") {
    return typeMatch(3, ["Dịch vụ"]);
  }
  if (kind === "san_xuat") {
    return {
      $and: [
        typeMatch(2, ["Hàng sản xuất", "Hàng hóa sản xuất", "Hàng hóa - sản xuất", "Hàng hóa thường", "Hàng hóa"]),
        hasFormulaClause,
      ],
    };
  }
  // thuong
  return {
    $and: [
      typeMatch(2, ["Hàng hóa thường", "Hàng hóa", "Hàng sản xuất"]),
      noFormulaClause,
    ],
  };
}

/** Match document có đủ các cặp attr (AND); name không phân biệt hoa thường. */
export function mongoAttrFilter(attrs: ShopAttr[]): Record<string, unknown> | null {
  if (!attrs.length) return null;
  const and: Record<string, unknown>[] = [];
  for (const a of attrs) {
    and.push({
      attributes: {
        $elemMatch: {
          $or: [
            { attributeName: a.attributeName, attributeValue: a.attributeValue },
            {
              attributeName: new RegExp(`^${escapeRx(a.attributeName)}$`, "i"),
              attributeValue: new RegExp(`^${escapeRx(a.attributeValue)}$`, "i"),
            },
            { name: a.attributeName, value: a.attributeValue },
          ],
        },
      },
    });
  }
  return and.length === 1 ? and[0] : { $and: and };
}

export function scoreCanonical(doc: {
  dvt?: string;
  ton?: number;
  onHand?: number;
  kvTon?: number;
  gia?: number;
  ma?: string;
}): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0) || 0;
  const retail = isRetailDvt(String(doc.dvt || "")) ? 1_000_000 : 0;
  const inStock = ton > 0 ? 100_000 : 0;
  const gia = Number(doc.gia) || 0;
  const priceScore = gia > 0 ? Math.max(0, 50_000 - Math.min(gia / 1000, 50_000)) : 0;
  return retail + inStock + priceScore;
}

type Publicizer = (doc: Record<string, unknown>) => {
  ma: string;
  ten: string;
  dvt: string;
  gia: number;
  ton: number;
  anh: string;
  images: string[];
  videos?: string[];
  videoUrl?: string;
  path: string;
};

export function toVariantModel(
  doc: Record<string, unknown>,
  toPublic: Publicizer
): VariantModel {
  const p = toPublic(doc);
  return {
    ma: p.ma,
    ten: p.ten,
    dvt: p.dvt,
    gia: p.gia,
    ton: p.ton,
    anh: p.anh,
    images: p.images,
    videos: p.videos?.length ? p.videos : p.videoUrl ? [p.videoUrl] : undefined,
    path: p.path,
    attributes: normalizeAttrs(doc.attributes),
    masterCode: doc.masterCode != null ? String(doc.masterCode).trim() || null : null,
  };
}

const SIBLING_PROJ = {
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

/** Tồn thô trên doc — chỉ đọc. */
export function rawDocTon(doc: Record<string, unknown>): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon);
  return Number.isFinite(ton) ? ton : 0;
}

/** Combo - đóng gói (KV productType=1) hoặc có công thức thành phần. */
export function isComboOrFormulaProduct(doc: Record<string, unknown>): boolean {
  const typeN = Number(doc.productType ?? doc.type);
  if (typeN === 1) return true;
  const loai = String(doc.loai || "").toLowerCase();
  if (loai.includes("combo")) return true;
  if (doc.hasFormula === true) return true;
  if (Array.isArray(doc.productFormulas) && doc.productFormulas.length) return true;
  if (Array.isArray(doc.formulas) && (doc.formulas as unknown[]).length) return true;
  if (Array.isArray(doc.hangThanhPhan) && doc.hangThanhPhan.length) return true;
  return false;
}

export function parseFormulaComponents(
  doc: Record<string, unknown>
): { ma: string; qty: number }[] {
  const out: { ma: string; qty: number }[] = [];
  const seen = new Set<string>();
  const push = (maRaw: string, qtyRaw: unknown) => {
    const ma = String(maRaw || "")
      .trim()
      .toUpperCase();
    if (!ma || seen.has(ma)) return;
    const qty = Number(qtyRaw);
    seen.add(ma);
    out.push({ ma, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
  };
  const formulas = (doc.productFormulas || doc.formulas) as unknown;
  if (Array.isArray(formulas)) {
    for (const f of formulas as any[]) {
      const nested = f?.product || f?.Product || {};
      push(
        f?.materialCode ||
          f?.MaterialCode ||
          nested?.code ||
          nested?.Code ||
          f?.productCode ||
          f?.code ||
          f?.ma ||
          "",
        f?.quantity ?? f?.Quantity ?? f?.soLuong ?? 1
      );
    }
  }
  if (Array.isArray(doc.hangThanhPhan)) {
    for (const h of doc.hangThanhPhan as any[]) {
      push(h?.ma || h?.code || "", h?.soLuong ?? h?.quantity ?? 1);
    }
  }
  return out;
}

/** Tổng tồn nhóm «cùng loại» (giống dòng tổng tab KV) — chỉ đọc. */
export function sumFamilyTon(docs: Record<string, unknown>[]): number {
  let s = 0;
  for (const d of docs) s += Math.max(0, rawDocTon(d));
  return s;
}

/**
 * Tồn hiển thị shop cho combo / SP có công thức — không ghi Mongo.
 * Ưu tiên số bán được từ thành phần nếu > 0; không thì tổng tồn siblings (như KV).
 */
export async function resolveShopDisplayTon(
  db: Db,
  colName: string,
  seed: Record<string, unknown>,
  siblings?: Record<string, unknown>[]
): Promise<number> {
  const own = rawDocTon(seed);
  const sibs =
    siblings && siblings.length
      ? siblings
      : await findAttrSiblings(db, colName, seed, 40);
  const family = sumFamilyTon(sibs);

  if (!isComboOrFormulaProduct(seed) && !(normalizeAttrs(seed.attributes).length > 0)) {
    return own;
  }

  const comps = parseFormulaComponents(seed);
  if (comps.length) {
    const byMa = new Map<string, number>();
    for (const d of sibs) {
      const ma = String(d.ma || "")
        .trim()
        .toUpperCase();
      if (ma) byMa.set(ma, rawDocTon(d));
    }
    const missing = comps.filter((c) => !byMa.has(c.ma)).map((c) => c.ma);
    if (missing.length) {
      const extra = await db
        .collection(colName)
        .find({ ma: { $in: missing } } as any)
        .project({ ma: 1, ton: 1, onHand: 1, kvTon: 1 })
        .limit(40)
        .toArray();
      for (const d of extra) {
        const ma = String(d.ma || "")
          .trim()
          .toUpperCase();
        if (ma) byMa.set(ma, rawDocTon(d as any));
      }
    }
    let sellable = Infinity;
    for (const c of comps) {
      const t = byMa.get(c.ma) ?? 0;
      sellable = Math.min(sellable, Math.floor(t / c.qty));
    }
    if (Number.isFinite(sellable) && sellable > 0) return sellable;
  }

  // Combo thường ton=0 trên Mongo — lấy tổng cùng loại như dòng tổng KV.
  if (isComboOrFormulaProduct(seed) && own <= 0 && family > 0) return family;
  return own;
}

function shopActiveAnd(): object[] {
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

/** Siblings cùng nhóm biến thể (attr) — read-only. */
export async function findAttrSiblings(
  db: Db,
  colName: string,
  seed: Record<string, unknown>,
  limit = 40
): Promise<Record<string, unknown>[]> {
  const attrs = normalizeAttrs(seed.attributes);
  if (!attrs.length) return [seed];
  const gkey = variantGroupKey(seed);
  if (!gkey) return [seed];

  const tenRaw = String(seed.ten || "").trim();
  const tenNorm = normProductTen(tenRaw);
  if (!tenNorm) return [seed];

  const keySet = attrKeySet(attrs);
  const names = keySet.split("|").filter(Boolean);

  // Lọc theo tên hàng (không theo nhom) — khớp «Hàng hóa cùng loại» KV.
  const filter: Document = {
    $and: [
      ...shopActiveAnd(),
      { "attributes.0": { $exists: true } },
      {
        $or: [
          { ten: tenRaw },
          { ten: new RegExp(`^${escapeRx(tenRaw)}$`, "i") },
        ],
      },
    ],
  };

  const docs = await db
    .collection(colName)
    .find(filter)
    .project(SIBLING_PROJ)
    .limit(Math.min(200, limit * 5))
    .toArray();

  const matched = docs.filter((d) => {
    const a = normalizeAttrs((d as any).attributes);
    if (attrKeySet(a) !== keySet) return false;
    const have = new Set(a.map((x) => normKey(x.attributeName)));
    if (names.some((n) => !have.has(n))) return false;
    return variantGroupKey(d as any) === gkey;
  }) as Record<string, unknown>[];

  if (!matched.some((d) => String(d.ma) === String(seed.ma))) {
    matched.unshift(seed);
  }

  // dedupe ma
  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of matched) {
    const ma = String(d.ma || "").trim().toUpperCase();
    if (!ma) continue;
    if (!byMa.has(ma)) byMa.set(ma, d);
  }
  return [...byMa.values()].slice(0, limit);
}

/** Cặp ĐVT Thùng/Cây — read-only (masterCode / cùng tên / mã T…). */
export async function findUnitPairDocs(
  db: Db,
  colName: string,
  seed: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const ma = String(seed.ma || "").trim();
  if (!ma) return [seed];
  const maUpper = ma.toUpperCase();
  const masterCode = seed.masterCode != null ? String(seed.masterCode).trim() : "";
  const masterProductId =
    seed.masterProductId != null && seed.masterProductId !== ""
      ? Number(seed.masterProductId)
      : null;

  const or: Document[] = [{ ma }, { ma: maUpper }, { ma: ma.toLowerCase() }];
  if (masterCode) {
    or.push({ ma: masterCode }, { ma: masterCode.toUpperCase() }, { masterCode: ma });
    or.push({ masterCode: maUpper });
  }
  if (masterProductId && Number.isFinite(masterProductId)) {
    or.push({ masterProductId });
    or.push({ id: masterProductId });
  }
  // Quy ước ALOHA: mã thùng = T + mã lẻ (TNGBMNT40 ↔ NGBMNT40)
  if (maUpper.startsWith("T") && maUpper.length > 2) {
    const base = maUpper.slice(1);
    or.push({ ma: base }, { ma: base.toLowerCase() }, { masterCode: base });
  } else {
    or.push({ ma: `T${maUpper}` }, { ma: `t${ma.toLowerCase()}` });
    or.push({ masterCode: maUpper }, { masterCode: `T${maUpper}` });
  }

  const docs = await db
    .collection(colName)
    .find({ $and: [...shopActiveAnd(), { $or: or }] } as any)
    .project(SIBLING_PROJ)
    .limit(12)
    .toArray();

  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of [seed, ...docs]) {
    const k = String(d.ma || "").trim().toUpperCase();
    if (k) byMa.set(k, d as Record<string, unknown>);
  }
  let list = [...byMa.values()];
  let dvts = new Set(list.map((d) => normKey(String(d.dvt || ""))));
  if (dvts.size >= 2) return list;

  // Fallback: cùng tên hàng, một mã Cây/Cái và một mã Thùng (không cần masterCode).
  const tenRaw = String(seed.ten || "").trim();
  if (tenRaw) {
    const byTen = await db
      .collection(colName)
      .find({
        $and: [
          ...shopActiveAnd(),
          {
            $or: [
              { ten: tenRaw },
              { ten: new RegExp(`^${escapeRx(tenRaw)}$`, "i") },
            ],
          },
        ],
      } as any)
      .project(SIBLING_PROJ)
      .limit(24)
      .toArray();

    for (const d of byTen) {
      const k = String(d.ma || "").trim().toUpperCase();
      if (k) byMa.set(k, d as Record<string, unknown>);
    }
    list = [...byMa.values()].filter((d) => {
      const dvt = String(d.dvt || "");
      const k = normKey(dvt);
      return isRetailDvt(dvt) || k.includes("thung");
    });
    const hasRetail = list.some((d) => isRetailDvt(String(d.dvt || "")));
    const hasThung = list.some((d) => normKey(String(d.dvt || "")).includes("thung"));
    if (hasRetail && hasThung) return list.slice(0, 12);
  }

  return [seed];
}

export function buildAxesAndModels(
  docs: Record<string, unknown>[],
  toPublic: Publicizer,
  currentMa: string
): {
  axes: {
    name: string;
    kind: "attr" | "unit";
    values: { value: string; image?: string; available: boolean }[];
  }[];
  models: VariantModel[];
  current: VariantModel | null;
} {
  const models = docs.map((d) => toVariantModel(d, toPublic));
  // dedupe by ma
  const byMa = new Map<string, VariantModel>();
  for (const m of models) {
    const k = m.ma.toUpperCase();
    if (!byMa.has(k)) byMa.set(k, m);
  }
  const uniq = [...byMa.values()];
  const current =
    uniq.find((m) => m.ma.toUpperCase() === currentMa.toUpperCase()) || uniq[0] || null;

  const attrNames: string[] = [];
  const nameCanon = new Map<string, string>();
  for (const m of uniq) {
    for (const a of m.attributes) {
      const nk = normKey(a.attributeName);
      if (!nk) continue;
      if (!nameCanon.has(nk)) {
        nameCanon.set(nk, a.attributeName);
        attrNames.push(a.attributeName);
      }
    }
  }

  const axes: {
    name: string;
    kind: "attr" | "unit";
    values: { value: string; image?: string; available: boolean }[];
  }[] = [];

  for (const name of attrNames) {
    const nk = normKey(name);
    const vals = new Map<string, { value: string; image?: string; available: boolean }>();
    for (const m of uniq) {
      const hit = m.attributes.find((a) => normKey(a.attributeName) === nk);
      if (!hit) continue;
      const vk = normKey(hit.attributeValue);
      const prev = vals.get(vk);
      const available = m.ton > 0;
      if (!prev) {
        vals.set(vk, {
          value: hit.attributeValue,
          image: m.anh || undefined,
          available,
        });
      } else {
        prev.available = prev.available || available;
        if (!prev.image && m.anh) prev.image = m.anh;
      }
    }
    axes.push({
      name: nameCanon.get(nk) || name,
      kind: "attr",
      values: [...vals.values()],
    });
  }

  const unitVals = new Map<string, { value: string; available: boolean }>();
  for (const m of uniq) {
    const d = (m.dvt || "Cái").trim() || "Cái";
    const vk = normKey(d);
    const prev = unitVals.get(vk);
    if (!prev) unitVals.set(vk, { value: d, available: m.ton > 0 });
    else prev.available = prev.available || m.ton > 0;
  }
  if (unitVals.size >= 2) {
    axes.push({
      name: "Đơn vị",
      kind: "unit",
      values: [...unitVals.values()].map((v) => ({
        value: v.value,
        available: v.available,
      })),
    });
  }

  return { axes, models: uniq, current };
}

/** Dedupe list cards trong 1 batch (in-memory). */
export function dedupeCanonicalPublic<
  T extends { ma: string; dvt: string; ton: number; gia: number; ten: string }
>(
  items: T[],
  attrsByMa: Map<string, ShopAttr[]>,
  _nhomByMa?: Map<string, string>
): T[] {
  const groups = new Map<string, T[]>();
  const singles: T[] = [];
  for (const it of items) {
    const attrs = attrsByMa.get(it.ma.toUpperCase()) || [];
    if (!attrs.length) {
      singles.push(it);
      continue;
    }
    // Cùng khóa với variantGroupKey — không gắn nhom / baseName strip.
    const key = variantGroupKey({ ten: it.ten, attributes: attrs });
    if (!key) {
      singles.push(it);
      continue;
    }
    const arr = groups.get(key) || [];
    arr.push(it);
    groups.set(key, arr);
  }
  const out: T[] = [...singles];
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const sa = scoreCanonical(a);
      const sb = scoreCanonical(b);
      if (sb !== sa) return sb - sa;
      return a.ma.localeCompare(b.ma);
    });
    const pick = arr[0];
    // Tồn card = tổng nhóm cùng loại (giống dòng tổng KV) — chỉ khi đọc, không ghi Mongo.
    const familyTon = arr.reduce((s, x) => s + (Number(x.ton) || 0), 0);
    out.push(familyTon > (Number(pick.ton) || 0) ? { ...pick, ton: familyTon } : pick);
  }

  // Mongo có thể có 2 bản ghi cùng mã (đồng bộ KV) → 1 card / mã trên lưới shop.
  const byMa = new Map<string, T>();
  for (const it of out) {
    const k = String(it.ma || "")
      .trim()
      .toUpperCase();
    if (!k) continue;
    const prev = byMa.get(k);
    if (!prev) {
      byMa.set(k, it);
      continue;
    }
    const prefer =
      scoreCanonical(it) > scoreCanonical(prev)
        ? it
        : scoreCanonical(it) < scoreCanonical(prev)
          ? prev
          : (Number(it.ton) || 0) >= (Number(prev.ton) || 0)
            ? it
            : prev;
    byMa.set(k, prefer);
  }
  return [...byMa.values()];
}
