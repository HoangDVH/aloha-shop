import type { Db } from 'mongodb';
import { shopFilterBase, toPublicProduct } from '../shopCatalog/catalog/publicProduct.js';

export function giftProductFilter(codes?: string[]): Record<string, unknown> {
  return {
    ...shopFilterBase(),
    deletedAt: null,
    ...(codes ? { ma: { $in: codes } } : {}),
  };
}

/** Preserve the administrator's selection order, omitting unavailable products. */
export async function loadGiftProducts(db: Db, codes: string[]) {
  if (!codes.length) return [];
  const docs = await db.collection('aloha_products').find(giftProductFilter(codes)).toArray();
  const byCode = new Map(docs.map((doc) => [String(doc.ma), doc]));
  return [...new Set(codes)].flatMap((code) => {
    const doc = byCode.get(code);
    return doc ? [toPublicProduct(doc)] : [];
  });
}
