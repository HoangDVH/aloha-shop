import type { ReactNode } from "react";
import type { HeroSlide } from "@/components/HeroBanner";
import { HomeBannerGrid } from "@/components/campaign/HomeBannerGrid";
import { CampaignHomeStrip } from "@/components/campaign/CampaignHomeStrip";
import { HomeTrustBar } from "@/components/HomeTrustBar";
import { HomeFeaturedCategories } from "@/components/HomeFeaturedCategories";
import { HomeFeaturedProducts } from "@/components/HomeFeaturedProducts";
import { HomeLowStockSale } from "@/components/HomeLowStockSale";
import { HomeArticleSection } from "@/components/HomeArticleSection";
import { HomeProductSection } from "@/components/HomeProductSection";
import { categoryHref, fetchArticles, fetchProducts } from "@/lib/api";
import type { AppearanceBlock } from "@/lib/appearanceTypes";

const LOW_STOCK_MAX = 8;
const LOW_STOCK_HOME_LIMIT = 20;

function isLowStockProduct(ton: number | undefined | null) {
  const n = Number(ton);
  return Number.isFinite(n) && n > 0 && n <= LOW_STOCK_MAX;
}

/** Top SP vừa bán chạy (doanh thu) vừa sắp hết — trang chủ. */
async function loadLowStockProducts() {
  try {
    const res = await fetchProducts({
      page: 1,
      limit: LOW_STOCK_HOME_LIMIT,
      inStock: true,
      maxTon: LOW_STOCK_MAX,
      sort: "ban_chay",
    });
    return (res.items || [])
      .filter((p) => isLowStockProduct(p.ton))
      .filter(
        (p) =>
          Boolean(String(p.anh || "").trim()) ||
          (Array.isArray(p.images) && p.images.some((u) => String(u || "").trim()))
      )
      .slice(0, LOW_STOCK_HOME_LIMIT);
  } catch {
    return [];
  }
}

async function loadProductSection(props: Record<string, unknown>) {
  const title = String(props.title || "Sản phẩm");
  const source = String(props.source || "ban_chay");
  const limit = Math.max(
    10,
    Math.min(40, Math.round((Number(props.limit) || 15) / 5) * 5)
  );
  const sort = String(props.sort || "ban_chay");
  const categoryId = Number(props.categoryId) || 0;
  const nhomPath = String(props.nhomPath || "").trim();
  const nhomSlug = String(props.categorySlug || props.nhomSlug || "").trim();
  const nhomName = String(props.categoryName || props.nhomName || title).trim();
  const byCategory =
    (source === "nhom" || source === "category") &&
    (categoryId > 0 || Boolean(nhomPath));
  const byBadge =
    source === "ban_chay_sap_het" ||
    source === "giam_gia" ||
    source === "dat_truoc" ||
    source === "moi" ||
    source === "uu_dai" ||
    source === "ban_chay" ||
    source === "noi_bat";

  let products: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let banChayByRevenue = false;
  try {
    if (source === "moi") {
      const res = await fetchProducts({
        page: 1,
        limit,
        sort: "moi",
      });
      products = res.items || [];
    } else if (byBadge) {
      const badgeKey =
        source === "ban_chay"
          ? "ban_chay_sap_het"
          : (source as
              | "ban_chay_sap_het"
              | "giam_gia"
              | "dat_truoc"
              | "moi"
              | "uu_dai"
              | "noi_bat");
      let res = await fetchProducts({
        page: 1,
        limit,
        badge: badgeKey,
        sort: "ten",
      });
      if (
        !res.items?.length &&
        (source === "ban_chay" || source === "ban_chay_sap_het")
      ) {
        res = await fetchProducts({ page: 1, limit, sort: "ban_chay" });
        banChayByRevenue = true;
      }
      products = res.items || [];
    } else {
      const res = await fetchProducts({
        page: 1,
        limit,
        sort,
        categoryId: byCategory && categoryId > 0 ? categoryId : undefined,
        nhom: byCategory && !(categoryId > 0) && nhomPath ? nhomPath : undefined,
      });
      products = res.items || [];
    }
  } catch {
    products = [];
  }

  const href = byCategory
    ? categoryHref({
        name: nhomName,
        slug: nhomSlug || "danh-muc",
        path: nhomPath || nhomName,
        categoryId: categoryId > 0 ? categoryId : undefined,
      })
    : source === "moi"
      ? "/tim?sort=moi"
      : source === "noi_bat"
        ? "/tim?badge=noi_bat"
        : source === "ban_chay" || banChayByRevenue
          ? "/tim?sort=ban_chay"
          : byBadge
            ? `/tim?badge=${encodeURIComponent(source === "ban_chay" ? "ban_chay_sap_het" : source)}`
            : "/tim?sort=ban_chay";

  const isUuDai = source === "uu_dai" || props.badge === "uu_dai" || title.toLowerCase().includes("ưu đãi");
  return { title, href, products, limit, variant: isUuDai ? ("deal" as const) : ("default" as const) };
}

