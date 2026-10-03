import type { Db } from "mongodb";
import { loadPriceBooksByMa, overlayDocsWithPriceBooks, publicPrice } from "../../shopCatalog/priceOverlay.js";
import { deriveNhomPath, publicTon } from "../../shopCatalog/catalog/publicProduct.js";
import { loadCategoryMetaById, overlayProductCategoryFieldsMany } from "../../shopCatalog/categoryMeta.js";
import { subtractHeldFromPublicItems } from "../../shopOrders/stockHold.js";

/** Số liệu admin cần khi soạn chiến dịch; giá vốn chỉ trả cho route admin. `nhomPath`: "Cha >> Con" theo cây KiotViet. */
export type ProductFacts = { ma: string; ten: string; listPrice: number; cost: number; stock: number; nhomPath: string };

export async function loadProductFacts(db: Db, rawMas: string[]): Promise<Map<string, ProductFacts>> {
  const mas = [...new Set(rawMas.map((m) => String(m || "").trim().toUpperCase()).filter(Boolean))];
  if (!mas.length) return new Map();
  const [rawDocs, books, categories] = await Promise.all([
    db
      .collection("aloha_products")
      .find(
        { deletedAt: null, ma: { $in: mas } },
        {
          projection: {
            ma: 1, ten: 1, giaWeb: 1, giaBan: 1, giaChung: 1, basePrice: 1, priceBooks: 1,
            ton: 1, onHand: 1, kvTon: 1, giaVon: 1,
            categoryId: 1, categoryName: 1, ancestor: 1, nhom: 1, nhomPath: 1,
          },
        }
      )
      .toArray(),
    loadPriceBooksByMa(db, mas),
    loadCategoryMetaById(db),
  ]);
  const docs = overlayProductCategoryFieldsMany(rawDocs as Record<string, unknown>[], categories);
  const priced = overlayDocsWithPriceBooks(docs, books);
  const items = priced.map((d) => ({ ma: String(d.ma).toUpperCase(), ten: String(d.ten || d.ma), ton: publicTon(d) }));
  const available = new Map((await subtractHeldFromPublicItems(db, items)).map((i) => [i.ma, i.ton]));
  const out = new Map<string, ProductFacts>();
  for (const d of priced) {
    const ma = String(d.ma).toUpperCase();
    const cost = Number(d.giaVon) || Number(books.get(ma)?.giaVon) || 0;
    out.set(ma, {
      ma,
      ten: String(d.ten || ma),
      listPrice: publicPrice(d),
      cost: Math.max(0, Math.round(cost)),
      stock: available.get(ma) ?? 0,
      nhomPath: deriveNhomPath(d),
    });
  }
  return out;
}
