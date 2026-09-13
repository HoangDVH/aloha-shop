import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { fetchProducts } from "@/lib/api";
import { parseNhomList } from "@/lib/parseNhom";
import { parseAttrList, parseDvtList } from "@/lib/parseShopFilters";
import { ProductGrid } from "@/components/ProductCard";
import { CatalogLayout } from "@/components/CatalogLayout";
import { NOINDEX_FOLLOW, shouldNoIndexCatalog } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TimSp = {
  q?: string;
  page?: string;
  nhom?: string | string[];
  attr?: string | string[];
  dvt?: string | string[];
  loai?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  badge?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<TimSp>;
}): Promise<Metadata> {
  const sp = await searchParams;
  // /tim sạch vẫn index; mọi query lọc/tìm/page → noindex.
  if (shouldNoIndexCatalog(sp, { defaultSort: "ten", treatNhomAsFilter: true })) {
    return { robots: NOINDEX_FOLLOW };
  }
  return {
    title: "Tất cả sản phẩm",
    description:
      "Danh mục toàn bộ sản phẩm tại ALOHA Thế Giới Chậu Cây — chậu cây, cây cảnh, phụ kiện.",
  };
}

async function CatalogBody({
  searchParams,
}: {
  searchParams: Promise<TimSp>;
}) {
  const sp = await searchParams;
  const q = String(sp.q || "").trim();
  const nhomList = parseNhomList(sp);
  const attrList = parseAttrList(sp);
  const dvtList = parseDvtList(sp);
  const loai = String(sp.loai || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const minPrice = Number(sp.minPrice) || 0;
  const maxPrice = Number(sp.maxPrice) || 0;
  const inStock = String(sp.inStock || "") === "1";
  const sort = String(sp.sort || "ten");
  const badgeRaw = String(sp.badge || "").trim();
  const badge =
    badgeRaw === "ban_chay" || badgeRaw === "moi" || badgeRaw === "noi_bat"
      ? (badgeRaw as "ban_chay" | "moi" | "noi_bat")
      : undefined;

  let items: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let total = 0;
  let pages = 1;
  let err = "";

  try {
    const prod = await fetchProducts({
      q: q || undefined,
      nhom: nhomList.length ? nhomList : undefined,
      attr: attrList.length ? attrList : undefined,
      dvt: dvtList.length ? dvtList : undefined,
      loai: loai || undefined,
      page,
      limit: 24,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStock || undefined,
      sort,
      badge,
    });
    items = prod.items;
    total = prod.total;
    pages = prod.pages;
  } catch (e: any) {
    err = e?.message || "Lỗi tải";
  }

  const pageTitle = q
    ? undefined
    : badge === "moi"
      ? "Sản phẩm mới"
      : badge === "noi_bat"
        ? "Sản phẩm nổi bật"
        : badge === "ban_chay"
          ? "Sản phẩm bán chạy"
          : sort === "ban_chay"
            ? "Sản phẩm bán chạy"
            : sort === "price_asc"
              ? "Giá thấp → cao"
              : sort === "price_desc"
                ? "Giá cao → thấp"
                : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <CatalogLayout
        total={total}
        page={page}
        pages={pages}
        title={pageTitle}
      >
        {err ? <p className="mb-4 text-sm text-amber-800">{err}</p> : null}
        <ProductGrid products={items} shopee />
      </CatalogLayout>
    </div>
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<TimSp>;
}) {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <CatalogBody searchParams={searchParams} />
    </Suspense>
  );
}
