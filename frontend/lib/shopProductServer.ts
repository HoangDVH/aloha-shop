import { cache } from "react";
import { fetchProductByMa, fetchProducts, resolveProductPath } from "@/lib/api";

/** Gộp request metadata + page trong cùng lần render (React cache). */
export const getProductByPath = cache(async (path: string) => {
  return resolveProductPath(path);
});

export const getProductByMa = cache(async (ma: string) => {
  return fetchProductByMa(ma);
});

export async function fetchRelatedProducts(nhom: string, ma: string) {
  if (!nhom) return [];
  try {
    const rel = await fetchProducts(
      {
        nhom,
        limit: 10,
        sort: "ban_chay",
      },
      { revalidate: 30 }
    );
    return rel.items.filter((p) => p.ma !== ma).slice(0, 8);
  } catch {
    return [];
  }
}
