import type { Db } from 'mongodb';
import { PROMOTIONS_COL, type PromotionDoc } from './types.js';

export async function ensurePublicProductVoucherIndex(db: Db): Promise<void> {
  await db.collection(PROMOTIONS_COL).createIndex({ status: 1, scope: 1, isPublic: 1 });
}

/** Public product vouchers may be advertised beside campaign-linked vouchers. */
export async function publicProductVouchers(db: Db, nowIso: string): Promise<PromotionDoc[]> {
  const rows = await db.collection<PromotionDoc>(PROMOTIONS_COL).find({
    status: 'active', isPublic: { $ne: false }, scope: 'product', targetCustomer: { $ne: 'wholesale' },
  }).toArray();
  return rows.filter(p => Array.isArray(p.productMas) && p.productMas.some(ma => String(ma).trim()) &&
    (!p.startDate || p.startDate <= nowIso) && (!p.endDate || p.endDate >= nowIso));
}