async function ProductSectionBlock({ props }: { props: Record<string, unknown> }) {
  const s = await loadProductSection(props);
  if (!s.products.length) return null;
  return <HomeProductSection title={s.title} href={s.href} products={s.products} variant={s.variant} />;
}

/** Mục SP admin tự thêm — cùng khung full-width với các mục mặc định trang chủ. */
async function HomeCustomProductSection({ props }: { props: Record<string, unknown> }) {
  const s = await loadProductSection(props);
  if (!s.products.length) return null;
  return (
    <HomeFeaturedProducts
      title={s.title.toLocaleUpperCase("vi-VN")}
      products={s.products}
      href={s.href}
      limit={s.limit}
    />
  );
}

async function ArticleSectionBlock({ props }: { props: Record<string, unknown> }) {
  const title = String(props.title || "Bài viết mới");
  const limit = Math.max(4, Math.min(8, Number(props.limit) || 4));
  let articles: Awaited<ReturnType<typeof fetchArticles>>["items"] = [];
  try {
    const res = await fetchArticles({ page: 1, limit });
    articles = res.items || [];
  } catch {
    articles = [];
  }
  if (!articles.length) return null;
  return <HomeArticleSection title={title} articles={articles} />;
}

function HeroBlock({ props }: { props: Record<string, unknown> }) {
  const slides = Array.isArray(props.slides)
    ? (props.slides as HeroSlide[]).filter((s) => s?.src)
    : undefined;
  return <HomeBannerGrid slides={slides?.length ? slides : undefined} />;
}

/** Tách hero/feature vs product rows for page layout. */
export function splitHomeBlocks(blocks: AppearanceBlock[]) {
  const top: AppearanceBlock[] = [];
  const products: AppearanceBlock[] = [];
  for (const b of blocks || []) {
    if (!b || b.enabled === false) continue;
    if (
      b.type === "hero" ||
      b.type === "banner_carousel" ||
      b.type === "feature_strip"
    ) {
      top.push(b);
    } else {
      products.push(b);
    }
  }
  return { top, products };
}

/** `blocks` = toàn bộ khối appearance (cả khối đang tắt) để phân biệt «tắt» với «chưa có». */
export async function renderTopBlocks(blocks: AppearanceBlock[]) {
  const all = (blocks || []).filter(Boolean);
  const { top } = splitHomeBlocks(all);
  const hasFeatureBlock = all.some((b) => b.type === "feature_strip");
  const banChayBlock = all.find(
    (b) =>
      b.type === "product_section" &&
      ["ban_chay", "ban_chay_sap_het"].includes(String(b.props?.source || "").trim())
  );
  const showLowStock = banChayBlock ? banChayBlock.enabled !== false : true;
  const nodes: ReactNode[] = [];
  let showedTrust = false;
  let showedHero = false;
  for (const b of top) {
    if (b.type === "hero" || b.type === "banner_carousel") {
      nodes.push(
        <div key={b.id}>
          <HeroBlock props={b.props || {}} />
          {showedHero ? null : <CampaignHomeStrip />}
        </div>
      );
      showedHero = true;
    } else if (b.type === "feature_strip") {
      nodes.push(
        <div key={b.id}>
          <HomeTrustBar />
        </div>
      );
      showedTrust = true;
    }
  }
  // Appearance cũ chưa có khối feature_strip → vẫn hiện; khối có mà đang tắt → ẩn
  if (!showedTrust && !hasFeatureBlock) {
    nodes.push(
      <div key="trust-fallback">
        <HomeTrustBar />
      </div>
    );
  }

  const lowStock = showLowStock ? await loadLowStockProducts() : [];
  if (lowStock.length) {
    nodes.push(
      <div key="low-stock-sale">
        <HomeLowStockSale products={lowStock} />
      </div>
    );
  }
  return <>{nodes}</>;
}

