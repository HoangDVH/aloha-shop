export type ShopProductAttr = {
  attributeName: string;
  attributeValue: string;
};

export type ShopProduct = {
  ma: string;
  ten: string;
  dvt: string;
  nhom: string;
  nhomPath: string;
  categoryId?: number;
  categoryName?: string;
  gia: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  ton: number;
  /** Gram — từ Mongo/KV, dùng tính phí ship server-side */
  trongLuong?: number;
  anh: string;
  images: string[];
  /** Video SP (R2 / YouTube) */
  videos?: string[];
  /** Legacy single video URL */
  videoUrl?: string;
  barcode?: string;
  description?: string;
  isActive: boolean;
  path: string;
  categorySlug: string;
  productSlug: string;
  attributes?: ShopProductAttr[];
  hasVariants?: boolean;
  /** Pin tay trên web — số nhỏ hơn = lên trước */
  webPin?: number;
  /** Badge tay; thiếu = dùng hot tự động */
  webBadge?:
    | "noi_bat"
    | "ban_chay_sap_het"
    | "giam_gia"
    | "dat_truoc"
    | "moi"
    | "ban_chay";
  /** Override SEO — ưu tiên hơn template appearance */
  seoTitle?: string;
  seoDescription?: string;
};

export type ShopVariantModel = {
  ma: string;
  ten: string;
  dvt: string;
  gia: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  ton: number;
  anh: string;
  images: string[];
  videos?: string[];
  videoUrl?: string;
  path: string;
  attributes: ShopProductAttr[];
};

export type ShopVariantAxis = {
  name: string;
  kind: "attr" | "unit";
  values: {
    value: string;
    image?: string;
    available: boolean;
    /** Biến thể hết tồn — vẫn chọn được để đặt trước */
    outOfStock?: boolean;
  }[];
};

export type ShopFacets = {
  attributes: Record<string, string[]>;
  dvt: string[];
};

export type ShopCategory = {
  name: string;
  path: string;
  slug: string;
  count: number;
};

export type ShopCategoryNavNode = {
  id: number;
  name: string;
  /** Đường dẫn đầy đủ nhóm — khớp tab Hàng hóa (vd. CÂY CẢNH >> CÂY PHONG THỦY) */
  path?: string;
  slug: string;
  count: number;
  hasChild: boolean;
  /** Ảnh SP đại diện từ kho (đúng categoryId lá) */
  image?: string;
  /** Nhánh con — tên `subs` tránh xung đột với React `children` khi SSR → client */
  subs: ShopCategoryNavNode[];
};

/**
 * Trình duyệt: gọi cùng origin `/api/shop/...` (Nginx hoặc Next rewrite).
 * Server (SSR): gọi API nội bộ trên VPS — không lộ ra ngoài.
 */
