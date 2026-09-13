import type { PriceUpdateItem, Product } from '../services/database';
import type { ChungTuSanPham } from './chungTuSpreadsheet';
import { normalizeString } from './helpers';

export type PriceChungTuApplyOpts = {
  rateSi: number;
  rateChung: number;
  rateWeb: number;
  ncc?: string;
  maDon?: string;
  readCatalogOldPrice: (ma: string, tier: 'si' | 'chung' | 'web') => number;
  readSavedProductNote?: (ma: string) => string;
  readProductTon?: (p: Product) => number;
};

function parsePositive(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function matchProduct(sp: ChungTuSanPham, products: Product[]): Product | undefined {
  const sku = String(sp.ma || sp.sku || '').trim();
  if (sku) {
    const norm = normalizeString(sku);
    const byMa = products.find((p) => normalizeString(p.ma) === norm);
    if (byMa) return byMa;
  }
  const normName = normalizeString(sp.ten || '');
  if (!normName || normName.length < 3) return undefined;
  const exact = products.find((p) => normalizeString(p.ten) === normName);
  if (exact) return exact;
  if (normName.length >= 8) {
    return products.find((p) => {
      const pn = normalizeString(p.ten);
      return pn.length >= 8 && (pn.includes(normName) || normName.includes(pn));
    });
  }
  return undefined;
}

function buildRowItem(
  sp: ChungTuSanPham,
  prod: Product | undefined,
  opts: PriceChungTuApplyOpts
): PriceUpdateItem | null {
  const ten = String(sp.ten || '').trim();
  if (!ten) return null;

  const ma = prod?.ma || String(sp.ma || sp.sku || '').trim() || `SPM-${normalizeString(ten).slice(0, 6).toUpperCase() || 'HANG'}`;
  console.log(prod);
  const gvHt = prod ? parsePositive(prod.giaVon) || parsePositive(prod.giaNhap) : 0;

  // Giá cũ: ưu tiên từ overlay (đã lưu/đồng bộ) → fallback thẳng từ Product catalog
  const giaSiCu = opts.readCatalogOldPrice(ma, 'si') || parsePositive(prod?.giaSi);
  const giaChungCu = opts.readCatalogOldPrice(ma, 'chung') || parsePositive(prod?.giaChung) || parsePositive(prod?.giaBan);
  const giaWebCu = opts.readCatalogOldPrice(ma, 'web') || parsePositive(prod?.giaWeb);

  const fileGv = parsePositive(sp.donGia);
  const gvMoi = fileGv > 0 ? fileGv : gvHt;

  const fileSi = parsePositive(sp.si);
  const fileChung = parsePositive(sp.chung);
  const fileWeb = parsePositive(sp.web);

  const formulaSi = gvMoi > 0 ? Math.round(gvMoi * (1 + opts.rateSi / 100)) : 0;
  const formulaChung = gvMoi > 0 ? Math.round(gvMoi * (1 + opts.rateChung / 100)) : 0;
  const formulaWeb =
    gvMoi > 0
      ? Math.round(formulaChung * (1 + opts.rateWeb / 100))
      : 0;

  const isSiEdited = fileSi > 0;
  const isChungEdited = fileChung > 0;
  const isWebEdited = fileWeb > 0;

  const si = fileSi > 0 ? fileSi : formulaSi > 0 ? formulaSi : giaSiCu;
  const chung = fileChung > 0 ? fileChung : formulaChung > 0 ? formulaChung : giaChungCu;
  const web = fileWeb > 0 ? fileWeb : formulaWeb > 0 ? formulaWeb : giaWebCu > 0 ? giaWebCu : Math.round(chung * (1 + opts.rateWeb / 100));

  return {
    ma,
    ten: prod?.ten || ten,
    giaVonHienTai: gvHt,
    giaVonMoi: gvMoi,
    giaHoaDon: fileGv > 0 ? fileGv : undefined,
    si,
    chung,
    web,
    siPct: gvMoi > 0 && si > 0 ? Math.round(((si - gvMoi) / gvMoi) * 1000) / 10 : opts.rateSi,
    chungPct: gvMoi > 0 && chung > 0 ? Math.round(((chung - gvMoi) / gvMoi) * 1000) / 10 : opts.rateChung,
    webPct: gvMoi > 0 && web > 0 ? Math.round(((web - gvMoi) / gvMoi) * 1000) / 10 : opts.rateWeb,
    duyet: false,
    maDon: opts.maDon || 'Nhập chứng từ',
    ncc: opts.ncc || '—',
    isSiEdited,
    isChungEdited,
    isWebEdited,
    giaSiCu,
    giaChungCu,
    giaWebCu,
    ghiChu: opts.readSavedProductNote?.(ma) || '',
    ton: prod && opts.readProductTon ? opts.readProductTon(prod) : prod?.ton,
    sl: sp.sl,
  };
}

/** Gộp chứng từ vào bảng giá — giá cũ từ Mongo, giá file → cột mới. */
export function mergeChungTuIntoPriceItems(
  existing: PriceUpdateItem[],
  sanPham: ChungTuSanPham[],
  products: Product[],
  opts: PriceChungTuApplyOpts
): { items: PriceUpdateItem[]; added: number; updated: number; skipped: number } {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const map = new Map<string, PriceUpdateItem>();
  for (const it of existing) {
    const k = String(it.ma || '').trim().toUpperCase();
    if (k) map.set(k, it);
  }

  for (const sp of sanPham) {
    const prod = matchProduct(sp, products);
    const built = buildRowItem(sp, prod, opts);
    if (!built) {
      skipped += 1;
      continue;
    }
    const k = built.ma.trim().toUpperCase();
    const prev = map.get(k);
    if (prev) {
      map.set(k, {
        ...prev,
        giaVonMoi: built.giaVonMoi,
        giaHoaDon: built.giaHoaDon,
        si: built.si,
        chung: built.chung,
        web: built.web,
        siPct: built.siPct,
        chungPct: built.chungPct,
        webPct: built.webPct,
        isSiEdited: built.isSiEdited || prev.isSiEdited,
        isChungEdited: built.isChungEdited || prev.isChungEdited,
        isWebEdited: built.isWebEdited || prev.isWebEdited,
        // Giá cũ: ưu tiên prev nếu đã có (tránh mất khi built trả 0)
        giaSiCu: built.giaSiCu || prev.giaSiCu,
        giaChungCu: built.giaChungCu || prev.giaChungCu,
        giaWebCu: built.giaWebCu || prev.giaWebCu,
        giaVonHienTai: built.giaVonHienTai || prev.giaVonHienTai,
        ncc: opts.ncc || prev.ncc,
        maDon: opts.maDon || prev.maDon,
        sl: sp.sl ?? prev.sl,
      });
      updated += 1;
    } else {
      map.set(k, built);
      added += 1;
    }
  }

  const existingKeys = new Set(existing.map((it) => it.ma.trim().toUpperCase()));
  const updatedExisting = existing.map((it) => {
    const k = it.ma.trim().toUpperCase();
    return (k && map.get(k)) || it;
  });
  const newItems: PriceUpdateItem[] = [];
  for (const [k, it] of map) {
    if (!existingKeys.has(k)) newItems.push(it);
  }

  return { items: [...newItems, ...updatedExisting], added, updated, skipped };
}