type HomeItems = Awaited<ReturnType<typeof fetchProducts>>["items"];
type BlockProps = Record<string, unknown> | undefined;

const step5Limit = (raw: unknown, fallback: number) =>
  Math.max(10, Math.min(50, Math.round((Number(raw) || fallback) / 5) * 5));

const sourceOf = (b: AppearanceBlock) => String(b.props?.source || "").trim();
const CORE_SOURCES: Record<string, "noi_bat" | "uu_dai" | "ban_chay" | "moi"> = {
  noi_bat: "noi_bat",
  uu_dai: "uu_dai",
  ban_chay: "ban_chay",
  ban_chay_sap_het: "ban_chay",
  moi: "moi",
};

async function HomeNoiBatSection({ props }: { props: BlockProps }) {
  const limit = Math.max(1, Math.min(15, Math.round(Number(props?.limit) || 6)));
  let items: HomeItems = [];
  try {
    items = (await fetchProducts({ page: 1, limit, badge: "noi_bat", sort: "ten" })).items || [];
  } catch {
    /* empty */
  }
  return items.length ? (
    <HomeFeaturedProducts
      title={(String(props?.title || "").trim() || "Sản phẩm nổi bật").toLocaleUpperCase("vi-VN")}
      products={items}
      href="/tim?badge=noi_bat"
      limit={limit}
      ctaLabel="Xem thêm sản phẩm nổi bật →"
    />
  ) : null;
}

async function HomeUuDaiSection({ props }: { props: BlockProps }) {
  const uuDaiLimit = step5Limit(props?.limit, 15);
  const uuDaiTitle = String(props?.title || "").trim() || "Sản phẩm ưu đãi";
  let uuDai: HomeItems = [];
  {
    try {
      const res = await fetchProducts({
        page: 1,
        limit: uuDaiLimit,
        badge: "uu_dai",
        sort: "ten",
      });
      uuDai = res.items || [];
      if (uuDai.length < 4) {
        const fallback = await fetchProducts({
          page: 1,
          limit: uuDaiLimit,
          badge: "ban_chay_sap_het",
          sort: "ten",
        });
        const existing = new Set(uuDai.map((p) => p.ma));
        for (const item of fallback.items || []) {
          if (!existing.has(item.ma)) {
            uuDai.push(item);
            existing.add(item.ma);
          }
          if (uuDai.length >= uuDaiLimit) break;
        }
      }
    } catch {
      /* empty */
    }
  }
  return (
    <HomeFeaturedProducts
      title={uuDaiTitle.toLocaleUpperCase("vi-VN")}
      products={uuDai}
      href="/tim?badge=uu_dai"
      limit={uuDaiLimit}
      ctaLabel="Xem thêm sản phẩm ưu đãi →"
      variant="deal"
    />
  );
}

async function HomeBanChaySection({ props }: { props: BlockProps }) {
  const banChayLimit = step5Limit(props?.limit, 10);
  let banChay: HomeItems = [];
  {
    try {
      const a = await fetchProducts({ page: 1, limit: banChayLimit, sort: "ban_chay" });
      banChay = a.items || [];
      if (!banChay.length) {
        const fallback = await fetchProducts({
          page: 1,
          limit: banChayLimit,
          badge: "ban_chay_sap_het",
          sort: "ten",
        });
        banChay = fallback.items || [];
      }
    } catch {
      /* empty */
    }
  }
  return (
    <HomeFeaturedProducts
      title={(String(props?.title || "").trim() || "Sản phẩm bán chạy").toLocaleUpperCase("vi-VN")}
      products={banChay}
      href="/tim?sort=ban_chay"
      limit={banChayLimit}
    />
  );
}