export function shopApiBase(): string {
  // Trình duyệt: luôn cùng origin (Next rewrite / Nginx) — tránh gọi 127.0.0.1 trên máy khác LAN.
  if (typeof window !== "undefined") return "";
  return (
    process.env.SHOP_API_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

async function shopFetch<T>(
  path: string,
  init?: RequestInit & { revalidate?: number }
): Promise<T> {
  const base = shopApiBase();
  const url = `${base}${path}`;
  const revalidate = init?.revalidate;
  const { revalidate: _r, ...fetchInit } = init || {};
  const res = await fetch(url, {
    ...fetchInit,
    headers: { Accept: "application/json", ...(fetchInit?.headers || {}) },
    next:
      fetchInit?.cache === "no-store"
        ? { revalidate: 0 }
        : revalidate != null
          ? { revalidate }
          : { revalidate: 60 },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function formatVnd(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString("vi-VN")}đ`;
}

export async function fetchCategories() {
  return shopFetch<{ items: ShopCategory[] }>("/api/shop/categories", {
    revalidate: 300,
  });
}

export async function fetchCategoryTree() {
  return shopFetch<{ items: ShopCategoryNavNode[] }>("/api/shop/category-tree", {
    revalidate: 300,
  });
}

const CATEGORY_TREE_CLIENT_TTL_MS = 5 * 60 * 1000; // 5 phút TTL cho client memory cache
let categoryTreeClientCache: ShopCategoryNavNode[] | null = null;
let categoryTreeClientTimestamp = 0;
let categoryTreeClientInflight: Promise<ShopCategoryNavNode[]> | null = null;

export function invalidateCategoryTreeClientCache() {
  categoryTreeClientCache = null;
  categoryTreeClientTimestamp = 0;
}

if (typeof window !== "undefined") {
  window.addEventListener("aloha-category-tree-invalidated", () => {
    invalidateCategoryTreeClientCache();
  });
}

/** Cache phía trình duyệt có TTL & Invalidation — menu không gọi API lại mỗi lần mount nhưng tự động làm mới sau TTL hoặc khi bị invalidate */
export function fetchCategoryTreeCached(forceRefresh = false): Promise<ShopCategoryNavNode[]> {
  const isFresh =
    !forceRefresh &&
    categoryTreeClientCache !== null &&
    categoryTreeClientCache.length > 0 &&
    Date.now() - categoryTreeClientTimestamp < CATEGORY_TREE_CLIENT_TTL_MS;

  if (isFresh && categoryTreeClientCache) {
    return Promise.resolve(categoryTreeClientCache);
  }
  if (!categoryTreeClientInflight) {
    categoryTreeClientInflight = fetchCategoryTree()
      .then((res) => {
        categoryTreeClientCache = res.items || [];
        categoryTreeClientTimestamp = Date.now();
        return categoryTreeClientCache;
      })
      .catch(() => (categoryTreeClientCache || []) as ShopCategoryNavNode[])
      .finally(() => {
        categoryTreeClientInflight = null;
      });
  }
  return categoryTreeClientInflight;
}

export function categoryHref(node: {
  name: string;
  slug: string;
  path?: string;
  /** Tree KV dùng `id`; một số chỗ cũ truyền `categoryId`. */
  id?: number;
  categoryId?: number;
}) {
  // URL sạch khớp canonical — server resolve categoryId từ slug.
  return `/danh-muc/${encodeURIComponent(node.slug)}`;
}

export async function fetchProducts(
  opts: {
    q?: string;
    nhom?: string | string[];
    /** Khóa lọc nhóm DB shop mới */
    categoryId?: number | number[];
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    /** Tồn tối đa (vd. 8 = nhãn sắp hết) */
    maxTon?: number;
    sort?: string;
    /** attr=Name:Value (lặp) */
    attr?: string[];
    dvt?: string[];
    /** thuong | san_xuat | combo | dich_vu */
    loai?: string;
    /** Phạm vi trang chủ: bán chạy ∪ cây thành phẩm */
    home?: boolean;
    /** Lọc theo nhãn tay: ban_chay_sap_het | giam_gia | dat_truoc | moi */
    badge?: "ban_chay_sap_het" | "giam_gia" | "dat_truoc" | "moi" | "ban_chay" | "noi_bat";
    signal?: AbortSignal;
  },
  /** Mặc định no-store (danh sách cần tồn mới). SP liên quan trên PDP: truyền revalidate. */
  cacheOpts?: { revalidate?: number; cache?: RequestCache; headers?: Record<string,string> }
) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  const categoryIds = Array.isArray(opts.categoryId)
    ? opts.categoryId.map((n) => Number(n) || 0).filter((n) => n > 0)
    : opts.categoryId
      ? [Number(opts.categoryId)].filter((n) => n > 0)
      : [];
  for (const id of categoryIds) sp.append("categoryId", String(id));
  const nhoms =
    categoryIds.length > 0
      ? []
      : Array.isArray(opts.nhom)
        ? opts.nhom.map((n) => String(n || "").trim()).filter(Boolean)
        : opts.nhom
          ? [String(opts.nhom).trim()]
          : [];
  for (const n of nhoms) sp.append("nhom", n);
  if (opts.home && !nhoms.length && !categoryIds.length) sp.set("home", "1");
  if (opts.page) sp.set("page", String(opts.page));
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.minPrice != null && opts.minPrice > 0) sp.set("minPrice", String(opts.minPrice));
  if (opts.maxPrice != null && opts.maxPrice > 0) sp.set("maxPrice", String(opts.maxPrice));
  if (opts.inStock) sp.set("inStock", "1");
  if (opts.maxTon != null && opts.maxTon > 0) sp.set("maxTon", String(opts.maxTon));
  if (opts.sort) sp.set("sort", opts.sort);
  if (opts.loai) sp.set("loai", String(opts.loai).trim());
  if (opts.badge) sp.set("badge", opts.badge);
  for (const a of opts.attr || []) {
    const t = String(a || "").trim();
    if (t) sp.append("attr", t);
  }
  for (const d of opts.dvt || []) {
    const t = String(d || "").trim();
    if (t) sp.append("dvt", t);
  }
  const qs = sp.toString();
  const fetchInit =
    cacheOpts?.cache != null
      ? { cache: cacheOpts.cache, revalidate: cacheOpts.revalidate }
      : cacheOpts?.revalidate != null
        ? { revalidate: cacheOpts.revalidate }
        : { cache: "no-store" as const };
  return shopFetch<{
    items: ShopProduct[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>(`/api/shop/products${qs ? `?${qs}` : ""}`, {
    ...fetchInit,
    headers: cacheOpts?.headers,
    signal: opts.signal,
  });
}

export async function fetchShopFacets(opts: {
  q?: string;
  nhom?: string | string[];
  categoryId?: number | number[];
  /** Trang chủ: facets theo bán chạy + cây thành phẩm */
  home?: boolean;
  /** Trang /tim (Tất cả SP): facets ĐVT + thuộc tính toàn catalog */
  all?: boolean;
  badge?: string;
}): Promise<ShopFacets> {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.badge) sp.set("badge", opts.badge);
  const categoryIds = Array.isArray(opts.categoryId)
    ? opts.categoryId.map((n) => Number(n) || 0).filter((n) => n > 0)
    : opts.categoryId
      ? [Number(opts.categoryId)].filter((n) => n > 0)
      : [];
  for (const id of categoryIds) sp.append("categoryId", String(id));
  const nhoms =
    categoryIds.length > 0
      ? []
      : Array.isArray(opts.nhom)
        ? opts.nhom.map((n) => String(n || "").trim()).filter(Boolean)
        : opts.nhom
          ? [String(opts.nhom).trim()]
          : [];
  for (const n of nhoms) sp.append("nhom", n);
  if (opts.home && !nhoms.length && !categoryIds.length && !opts.q) sp.set("home", "1");
  if (opts.all && !nhoms.length && !categoryIds.length && !opts.q && !opts.home && !opts.badge)
    sp.set("all", "1");
  const qs = sp.toString();
  try {
    return await shopFetch<ShopFacets>(`/api/shop/facets${qs ? `?${qs}` : ""}`, {
      revalidate: 30,
    });
  } catch {
    return { attributes: {}, dvt: [] };
  }
}

export async function fetchProductVariants(ma: string): Promise<{
  ok: boolean;
  current: ShopVariantModel | null;
  axes: ShopVariantAxis[];
  models: ShopVariantModel[];
}> {
  const code = encodeURIComponent(String(ma || "").trim());
  if (!code) return { ok: false, current: null, axes: [], models: [] };
  return shopFetch(`/api/shop/products/${code}/variants`, { cache: "no-store" });
}

/** Gọi từ trình duyệt (dropdown tìm kiếm) — dùng proxy Next `/api/shop` nếu cùng origin */
export async function searchProductsClient(q: string, limit = 8): Promise<{
  items: ShopProduct[];
  total: number;
}> {
  const term = String(q || "").trim();
  if (!term) return { items: [], total: 0 };
  const sp = new URLSearchParams({
    q: term,
    limit: String(Math.min(24, Math.max(1, limit))),
    sort: "ten",
  });
  const base = shopApiBase();
  const url = `${base}/api/shop/products?${sp}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ items: ShopProduct[]; total: number }>;
}

export async function fetchProductByMa(ma: string) {
  return shopFetch<{ item: ShopProduct }>(
    `/api/shop/products/${encodeURIComponent(ma)}`,
    { revalidate: 30 }
  );
}

export async function resolveProductPath(path: string) {
  return shopFetch<{ item: ShopProduct }>(
    `/api/shop/resolve?path=${encodeURIComponent(path)}`,
    { revalidate: 30 }
  );
}

export type ShopArticleListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  coverUrl: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
};

export type ShopArticleDetail = ShopArticleListItem & {
  bodyHtml: string;
  productMas: string[];
  videoUrl?: string;
};

export async function fetchArticles(opts?: {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
}) {
  const sp = new URLSearchParams();
  if (opts?.page) sp.set("page", String(opts.page));
  if (opts?.limit) sp.set("limit", String(opts.limit));
  if (opts?.category) sp.set("category", opts.category);
  if (opts?.q) sp.set("q", opts.q);
  const qs = sp.toString();
  return shopFetch<{
    items: ShopArticleListItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>(`/api/shop/articles${qs ? `?${qs}` : ""}`, { revalidate: 30 });
}

export async function fetchArticleCategories() {
  return shopFetch<{ items: { category: string; count: number }[] }>(
    "/api/shop/articles/categories",
    { revalidate: 60 }
  );
}

export async function fetchArticleBySlug(slug: string) {
  return shopFetch<{
    item?: ShopArticleDetail;
    products?: ShopProduct[];
    related?: ShopArticleListItem[];
    redirectTo?: string;
  }>(`/api/shop/articles/${encodeURIComponent(slug)}`, { cache: "no-store" });
}

export async function fetchSitemapData() {
  return shopFetch<{
    static: { path: string; priority?: number; changeFrequency?: string }[];
    articles: { path: string; lastModified?: string }[];
    products: { path: string; lastModified?: string }[];
    categories?: { path: string; lastModified?: string }[];
  }>("/api/shop/sitemap-data", { revalidate: 300 });
}

