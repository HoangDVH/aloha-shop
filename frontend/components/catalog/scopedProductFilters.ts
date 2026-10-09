import type { ShopProduct, ShopFacets } from "@/lib/api";

export type ScopedFilters = { minPrice: string; maxPrice: string; dvts: string[]; attrs: string[] };
export const emptyScopedFilters = (): ScopedFilters => ({ minPrice: "", maxPrice: "", dvts: [], attrs: [] });

/** Match the price actually offered on the product card, including exhausted flash slots. */
export function scopedProductPrice(product: ShopProduct): number {
  const p = product.campaignPromo;
  if (p?.kind === "flash" && p.slotOpen && p.remaining !== 0 && p.salePrice != null && p.salePrice < p.listPrice) return p.salePrice;
  return Number(product.gia) || 0;
}

export function scopedProductFacets(products: ShopProduct[]): ShopFacets {
  const attributes = new Map<string, string[]>();
  for (const p of products) for (const a of p.attributes || []) {
    if (!a.attributeName || !a.attributeValue) continue;
    const values = attributes.get(a.attributeName) || [];
    if (!values.includes(a.attributeValue)) values.push(a.attributeValue);
    attributes.set(a.attributeName, values);
  }
  return { attributes: Object.fromEntries(attributes), dvt: [...new Set(products.map(p => p.dvt).filter(Boolean))] };
}

export function filterScopedProducts(products: ShopProduct[], filters: ScopedFilters, sort: string): ShopProduct[] {
  const groups = new Map<string, string[]>();
  for (const token of filters.attrs) {
    const colon = token.indexOf(":");
    if (colon < 0) continue;
    const name = token.slice(0, colon);
    groups.set(name, [...(groups.get(name) || []), token.slice(colon + 1)]);
  }
  const result = products.filter(p => {
    const price = scopedProductPrice(p);
    const badge = p.webBadge === "ban_chay" ? "ban_chay_sap_het" : p.webBadge;
    if (sort.startsWith("badge:") && badge !== sort.slice(6)) return false;
    return (!filters.minPrice || price >= Number(filters.minPrice)) &&
      (!filters.maxPrice || price <= Number(filters.maxPrice)) &&
      (!filters.dvts.length || filters.dvts.includes(p.dvt)) &&
      [...groups].every(([name, values]) => p.attributes?.some(a => a.attributeName === name && values.includes(a.attributeValue)));
  });
  if (sort === "price_asc" || sort === "price_desc") result.sort((a, b) => (scopedProductPrice(a) - scopedProductPrice(b)) * (sort === "price_desc" ? -1 : 1));
  if (sort === "giam_gia") result.sort((a, b) => {
    const discount = (p: ShopProduct) => {
      const anchor = Math.max(Number(p.webPrice) || 0, Number(p.campaignPromo?.listPrice) || 0, Number(p.campaignPromo?.compareAtPrice) || 0);
      return anchor > 0 ? Math.max(0, (anchor - scopedProductPrice(p)) / anchor) : 0;
    };
    return discount(b) - discount(a);
  });
  return result;
}

/** OR across selected groups, always within the current gift or campaign collection. */
export function filterScopedGroups(products: ShopProduct[], groups: string[]): ShopProduct[] {
  return products.filter(p => !groups.length || groups.includes(p.nhom));
}
