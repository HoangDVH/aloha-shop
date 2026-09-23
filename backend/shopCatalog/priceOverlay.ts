/**
 * Overlay giá web (price book + override) — chỉ đọc Mongo, không ghi.
 * Dùng bởi catalog API và tạo đơn shop.
 */
import type { Db } from "mongodb";
import type { PriceMode } from "../shopWholesale/policy.js";

const PRICE_BOOKS_COL = "aloha_price_books";
const OVERRIDES_COL = "noibo_products_overrides";

function normPriceBookName(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
}

/** Đọc giá từ mảng priceBooks trên doc SP — chỉ đọc. */
function priceFromEmbeddedBooks(
  doc: Record<string, unknown>,
  want: "web" | "chung" | "si"
): number {
  const books = Array.isArray(doc.priceBooks) ? (doc.priceBooks as any[]) : [];
  for (const b of books) {
    const compact = normPriceBookName(String(b?.priceBookName || b?.name || ""));
    const price = Number(b?.price ?? b?.Price ?? 0) || 0;
    if (price <= 0) continue;
    if (want === "web") {
      if (compact === "web" || compact === "giaweb" || compact.includes("giaweb")) return price;
    } else if (want === "si") {
      if (compact === "si" || compact === "giasi" || compact.includes("giasi")) return price;
    } else if (
      compact.includes("chung") ||
      compact.includes("banggiachung") ||
      compact === "banle" ||
      compact === "giale"
    ) {
      return price;
    }
  }
  return 0;
}

/** Giá công khai shop — ưu tiên giaWeb (sau overlay price book / override). */
export function publicPrice(doc: Record<string, unknown>): number {
  const w = Number(doc.giaWeb) || 0;
  if (w > 0) return w;
  const fromBooks = priceFromEmbeddedBooks(doc, "web");
  if (fromBooks > 0) return fromBooks;
  const b = Number(doc.giaBan) || 0;
  if (b > 0) return b;
  const c = Number(doc.giaChung) || 0;
  if (c > 0) return c;
  const chungBook = priceFromEmbeddedBooks(doc, "chung");
  if (chungBook > 0) return chungBook;
  return Number(doc.basePrice) || 0;
}

export function wholesalePrice(doc: Record<string, unknown>): number {
  const direct = Number(doc.giaSi);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  return Math.max(0, Math.round(priceFromEmbeddedBooks(doc, "si")));
}

export function resolveShopPrice(doc: Record<string, unknown>, mode: PriceMode) {
  if (mode === "web") return { gia: publicPrice(doc), priceKind: "web" as const };
  const gia = wholesalePrice(doc);
  return { gia, priceKind: gia > 0 ? "si" as const : "si_missing" as const };
}

/**
 * Overlay giá từ aloha_price_books / noibo_products_overrides — không ghi Mongo.
 * Chỉ bổ sung khi field trên SP đang trống/0 — không đè giá web NV vừa sửa trên Hàng hóa.
 */
export function applyPriceBookOverlay(
  doc: Record<string, unknown>,
  pb: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const next = { ...doc };
  if (pb) {
    const pbWeb = Number(pb.giaWeb) || 0;
    const pbSi = Number(pb.giaSi) || 0;
    const pbChung = Number(pb.bangGiaChung) || Number(pb.giaChung) || 0;
    if (!(Number(next.giaWeb) > 0) && pbWeb > 0) next.giaWeb = pbWeb;
    if (!(Number(next.giaSi) > 0) && pbSi > 0) next.giaSi = pbSi;
    if (pbChung > 0) {
      if (!(Number(next.giaChung) > 0)) next.giaChung = pbChung;
      if (!(Number(next.giaBan) > 0)) next.giaBan = pbChung;
    }
  }
  if (!(Number(next.giaWeb) > 0)) {
    const emb = priceFromEmbeddedBooks(next, "web");
    if (emb > 0) next.giaWeb = emb;
  }
  return next;
}

/** Batch đọc price books + overrides theo mã — chỉ đọc. */
export async function loadPriceBooksByMa(
  db: Db,
  mas: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const uniq = [
    ...new Set(
      mas
        .map((m) => String(m || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  const out = new Map<string, Record<string, unknown>>();
  if (!uniq.length) return out;
  const lower = uniq.map((m) => m.toLowerCase());
  const [rows, ovRows] = await Promise.all([
    db
      .collection(PRICE_BOOKS_COL)
      .find({
        $or: [
          { maHang: { $in: uniq } },
          { maHang: { $in: lower } },
          { ma: { $in: uniq } },
          { ma: { $in: lower } },
        ],
      } as any)
      .project({ maHang: 1, ma: 1, giaWeb: 1, giaSi: 1, bangGiaChung: 1, giaVon: 1 })
      .limit(Math.min(500, uniq.length * 2))
      .toArray(),
    db
      .collection(OVERRIDES_COL)
      .find({
        $or: [
          { _id: { $in: uniq as any[] } },
          { _id: { $in: lower as any[] } },
          { id: { $in: uniq } },
          { id: { $in: lower } },
          { ma: { $in: uniq } },
          { ma: { $in: lower } },
        ],
      } as any)
      .project({ giaWeb: 1, giaSi: 1, giaChung: 1, giaBan: 1, id: 1, ma: 1 })
      .limit(Math.min(500, uniq.length * 2))
      .toArray(),
  ]);
  for (const r of rows) {
    const key = String((r as any).maHang || (r as any).ma || "")
      .trim()
      .toUpperCase();
    if (key && !out.has(key)) out.set(key, r as Record<string, unknown>);
  }
  for (const r of ovRows) {
    const key = String((r as any)._id || (r as any).id || (r as any).ma || "")
      .trim()
      .toUpperCase();
    if (!key) continue;
    const cur = { ...(out.get(key) || {}) };
    const ovWeb = Number((r as any).giaWeb) || 0;
    const ovSi = Number((r as any).giaSi) || 0;
    const ovChung =
      Number((r as any).giaChung) || Number((r as any).giaBan) || 0;
    if (!(Number(cur.giaWeb) > 0) && ovWeb > 0) cur.giaWeb = ovWeb;
    if (!(Number(cur.giaSi) > 0) && ovSi > 0) cur.giaSi = ovSi;
    if (!(Number(cur.bangGiaChung) > 0) && ovChung > 0) cur.bangGiaChung = ovChung;
    out.set(key, cur);
  }
  return out;
}

export function overlayDocsWithPriceBooks(
  docs: Record<string, unknown>[],
  pbByMa: Map<string, Record<string, unknown>>
): Record<string, unknown>[] {
  return docs.map((d) => {
    const ma = String(d.ma || d.maHang || "").trim().toUpperCase();
    return applyPriceBookOverlay(d, ma ? pbByMa.get(ma) : null);
  });
}
