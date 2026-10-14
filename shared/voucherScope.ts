export type VoucherScope = {
  scope?: string;
  productMas?: string[];
  categoryIds?: string[];
  excludedProductMas?: string[];
  excludeFlash?: boolean;
};
export type VoucherScopeItem = { ma: string; categoryId?: string | number; flash?: boolean };
export function voucherFlashActive(p: { kind: string; slotOpen: boolean; remaining?: number | null;
  endsAt: string; salePrice?: number | null; listPrice: number } | null | undefined, now = Date.now()): boolean {
  return Boolean(p?.kind === "flash" && p.slotOpen && p.remaining !== 0 && Date.parse(p.endsAt) > now
    && Number(p.salePrice) > 0 && Number(p.salePrice) < p.listPrice);
}
const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase();

/** Identical product eligibility for public previews and server discount calculations. */
export function voucherItemInScope(item: VoucherScopeItem, voucher: VoucherScope): boolean {
  const ma = normalize(item.ma);
  if (!ma || (voucher.excludeFlash && item.flash)) return false;
  if (voucher.excludedProductMas?.some(code => normalize(code) === ma)) return false;
  if (voucher.scope === "all") return true;
  if (voucher.scope === "product") return Boolean(voucher.productMas?.some(code => normalize(code) === ma));
  if (voucher.scope === "category") {
    const categoryId = String(item.categoryId ?? "").trim();
    return Boolean(categoryId && voucher.categoryIds?.some(id => String(id).trim() === categoryId));
  }
  return false;
}
