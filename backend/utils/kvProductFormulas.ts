/**
 * Map hàng thành phần / thuộc tính lọc từ payload KiotViet.
 */
export type KvFormulaLine = {
  ma: string;
  ten: string;
  qty: number;
  giaBan: number;
  giaVon: number;
};

import { loaiLabelFromProduct, resolveKvTypeNum } from "./kvProductLoai";

function numPositive(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Giá vốn từ object KV (product / dòng formula) — inventories.cost như màn KV. */
function pickKvCost(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  let v = numPositive(
    obj.cost,
    obj.Cost,
    obj.giaVon,
    obj.materialCost,
    obj.MaterialCost,
    obj.giaNhap
  );
  if (v > 0) return v;
  const invs = obj.inventories || obj.Inventories;
  if (Array.isArray(invs)) {
    for (const inv of invs) {
      const c = numPositive(inv?.cost, inv?.Cost);
      if (c > 0) return c;
    }
  }
  return 0;
}

/** Giá bán từ object KV — basePrice / materialPrice hoặc bảng giá chung. */
function pickKvSale(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  let v = numPositive(
    obj.basePrice,
    obj.BasePrice,
    obj.materialPrice,
    obj.MaterialPrice,
    obj.giaBan,
    obj.giaChung,
    obj.price,
    obj.Price
  );
  const books = obj.priceBooks || obj.PriceBooks;
  if (Array.isArray(books)) {
    for (const b of books) {
      const price = numPositive(b?.price, b?.Price);
      if (price <= 0) continue;
      const clean = String(b?.priceBookName || b?.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      const compact = clean.replace(/\s+/g, "");
      if (
        clean.includes("chung") ||
        compact.includes("banggiachung") ||
        clean === "ban le" ||
        compact === "giale"
      ) {
        return price;
      }
      if (v <= 0) v = price;
    }
  }
  return v;
}

/** Còn dòng thành phần thiếu giá vốn hoặc giá bán (Mongo sync thiếu nested). */
export function formulasMissingComponentPrices(raw: any[] | null | undefined): boolean {
  if (!Array.isArray(raw) || !raw.length) return false;
  const lines = parseKvProductFormulas({ productFormulas: raw });
  if (!lines.length) return true;
  return lines.some((l) => l.giaVon <= 0 || l.giaBan <= 0);
}

/** productType KV: 1=Combo, 2=Hàng hóa, 3=Dịch vụ */
export function kvProductTypeLabel(type: unknown): string {
  const n = resolveKvTypeNum({ productType: type, type });
  if (n === 1) return "Combo - đóng gói";
  if (n === 3) return "Dịch vụ";
  if (n === 2) return "Hàng hóa thường";
  return "";
}

export function parseKvProductFormulas(raw: any): KvFormulaLine[] {
  const list = raw?.productFormulas || raw?.ProductFormulas || raw?.formulas || [];
  if (!Array.isArray(list) || !list.length) return [];
  const out: KvFormulaLine[] = [];
  for (const f of list) {
    const nested = f?.product || f?.Product || {};
    const ma = String(
      f?.materialCode ||
        f?.MaterialCode ||
        nested?.code ||
        nested?.Code ||
        f?.code ||
        ""
    ).trim();
    const ten = String(
      f?.materialFullName ||
        f?.MaterialFullName ||
        f?.materialName ||
        f?.MaterialName ||
        nested?.fullName ||
        nested?.name ||
        ma
    ).trim();
    const qty = Number(f?.quantity ?? f?.Quantity ?? 1) || 1;
    const giaBan = pickKvSale(f) || pickKvSale(nested);
    const giaVon = pickKvCost(nested) || pickKvCost(f);
    if (!ma && !ten) continue;
    out.push({ ma: ma || ten, ten: ten || ma, qty, giaBan, giaVon });
  }
  return out;
}

/** Gắn giá vốn/bán từ catalog (Mongo/local) vào dòng formula KV (thường thiếu cost). */
export function enrichFormulasWithCatalogPrices(
  formulas: any[] | null | undefined,
  catalog: Array<{
    ma?: string;
    code?: string;
    giaVon?: number;
    cost?: number;
    giaBan?: number;
    giaChung?: number;
    basePrice?: number;
    ten?: string;
    name?: string;
  }>
): any[] {
  if (!Array.isArray(formulas) || !formulas.length) return Array.isArray(formulas) ? formulas : [];
  const byMa = new Map<string, (typeof catalog)[number]>();
  for (const p of catalog || []) {
    const k = String(p?.ma || p?.code || "")
      .trim()
      .toUpperCase();
    if (k) byMa.set(k, p);
  }
  return formulas.map((f) => {
    if (!f || typeof f !== "object") return f;
    const nested = f.product && typeof f.product === "object" ? { ...f.product } : {};
    const ma = String(
      f.materialCode || f.MaterialCode || nested.code || nested.Code || f.code || ""
    )
      .trim()
      .toUpperCase();
    if (!ma) return f;
    const hit = byMa.get(ma);
    if (!hit) return f;
    // Ưu tiên giá hiện tại trên kho (Mongo/KV sync) — snapshot trên dòng formula KV thường thiếu/cũ.
    const catVon = numPositive(hit.giaVon, hit.cost);
    const catBan = numPositive(hit.giaBan, hit.giaChung, hit.basePrice);
    const curVon = pickKvCost(nested) || pickKvCost(f);
    const curBan = pickKvSale(f) || pickKvSale(nested);
    if (catVon <= 0 && catBan <= 0) return f;
    const product = { ...nested, code: nested.code || ma };
    const useVon = catVon > 0 ? catVon : curVon;
    const useBan = catBan > 0 ? catBan : curBan;
    if (useVon > 0) {
      product.cost = useVon;
      product.giaVon = useVon;
      if (!Array.isArray(product.inventories) || !product.inventories.length) {
        product.inventories = [{ cost: useVon, onHand: 0 }];
      } else {
        product.inventories = product.inventories.map((inv: any) => ({
          ...inv,
          cost: Number(inv?.cost) > 0 && catVon <= 0 ? inv.cost : useVon,
        }));
      }
    }
    if (useBan > 0) {
      product.basePrice = useBan;
      product.giaBan = useBan;
    }
    const ten = String(hit.ten || hit.name || "").trim();
    return {
      ...f,
      cost: useVon > 0 ? useVon : f.cost,
      basePrice: useBan > 0 ? useBan : f.basePrice ?? f.materialPrice,
      materialPrice: useBan > 0 ? useBan : f.materialPrice ?? f.basePrice,
      materialFullName: f.materialFullName || ten || undefined,
      product,
    };
  });
}

/** Chuỗi lưu trên Product.thanhPhan: "MA × qty" (tương thích parser cũ). */
export function formulasToThanhPhanLines(raw: any): string[] {
  return parseKvProductFormulas(raw).map((r) =>
    r.qty !== 1 ? `${r.ma} × ${r.qty}` : r.ma
  );
}

export function mapKvFilterExtras(p: any): {
  thanhPhan?: string[];
  productFormulas?: any[];
  productType?: number;
  type?: number;
  hasFormula?: boolean;
  isProcessedGoods?: boolean;
  banTrucTiep?: boolean;
  tichDiem?: boolean;
  loai?: string;
  isActive?: boolean;
} {
  const formulasRaw = p?.productFormulas || p?.ProductFormulas || p?.formulas || [];
  const productFormulas = Array.isArray(formulasRaw) ? formulasRaw : [];
  const thanhPhan = formulasToThanhPhanLines({
    ...p,
    productFormulas,
  });
  const productType = resolveKvTypeNum(p) ?? undefined;
  const isProcessedGoods =
    p?.isProcessedGoods === true ||
    p?.IsProcessedGoods === true ||
    p?.isProcessGoods === true ||
    undefined;
  const hasFormula =
    thanhPhan.length > 0 ||
    productFormulas.length > 0 ||
    isProcessedGoods === true ||
    p?.hasFormula === true;
  const typeLabel =
    loaiLabelFromProduct({
      ...p,
      productType,
      type: productType,
      thanhPhan: thanhPhan.length ? thanhPhan : p?.thanhPhan,
      productFormulas,
      hasFormula,
      isProcessedGoods,
    }) || kvProductTypeLabel(productType);
  const allows =
    p?.allowsSale != null
      ? !!p.allowsSale
      : p?.AllowsSale != null
        ? !!p.AllowsSale
        : undefined;
  const reward =
    p?.isRewardPoint != null
      ? !!p.isRewardPoint
      : p?.isPoint != null
        ? !!p.isPoint
        : p?.rewardPoint != null
          ? !!p.rewardPoint
          : undefined;
  const active =
    p?.isActive != null
      ? !!p.isActive
      : p?.IsActive != null
        ? !!p.IsActive
        : undefined;

  return {
    thanhPhan: thanhPhan.length ? thanhPhan : undefined,
    productFormulas: productFormulas.length ? productFormulas : undefined,
    productType: productType && productType > 0 ? productType : undefined,
    type: productType && productType > 0 ? productType : undefined,
    hasFormula: hasFormula || undefined,
    isProcessedGoods: isProcessedGoods || undefined,
    banTrucTiep: allows,
    tichDiem: reward,
    loai: typeLabel || undefined,
    isActive: active,
  };
}
