/**
 * Price overlay, buyer email detection, and display ton enrichment.
 */
import type { Db } from "mongodb";
import type { Request } from "express";
import { COL } from "./types.js";
import { toPublicProduct } from "./publicProduct.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFieldsMany,
} from "../categoryMeta.js";
import {
  loadPriceBooksByMa,
  overlayDocsWithPriceBooks,
} from "../priceOverlay.js";
import {
  isComboOrFormulaProduct,
  resolveShopDisplayTon,
} from "../../shopVariantGroup.js";
import { subtractHeldFromPublicItems } from "../../shopOrders/stockHold.js";
import { isShopTestBuyerEmail } from "../../shopOrders/checkoutFlags.js";
import {
  ACCESS_COOKIE,
  verifyShopAccessToken,
} from "../../shopAuth/tokens.js";

export async function mapDocsToPublicWithPriceBooks(
  db: Db,
  docs: Record<string, unknown>[]
): Promise<{
  docs: Record<string, unknown>[];
  items: ReturnType<typeof toPublicProduct>[];
}> {
  const metaById = await loadCategoryMetaById(db);
  const withCat = overlayProductCategoryFieldsMany(docs, metaById);
  const mas = withCat.map((d) => String(d.ma || "").trim()).filter(Boolean);
  const pbByMa = await loadPriceBooksByMa(db, mas);
  const overlaid = overlayDocsWithPriceBooks(withCat, pbByMa);
  const items = overlaid.map((d) => toPublicProduct(d));
  const enriched = await enrichListDisplayTons(db, overlaid, items);
  return { docs: overlaid, items: enriched };
}

/** Listing: combo/công thức thường ton=0 trên Mongo — resolve tồn bán được như PDP. */
export async function enrichListDisplayTons(
  db: Db,
  docs: Record<string, unknown>[],
  items: ReturnType<typeof toPublicProduct>[]
): Promise<ReturnType<typeof toPublicProduct>[]> {
  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of docs) {
    const ma = String(d.ma || "")
      .trim()
      .toUpperCase();
    if (ma) byMa.set(ma, d);
  }
  const out = items.slice();
  await Promise.all(
    out.map(async (p, i) => {
      const doc = byMa.get(String(p.ma || "").trim().toUpperCase());
      if (!doc || !isComboOrFormulaProduct(doc)) return;
      if (p.ton > 0) return;
      try {
        const ton = await resolveShopDisplayTon(db, COL, doc);
        if (ton !== p.ton) out[i] = { ...p, ton };
      } catch {
        /* giữ ton thô */
      }
    })
  );
  // Có thể bán = ton − soft-hold (giống sàn TMĐT).
  return subtractHeldFromPublicItems(db, out);
}

/** Email từ cookie phiên shop — dùng ẩn/hiện SP giá 0đ (test). */
export function requestShopBuyerEmail(req: Request): string {
  try {
    const token = String(req.cookies?.[ACCESS_COOKIE] || "").trim();
    if (!token) return "";
    return String(verifyShopAccessToken(token).email || "").trim();
  } catch {
    return "";
  }
}

export function filterZeroPriceUnlessTestBuyer<
  T extends { gia: number; priceKind?: string }
>(items: T[], buyerEmail: string): T[] {
  if (isShopTestBuyerEmail(buyerEmail)) return items;
  return items.filter((p) => Number(p.gia) > 0 || p.priceKind === "si_missing");
}