async function HomeMoiSection({ props }: { props: BlockProps }) {
  const moiLimit = step5Limit(props?.limit, 50);
  let moi: HomeItems = [];
  {
    try {
      const res = await fetchProducts({
        page: 1,
        limit: Math.min(80, moiLimit * 2),
        sort: "moi",
      });
      moi = (res.items || [])
        .filter(
          (p) =>
            Boolean(String(p.anh || "").trim()) ||
            (Array.isArray(p.images) && p.images.some((u) => String(u || "").trim()))
        )
        .slice(0, moiLimit);
    } catch {
      /* empty */
    }
  }
  return (
    <HomeFeaturedProducts
      title={(String(props?.title || "").trim() || "Sản phẩm mới").toLocaleUpperCase("vi-VN")}
      products={moi}
      href="/tim?sort=moi"
      limit={moiLimit}
      ctaLabel="Xem thêm sản phẩm mới →"
    />
  );
}

async function HomeArticlesBlock({ props }: { props: BlockProps }) {
  const limit = Math.max(4, Math.min(8, Number(props?.limit) || 4));
  let articles: Awaited<ReturnType<typeof fetchArticles>>["items"] = [];
  try {
    articles = (await fetchArticles({ page: 1, limit })).items || [];
  } catch {
    /* empty */
  }
  if (!articles.length) return null;
  return (
    <div className="bg-[var(--aloha-surface)] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <HomeArticleSection title="THÔNG TIN HỮU ÍCH" articles={articles} />
      </div>
    </div>
  );
}

/** Trang chủ: các khối dưới banner theo đúng thứ tự + bật/tắt trong admin «Giao diện → Trang chủ». */
export async function renderHomeMainSections(blocks: AppearanceBlock[] = []) {
  const all = (blocks || []).filter(Boolean);
  const main = all.filter((b) => b.type === "product_section" || b.type === "article_section");

  // Appearance cũ thiếu khối mặc định → vẫn hiện (cuối danh sách); khối có mà đang tắt → ẩn
  const ordered = [...main];
  const present = new Set(main.filter((b) => b.type === "product_section").map((b) => CORE_SOURCES[sourceOf(b)]));
  for (const core of ["noi_bat", "uu_dai", "ban_chay", "moi"] as const) {
    if (!present.has(core)) {
      ordered.push({ id: `fallback_${core}`, type: "product_section", enabled: true, props: { source: core } });
    }
  }
  if (!main.some((b) => b.type === "article_section")) {
    ordered.push({ id: "fallback_articles", type: "article_section", enabled: true, props: {} });
  }

  const nodes: ReactNode[] = [];
  const rendered = new Set<string>();
  for (const b of ordered) {
    if (b.enabled === false) continue;
    if (b.type === "article_section") {
      nodes.push(<HomeArticlesBlock key={b.id} props={b.props} />);
      continue;
    }
    const core = CORE_SOURCES[sourceOf(b)];
    if (core && !rendered.has(core)) {
      rendered.add(core);
      if (core === "noi_bat") nodes.push(<HomeNoiBatSection key={b.id} props={b.props} />);
      else if (core === "ban_chay") nodes.push(<HomeBanChaySection key={b.id} props={b.props} />);
      else if (core === "moi") nodes.push(<HomeMoiSection key={b.id} props={b.props} />);
      else {
        nodes.push(<HomeUuDaiSection key={b.id} props={b.props} />);
      }
      continue;
    }
    nodes.push(<HomeCustomProductSection key={b.id} props={b.props || {}} />);
  }
  return <>{nodes}</>;
}

export async function renderProductBlocks(blocks: AppearanceBlock[]) {
  const nodes: ReactNode[] = [];
  for (const b of blocks) {
    if (b.type === "product_section") {
      nodes.push(
        <div key={b.id}>
          <ProductSectionBlock props={b.props || {}} />
        </div>
      );
    } else if (b.type === "article_section") {
      nodes.push(
        <div key={b.id}>
          <ArticleSectionBlock props={b.props || {}} />
        </div>
      );
    }
  }
  return <div className="space-y-14 sm:space-y-16">{nodes}</div>;
}

export async function HomeBlockRenderer({ blocks }: { blocks: AppearanceBlock[] }) {
  return (
    <>
      {await renderTopBlocks(blocks || [])}
      {await renderHomeMainSections(blocks || [])}
    </>
  );
}
