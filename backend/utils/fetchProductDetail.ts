/**
 * Tải chi tiết SP đầy đủ — ưu tiên Mongo Aloha, fallback KiotViet.
 * API KV: GET /kv-api/products/code/{ma}?includeMaterial=true&includeInventory=true&includePricebook=true
 */
import type { Product } from '../services/database';
import { db as localDb, normalizeAnhList } from '../services/database';
import { getKiotVietToken } from '../services/kiotviet';
import { getAlohaProduct } from '../services/alohaApi';
import {
  formulasToThanhPhanLines,
  mapKvFilterExtras,
  enrichFormulasWithCatalogPrices,
  parseKvProductFormulas,
} from './kvProductFormulas';
import { sumInventoriesOnHand } from './productTon';

export type ProductDetailPatch = Partial<Product> & {
  moTa?: string;
  productFormulas?: any[];
};

const KV_DETAIL_QUERY = 'includeMaterial=true&includeInventory=true&includePricebook=true';

function bookPriceFromKv(books: any[], want: 'si' | 'web' | 'chung'): number {
  for (const b of books || []) {
    const clean = String(b?.priceBookName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const compact = clean.replace(/\s+/g, '');
    const price = Number(b?.price) || 0;
    if (price <= 0) continue;
    if (want === 'si') {
      if (clean === 'si' || compact === 'giasi' || clean.includes('gia si') || compact.includes('giasi'))
        return price;
    } else if (want === 'web') {
      if (clean === 'web' || compact === 'giaweb' || clean.includes('gia web') || compact.includes('giaweb'))
        return price;
    } else if (clean.includes('chung') || compact.includes('banggiachung')) {
      return price;
    }
  }
  return 0;
}

function unwrapKvBody(raw: any): any {
  if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data;
  return raw;
}

function mapKvResponseToPatch(data: any, catalog: Product[] = []): ProductDetailPatch {
  const p = unwrapKvBody(data);
  const ma = String(p.code || p.ma || '').trim();
  const lines = formulasToThanhPhanLines(p);
  const extras = mapKvFilterExtras(p);
  let formulasRaw =
    (Array.isArray(p.productFormulas) && p.productFormulas) ||
    (Array.isArray(p.ProductFormulas) && p.ProductFormulas) ||
    [];

  if (formulasRaw.length && catalog.length) {
    const componentMas = parseKvProductFormulas({ productFormulas: formulasRaw })
      .map((l) => l.ma)
      .filter(Boolean);
    if (componentMas.length) {
      formulasRaw = enrichFormulasWithCatalogPrices(formulasRaw, catalog);
    }
  }

  const books = Array.isArray(p.priceBooks) ? p.priceBooks : [];
  let giaVon = Number(p.cost) || 0;
  if (giaVon <= 0 && Array.isArray(p.inventories)) {
    const withCost = p.inventories.find((inv: any) => Number(inv?.cost) > 0);
    if (withCost) giaVon = Number(withCost.cost) || 0;
  }
  let ton = Number(p.onHand) || 0;
  if (Array.isArray(p.inventories) && p.inventories.length) {
    ton = sumInventoriesOnHand(p.inventories);
  }
  let giaBan = Number(p.basePrice) || 0;
  const giaChung = bookPriceFromKv(books, 'chung') || giaBan;
  if (giaBan <= 0) giaBan = giaChung;

  const images = normalizeAnhList(
    Array.isArray(p.images) ? p.images : p.image ? [p.image] : []
  );

  return {
    ma,
    ten: String(p.name || p.fullName || ma),
    dvt: String(p.unit || p.dvt || 'Cái').trim() || 'Cái',
    nhom: String(p.categoryName || p.nhom || '').trim(),
    nhomPath: String(p.categoryName || p.nhomPath || '').trim() || undefined,
    barcode: String(p.barCode || p.barcode || '').trim(),
    giaVon,
    giaBan,
    giaChung,
    giaSi: bookPriceFromKv(books, 'si'),
    giaWeb: bookPriceFromKv(books, 'web'),
    ton,
    tonMin: Number(p.minQuantity) || Number(p.onHandMin) || 0,
    tonMax: Number(p.maxQuantity) || Number(p.onHandMax) || 999_999_999,
    trongLuong: Number(p.weight) || 0,
    viTri: String(p.shelves || p.location || p.viTri || '').trim() || undefined,
    thuongHieu: String(p.tradeMarkName || p.trademarkName || '').trim() || undefined,
    nhaCungCap: String(p.supplierName || p.SupplierName || '').trim() || undefined,
    moTa: String(p.description || p.Description || '').trim() || undefined,
    images: images.length ? images : undefined,
    anh: images[0],
    thanhPhan: lines.length ? lines : extras.thanhPhan,
    productFormulas: formulasRaw.length ? formulasRaw : extras.productFormulas,
    hasFormula: Boolean(lines.length || formulasRaw.length || extras.hasFormula),
    loai: extras.loai,
    productType: extras.productType,
    banTrucTiep: extras.banTrucTiep,
    tichDiem: extras.tichDiem,
    isActive: extras.isActive,
  };
}

function mapAlohaToPatch(d: any): ProductDetailPatch {
  const images = normalizeAnhList(d.images?.length ? d.images : d.anh ? [d.anh] : []);
  return {
    ma: String(d.ma || d.code || '').trim(),
    ten: String(d.ten || d.name || '').trim(),
    dvt: d.dvt,
    nhom: d.nhom || d.nhomPath,
    nhomPath: d.nhomPath || d.nhom,
    barcode: d.barcode,
    giaVon: Number(d.giaVon) || 0,
    giaBan: Number(d.giaBan) || Number(d.giaChung) || 0,
    giaChung: Number(d.giaChung) || Number(d.giaBan) || 0,
    giaSi: Number(d.giaSi) || 0,
    giaWeb: Number(d.giaWeb) || 0,
    ton: Number(d.ton) || 0,
    tonMin: d.tonMin,
    tonMax: d.tonMax,
    trongLuong: d.trongLuong,
    viTri: d.viTri,
    thuongHieu: d.thuongHieu,
    nhaCungCap: d.nhaCungCap,
    moTa: String(d.moTa || d.description || '').trim() || undefined,
    images: images.length ? images : undefined,
    anh: images[0] || d.anh,
    thanhPhan: d.thanhPhan,
    productFormulas: d.productFormulas,
    hasFormula: d.hasFormula,
    loai: d.loai || d.loaiHang,
    loaiHang: d.loaiHang,
    productType: d.productType,
    banTrucTiep: d.banTrucTiep,
    tichDiem: d.tichDiem,
    isActive: d.isActive,
  };
}

/** Gộp patch lên bản SP hiện có (giữ giá trị cũ nếu patch = 0/trống). */
export function mergeProductDetail(base: Product, patch: ProductDetailPatch): Product {
  const key = String(base.ma || '').trim().toUpperCase();
  if (!key) return base;
  return {
    ...base,
    ...patch,
    ma: base.ma,
    ten: patch.ten || base.ten,
    barcode: patch.barcode || base.barcode,
    giaVon: (patch.giaVon ?? 0) > 0 ? patch.giaVon! : base.giaVon,
    giaBan: (patch.giaBan ?? 0) > 0 ? patch.giaBan! : base.giaBan,
    giaChung: (patch.giaChung ?? 0) > 0 ? patch.giaChung! : base.giaChung || base.giaBan,
    giaSi: (patch.giaSi ?? 0) > 0 ? patch.giaSi! : base.giaSi,
    giaWeb: (patch.giaWeb ?? 0) > 0 ? patch.giaWeb! : base.giaWeb,
    ton: patch.ton != null ? patch.ton : base.ton,
    tonMin: patch.tonMin != null ? patch.tonMin : base.tonMin,
    tonMax: patch.tonMax != null ? patch.tonMax : base.tonMax,
    thuongHieu: patch.thuongHieu || base.thuongHieu,
    nhaCungCap: patch.nhaCungCap || base.nhaCungCap,
    viTri: patch.viTri || base.viTri,
    trongLuong: (patch.trongLuong ?? 0) > 0 ? patch.trongLuong : base.trongLuong,
    thanhPhan: patch.thanhPhan?.length ? patch.thanhPhan : base.thanhPhan,
    productFormulas: patch.productFormulas?.length ? patch.productFormulas : base.productFormulas,
    images: patch.images?.length ? patch.images : base.images,
    anh: patch.anh || base.anh,
    loai: patch.loai || base.loai,
    banTrucTiep: patch.banTrucTiep ?? base.banTrucTiep,
    tichDiem: patch.tichDiem ?? base.tichDiem,
  };
}

/** Tải chi tiết đầy đủ cho màn chi tiết SP/combo. */
export async function fetchProductDetailPatch(
  maRaw: string,
  catalog: Product[] = []
): Promise<ProductDetailPatch | null> {
  const ma = String(maRaw || '').trim();
  if (!ma) return null;

  try {
    const al = await getAlohaProduct(ma);
    if (al.ok && al.data) {
      const patch = mapAlohaToPatch(al.data);
      if (patch.ma || patch.ten) return patch;
    }
  } catch {
    /* fallback KV */
  }

  try {
    const cfg = localDb.getKiotVietConfig();
    if (!cfg?.clientId || !cfg?.clientSecret || !cfg?.retailer) return null;
    const token = await getKiotVietToken(cfg.clientId, cfg.clientSecret);
    const res = await fetch(
      `/kv-api/products/code/${encodeURIComponent(ma)}?${KV_DETAIL_QUERY}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Retailer: cfg.retailer,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return mapKvResponseToPatch(data, catalog);
  } catch {
    return null;
  }
}
