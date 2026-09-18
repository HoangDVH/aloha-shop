import type { Metadata } from "next";
import type { ShopProduct } from "@/lib/api";
import { parseNhomList } from "@/lib/parseNhom";
import { parseAttrList, parseDvtList } from "@/lib/parseShopFilters";

export const SHOP_ORIGIN = (
  process.env.NEXT_PUBLIC_SHOP_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://alohathegioichaucay.com"
).replace(/\/$/, "");

export const NOINDEX_FOLLOW: Metadata["robots"] = { index: false, follow: true };

export function plainText(raw: string): string {
  return String(raw || "")
    .replace(/&lt;br\s*\/?&gt;/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function absUrl(src: string): string {
  const s = String(src || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return `${SHOP_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
}

type CatalogSp = {
  q?: string;
  nhom?: string | string[];
  categoryId?: string | string[];
  attr?: string | string[];
  dvt?: string | string[];
  loai?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  page?: string;
  badge?: string;
};

function categoryIdCount(sp: CatalogSp): number {
  const raw = sp.categoryId;
  const out: number[] = [];
  const push = (x: unknown) => {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n));
  };
  if (Array.isArray(raw)) raw.forEach(push);
  else if (raw != null && String(raw).trim()) {
    String(raw)
      .split(/[,;\s]+/)
      .filter(Boolean)
      .forEach(push);
  }
  return new Set(out).size;
}

/**
 * URL catalog có query “lọc / phân trang / tìm” → noindex để tránh trùng nội dung.
 * Giữ index cho trang sạch (trang chủ, /tim, /danh-muc/slug ± categoryId|nhom đơn).
 */
export function shouldNoIndexCatalog(
  sp: CatalogSp,
  opts?: { defaultSort?: string; treatNhomAsFilter?: boolean }
): boolean {
  const defaultSort = opts?.defaultSort ?? "ten";
  const sort = String(sp.sort || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const nhomCount = parseNhomList(sp).length;
  const cidCount = categoryIdCount(sp);

  if (String(sp.q || "").trim()) return true;
  if (parseAttrList(sp).length) return true;
  if (parseDvtList(sp).length) return true;
  if (String(sp.loai || "").trim()) return true;
  if (String(sp.badge || "").trim()) return true;
  if (Number(sp.minPrice) > 0 || Number(sp.maxPrice) > 0) return true;
  if (String(sp.inStock || "") === "1") return true;
  if (page > 1) return true;
  if (sort && sort !== defaultSort) return true;
  if (opts?.treatNhomAsFilter && (nhomCount > 0 || cidCount > 0)) return true;
  if (nhomCount > 1 || cidCount > 1) return true;
  return false;
}

/** Schema.org Product — chỉ dữ liệu đã có trên SP, không đổi UI. */
export function buildProductJsonLd(item: ShopProduct, pageUrl: string) {
  const images = [
    ...new Set(
      [item.anh, ...(item.images || [])]
        .map((x) => absUrl(String(x || "")))
        .filter(Boolean)
    ),
  ];
  const desc =
    plainText(item.description || "").slice(0, 500) ||
    `${item.ten} tại ALOHA Thế Giới Chậu Cây`;
  const price = Math.round(Number(item.gia) || 0);
  const inStock = Number(item.ton) > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.ten,
    description: desc,
    sku: item.ma,
    mpn: item.ma,
    image: images.length ? images : undefined,
    brand: {
      "@type": "Brand",
      name: "ALOHA Thế Giới Chậu Cây",
    },
    offers: {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: "VND",
      price: String(price),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
