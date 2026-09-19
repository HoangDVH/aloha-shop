import { Suspense } from "react";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { fetchCategories, fetchCategoryTree, fetchProducts } from "@/lib/api";
import type { ShopCategoryNavNode } from "@/lib/api";
import { parseNhomList } from "@/lib/parseNhom";
import { parseAttrList, parseDvtList } from "@/lib/parseShopFilters";
import { ProductGrid } from "@/components/ProductCard";
import { CatalogLayout } from "@/components/CatalogLayout";
import { NOINDEX_FOLLOW, SHOP_ORIGIN, shouldNoIndexCatalog } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CatSp = {
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
};

function parseCategoryIdList(sp: CatSp): number[] {
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
  return [...new Set(out)];
}

function findTreeBySlug(
  nodes: ShopCategoryNavNode[],
  s: string
): ShopCategoryNavNode | null {
  for (const n of nodes) {
    if (n.slug === s) return n;
    const hit = findTreeBySlug(n.subs || [], s);
    if (hit) return hit;
  }
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatSp>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const canonical = `${SHOP_ORIGIN}/danh-muc/${encodeURIComponent(slug)}`;

  if (shouldNoIndexCatalog(sp, { defaultSort: "ten" })) {
    return {
      robots: NOINDEX_FOLLOW,
      alternates: { canonical },
    };
  }

  let name = slug;
  try {
    const [cats, tree] = await Promise.all([
      fetchCategories(),
      fetchCategoryTree(),
    ]);
    const treeNode = findTreeBySlug(tree.items || [], slug);
    const bySlug = (cats.items || []).find((c) => c.slug === slug);
    name = treeNode?.name || bySlug?.name || slug;
  } catch {
    /* giữ slug */
  }

  const title = name;
  const description = `Mua ${name} tại ALOHA Thế Giới Chậu Cây — chọn nhanh, giá rõ, giao TP.HCM.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      title,
      description,
    },
  };
}

async function CategoryBody({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatSp>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const nhomList = parseNhomList(sp);
  const categoryIdList = parseCategoryIdList(sp);
  const attrList = parseAttrList(sp);
  const dvtList = parseDvtList(sp);
  const loai = String(sp.loai || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const minPrice = Number(sp.minPrice) || 0;
  const maxPrice = Number(sp.maxPrice) || 0;
  const inStock = String(sp.inStock || "") === "1";
  const sort = String(sp.sort || "ban_chay");

  let items: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let total = 0;
  let pages = 1;
  let err = "";
  let title = slug;

  const listOpts = {
    attr: attrList.length ? attrList : undefined,
    dvt: dvtList.length ? dvtList : undefined,
    loai: loai || undefined,
    page,
    limit: 35,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    inStock: inStock || undefined,
    sort,
  };

  let treeNode: ShopCategoryNavNode | null = null;
  let bySlug: { name: string; path: string; slug: string; count: number } | undefined;
  let defaultPath = "";
  let defaultCategoryId = 0;

  try {
    // Luôn lấy cây để resolve slug → categoryId (link Google/sitelink thường chỉ có /danh-muc/{slug}).
    const [cats, treeRes] = await Promise.all([
      fetchCategories(),
      fetchCategoryTree(),
    ]);
    treeNode = findTreeBySlug(treeRes.items || [], slug);
    bySlug = cats.items.find((c) => c.slug === slug);
    defaultPath = treeNode?.path || bySlug?.path || bySlug?.name || "";
    defaultCategoryId = Number(treeNode?.id) || 0;
  } catch (e: any) {
    err = e?.message || "Lỗi tải danh mục";
  }

  // Canonical: gắn categoryId/nhom vào URL — ngoài try/catch để permanentRedirect không bị nuốt.
  if (
    !err &&
    !categoryIdList.length &&
    !nhomList.length &&
    (defaultCategoryId > 0 || defaultPath)
  ) {
    const qs = new URLSearchParams();
    if (defaultCategoryId > 0) qs.set("categoryId", String(defaultCategoryId));
    if (defaultPath) qs.set("nhom", defaultPath);
    for (const [k, v] of Object.entries(sp)) {
      if (k === "categoryId" || k === "nhom") continue;
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
      else if (String(v).trim()) qs.set(k, String(v));
    }
    permanentRedirect(`/danh-muc/${encodeURIComponent(slug)}?${qs.toString()}`);
  }

  try {
    const resolvedCategoryIds =
      categoryIdList.length > 0
        ? categoryIdList
        : defaultCategoryId > 0
          ? [defaultCategoryId]
          : [];
    const filterNhoms = nhomList.length
      ? nhomList
      : defaultPath
        ? [defaultPath]
        : [];

    title =
      resolvedCategoryIds.length === 1
        ? treeNode?.name || bySlug?.name || slug
        : nhomList.length === 1
          ? nhomList[0].split(/\s*>>\s*/).pop() || nhomList[0]
          : nhomList.length > 1 || resolvedCategoryIds.length > 1
            ? `${Math.max(nhomList.length, resolvedCategoryIds.length)} nhóm hàng`
            : treeNode?.name || bySlug?.name || slug;

    // Không bao giờ trả cả shop khi đang ở /danh-muc/[slug] mà không resolve được nhóm.
    if (!resolvedCategoryIds.length && !filterNhoms.length) {
      if (!err) err = "Không tìm thấy nhóm hàng tương ứng.";
      items = [];
      total = 0;
      pages = 1;
    } else {
      const prod = await fetchProducts({
        categoryId: resolvedCategoryIds.length ? resolvedCategoryIds : undefined,
        nhom: !resolvedCategoryIds.length && filterNhoms.length ? filterNhoms : undefined,
        ...listOpts,
      });
      items = prod.items;
      total = prod.total;
      pages = prod.pages;
    }
  } catch (e: any) {
    err = e?.message || "Lỗi tải danh mục";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <CatalogLayout total={total} page={page} pages={pages} title={title}>
        {err ? <p className="mb-4 text-sm text-amber-800">{err}</p> : null}
        <ProductGrid products={items} shopee />
      </CatalogLayout>
    </div>
  );
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatSp>;
}) {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <CategoryBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
