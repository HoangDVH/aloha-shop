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
  voucher?: string;
};

const VOUCHER_ID_RX = /^[\w-]{1,80}$/;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<TimSp>;
}): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.voucher) return { title: "Sản phẩm áp dụng voucher", robots: NOINDEX_FOLLOW };
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
  const voucherRaw = String(sp.voucher || "").trim();
  const voucher = VOUCHER_ID_RX.test(voucherRaw) ? voucherRaw : "";
  const badgeRaw = String(sp.badge || "").trim();
  const badge =
    badgeRaw === "noi_bat" ||
    badgeRaw === "ban_chay_sap_het" ||
    badgeRaw === "giam_gia" ||
    badgeRaw === "dat_truoc" ||
    badgeRaw === "moi" ||
    badgeRaw === "uu_dai" ||
    badgeRaw === "ban_chay"
      ? (badgeRaw as
          | "noi_bat"
          | "ban_chay_sap_het"
          | "giam_gia"
          | "dat_truoc"
          | "moi"
          | "uu_dai"
          | "ban_chay")
      : undefined;

  let items: Awaited<ReturnType<typeof fetchSessionProducts>>["items"] = [];
  let total = 0;
  let pages = 1;
  let err = "";
  let effectiveSort = sort;
  let effectiveBadge = badge;
  let voucherTitle = "";

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
      voucher: voucher || undefined,
    });
    voucherTitle = prod.voucher?.title || "";
    // /tim?badge=ban_chay: nếu chưa gắn nhãn tay → fallback xếp theo doanh thu
    // (cùng logic mục «Sản phẩm bán chạy» trên trang chủ)
    if (
      badge === "ban_chay" &&
      !voucher &&
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
    // /tim?badge=uu_dai: nếu ít hơn 4 SP → bổ sung thêm SP bán chạy/sắp hết (đồng bộ với mục Ưu đãi ở trang chủ)
    if (
      badge === "uu_dai" &&
      !voucher &&
      (prod.items || []).length < 4 &&
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
      try {
        const fallback = await fetchSessionProducts({
          page: 1,
          limit: 25,
          badge: "ban_chay_sap_het",
          sort: "ten",
        });
        const existing = new Set((prod.items || []).map((p) => p.ma));
        const combined = [...(prod.items || [])];
        for (const item of fallback.items || []) {
          if (!existing.has(item.ma)) {
            combined.push(item);
            existing.add(item.ma);
          }
          if (combined.length >= 25) break;
        }
        prod.items = combined;
        prod.total = Math.max(prod.total, combined.length);
      } catch {
        /* empty */
      }
    }
    items = prod.items;
    total = prod.total;
    pages = prod.pages;
  } catch (e: any) {
    err = e?.message || "Lỗi tải";
  }

  const pageTitle = voucher
    ? voucherTitle
      ? `Sản phẩm áp dụng: ${voucherTitle}`
      : "Voucher không còn áp dụng"
    : q
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
              : effectiveBadge === "uu_dai"
                ? "Sản phẩm ưu đãi"
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

  const isDeal = effectiveBadge === "uu_dai" || badge === "uu_dai";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <CatalogLayout
        total={total}
        page={page}
        pages={pages}
        title={pageTitle}
      >
        {err ? <p className="mb-4 text-sm text-amber-800">{err}</p> : null}
        <ProductGrid
          products={items}
          shopee
          homeRow6={isDeal}
          variant={isDeal ? "deal" : "default"}
        />
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
