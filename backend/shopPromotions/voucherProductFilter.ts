import type { Db } from "mongodb";
import { PROMOTIONS_COL, type PromotionDoc } from "./types.js";

const ID_RX = /^[\w-]{1,80}$/;
const NO_PRODUCTS = { ma: { $in: [] as string[] } };

export type VoucherProductScope = { title: string; filter: Record<string, unknown> };

export function parseVoucherQuery(raw: unknown): string {
  const id = String(raw ?? "").trim();
  return ID_RX.test(id) ? id : "";
}

const upperMas = (list: string[] | undefined) =>
  [...new Set((list || []).map((m) => String(m || "").trim().toUpperCase()).filter(Boolean))];

/**
 * Lọc SP cho nút "Dùng ngay" (`/tim?voucher=`): cùng phạm vi với bộ tính voucher — theo mã SP,
 * theo nhóm (đúng `categoryId`, không lấy nhóm con) hoặc tất cả, trừ SP loại trừ.
 * Voucher không còn chạy → không SP nào.
 */
export async function voucherProductFilter(db: Db, id: string): Promise<VoucherProductScope> {
  const p = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .findOne(
      { id, status: "active" },
      { projection: { title: 1, scope: 1, productMas: 1, categoryIds: 1, excludedProductMas: 1 } }
    );
  if (!p) return { title: "", filter: NO_PRODUCTS };
  const and: Record<string, unknown>[] = [];
  const excluded = upperMas(p.excludedProductMas);
  if (excluded.length) and.push({ ma: { $nin: excluded } });
  if (p.scope === "product") {
    and.push({ ma: { $in: upperMas(p.productMas) } });
  } else if (p.scope === "category") {
    const ids = (p.categoryIds || []).map((c) => String(c).trim()).filter(Boolean);
    const nums = ids.map(Number).filter((n) => Number.isFinite(n));
    and.push({ categoryId: { $in: [...ids, ...nums] } });
  }
  return { title: p.title || "", filter: and.length ? { $and: and } : {} };
}
