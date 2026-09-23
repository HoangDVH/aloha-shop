import "server-only";
import { cookies } from "next/headers";
import { fetchProducts, shopApiBase, type ShopProduct } from "./api";

/** Never forward browser cookies to an arbitrary URL; only the configured shop backend. */
export async function shopSessionHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const token = jar.get("shop_access")?.value;
  return token ? { Cookie: `shop_access=${encodeURIComponent(token)}` } : {};
}
export async function fetchSessionProducts(opts: Parameters<typeof fetchProducts>[0], _cache?: unknown) {
  return fetchProducts(opts, { cache: "no-store", headers: await shopSessionHeaders() });
}
export async function getSessionProductByPath(path: string): Promise<{ item: ShopProduct }> {
  const response = await fetch(`${shopApiBase()}/api/shop/resolve?path=${encodeURIComponent(path)}`, {
    cache: "no-store", headers: await shopSessionHeaders(),
  });
  if (!response.ok) throw new Error("Không tải được sản phẩm");
  return response.json();
}
