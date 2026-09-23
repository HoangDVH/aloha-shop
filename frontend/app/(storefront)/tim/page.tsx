import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { fetchSessionProducts } from "@/lib/shopCatalogSessionServer";
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
  maxTon?: string;
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
  if (shouldNoIndexCatalog(sp, { defaultSort: "ban_chay", treatNhomAsFilter: true })) {
    return { robots: NOINDEX_FOLLOW };
  }
  return {
    title: "Tất cả sản phẩm",
    description:
      "Danh mục toàn bộ sản phẩm tại ALOHA THẾ GIỚI CHẬU CÂY — chậu cây, cây cảnh, phụ kiện.",
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
  const maxTon = Math.max(0, Math.min(999, Number(sp.maxTon) || 0));
  const sort = String(sp.sort || "ban_chay");
  const badgeRaw = String(sp.badge || "").trim();
  const badge =
    badgeRaw === "noi_bat" ||
    badgeRaw === "ban_chay_sap_het" ||
    badgeRaw === "giam_gia" ||
    badgeRaw === "dat_truoc" ||
    badgeRaw === "moi" ||
    badgeRaw === "ban_chay"
      ? (badgeRaw as
          | "noi_bat"
          | "ban_chay_sap_het"
          | "giam_gia"
          | "dat_truoc"
          | "moi"
          | "ban_chay")
      : undefined;

  let items: Awaited<ReturnType<typeof fetchSessionProducts>>["items"] = [];
  let total = 0;
  let pages = 1;
  let err = "";
  let effectiveSort = sort;
  let effectiveBadge = badge;

  try {
    let prod = await fetchSessionProducts({
      q: q || undefined,
      nhom: nhomList.length ? nhomList : undefined,
      attr: attrList.length ? attrList : undefined,
      dvt: dvtList.length ? dvtList : undefined,
      loai: loai || undefined,
      page,
      limit: 25,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStock || undefined,
      maxTon: maxTon > 0 ? maxTon : undefined,
      sort,
      badge,
    });
    // /tim?badge=ban_chay: nếu chưa gắn nhãn tay → fallback xếp theo doanh thu
    // (cùng logic mục «Sản phẩm bán chạy» trên trang chủ)
    if (
      badge === "ban_chay" &&
      !(prod.items || []).length &&
      !q &&
      !nhomList.length &&
      !attrList.length &&
      !dvtList.length &&
      !loai &&
      !minPrice &&
      !maxPrice &&
      !inStock &&
      !(maxTon > 0)
    ) {
      prod = await fetchSessionProducts({
        page,
        limit: 25,
        sort: "ban_chay",
      });
      effectiveSort = "ban_chay";
      effectiveBadge = undefined;
    }
    items = prod.items;
    total = prod.total;
    pages = prod.pages;
  } catch (e: any) {
    err = e?.message || "Lỗi tải";
  }

  const pageTitle = q
    ? undefined
    : effectiveBadge === "noi_bat"
      ? "Sản phẩm nổi bật"
      : maxTon > 0 && (effectiveSort === "ban_chay" || sort === "ban_chay")
        ? "Sản phẩm đang bán chạy - sắp hết"
        : effectiveBadge === "moi" || sort === "moi" || sort === "newest"
          ? "Sản phẩm mới"
          : effectiveBadge === "giam_gia"
            ? "Sản phẩm giảm giá"
            : effectiveBadge === "dat_truoc"
              ? "Sản phẩm đặt trước"
              : effectiveBadge === "ban_chay_sap_het" ||
                  effectiveBadge === "ban_chay"
                ? "Sản phẩm bán chạy và sắp hết"
                : !effectiveBadge && !q
                  ? "Tất cả sản phẩm"
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
