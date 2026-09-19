import { Suspense, type ReactNode } from "react";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import type { Metadata } from "next";
import { fetchProducts } from "@/lib/api";
import { parseNhomList } from "@/lib/parseNhom";
import { parseAttrList, parseDvtList } from "@/lib/parseShopFilters";
import { ProductGrid } from "@/components/ProductCard";
import { CatalogLayout } from "@/components/CatalogLayout";
import { fetchAppearance } from "@/lib/appearance";
import {
  renderHomeMainSections,
  renderProductBlocks,
  renderTopBlocks,
  splitHomeBlocks,
} from "@/components/blocks/HomeBlockRenderer";
import { HomeSpQueryRedirect } from "@/components/HomeSpQueryRedirect";

export const revalidate = 30;

type HomeSp = {
  q?: string;
  nhom?: string | string[];
  attr?: string | string[];
  dvt?: string | string[];
  loai?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  page?: string;
};

function hasActiveFilters(sp: HomeSp) {
  const nhomList = parseNhomList(sp);
  const attrList = parseAttrList(sp);
  const dvtList = parseDvtList(sp);
  return Boolean(
    String(sp.q || "").trim() ||
      nhomList.length ||
      attrList.length ||
      dvtList.length ||
      String(sp.loai || "").trim() ||
      Number(sp.minPrice) ||
      Number(sp.maxPrice) ||
      String(sp.inStock || "") === "1" ||
      (Number(sp.page) || 1) > 1 ||
      (String(sp.sort || "").trim() &&
        String(sp.sort).trim() !== "ban_chay")
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSp>;
}): Promise<Metadata> {
  const sp = await searchParams;
  // Giữ index trang chủ sạch; noindex khi có lọc/tìm/phân trang (tránh trùng nội dung).
  if (hasActiveFilters(sp)) {
    return { robots: { index: false, follow: true } };
  }
  return {};
}

async function HomeSections() {
  const appearance = await fetchAppearance();
  const { top } = splitHomeBlocks(appearance.blocks);
  let err = "";
  let main: ReactNode = null;
  try {
    main = await renderHomeMainSections(appearance.blocks);
  } catch (e: any) {
    err = e?.message || "Không tải được catalog.";
  }

  return (
    <>
      {await renderTopBlocks(top)}
      {err ? (
        <div className="mx-auto max-w-7xl px-4 py-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {err}
          </p>
        </div>
      ) : null}
      {main}
    </>
  );
}

async function HomeCatalog({
  searchParams,
}: {
  searchParams: Promise<HomeSp>;
}) {
  const sp = await searchParams;

  if (!hasActiveFilters(sp)) {
    return <HomeSections />;
  }

  const appearance = await fetchAppearance();
  const { top } = splitHomeBlocks(appearance.blocks);

  const q = String(sp.q || "").trim();
  const nhomList = parseNhomList(sp);
  const attrList = parseAttrList(sp);
  const dvtList = parseDvtList(sp);
  const loai = String(sp.loai || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const minPrice = Number(sp.minPrice) || 0;
  const maxPrice = Number(sp.maxPrice) || 0;
  const inStock = String(sp.inStock || "") === "1";
  const sort = String(sp.sort || "ban_chay");

  // Chỉ giữ phạm vi «bán chạy / cây thành phẩm» khi chưa lọc loại/nhóm/thuộc tính…
  // (trước đây lọc «Hàng sản xuất» vẫn gắn home → thiếu mã so với KiotViet)
  const useHomeScope =
    !nhomList.length &&
    !q &&
    !loai &&
    !attrList.length &&
    !dvtList.length &&
    !minPrice &&
    !maxPrice &&
    !inStock;

  const loaiTitle =
    loai === "san_xuat"
      ? "Hàng sản xuất"
      : loai === "thuong"
        ? "Hàng hóa thường"
        : loai === "combo"
          ? "Combo - đóng gói"
          : loai === "dich_vu"
            ? "Dịch vụ"
            : "";

  let items: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let total = 0;
  let pages = 1;
  let err = "";

  try {
    const prod = await fetchProducts({
      q: q || undefined,
      nhom: nhomList.length ? nhomList : undefined,
      home: useHomeScope,
      attr: attrList.length ? attrList : undefined,
      dvt: dvtList.length ? dvtList : undefined,
      loai: loai || undefined,
      page,
      limit: 35,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStock || undefined,
      sort,
    });
    items = prod.items;
    total = prod.total;
    pages = prod.pages;
  } catch (e: any) {
    err = e?.message || "Không tải được catalog. Kiểm tra API localhost:3000.";
  }

  return (
    <>
      {await renderTopBlocks(top)}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
        <CatalogLayout
          total={total}
          page={page}
          pages={pages}
          title={
            nhomList.length === 1
              ? nhomList[0].split(/\s*>>\s*/).pop() || nhomList[0]
              : nhomList.length > 1
                ? `${nhomList.length} nhóm hàng`
                : q || loaiTitle || "Sản phẩm bán chạy"
          }
          homeMode
          hideFilters
        >
          {err ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              {err}
            </p>
          ) : null}
          <div className="w-full">
            <ProductGrid products={items} shopee homeRow6 />
          </div>
        </CatalogLayout>
      </div>
    </>
  );
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSp>;
}) {
  return (
    <div>
      <Suspense fallback={null}>
        <HomeSpQueryRedirect />
      </Suspense>
      <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
        <HomeCatalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
