import type { Db } from "mongodb";
import { normalizeAttrs } from "./keys.js";
import { findAttrSiblings } from "./siblings.js";

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
