import type { ReactNode } from "react";
import { HeroBanner, type HeroSlide } from "@/components/HeroBanner";
import { HomeTrustBar } from "@/components/HomeTrustBar";
import { HomeFeaturedCategories } from "@/components/HomeFeaturedCategories";
import { HomeFeaturedProducts } from "@/components/HomeFeaturedProducts";
import { HomeLowStockSale } from "@/components/HomeLowStockSale";
import { HomePromoStrip } from "@/components/HomePromoStrip";
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
      .slice(0, LOW_STOCK_HOME_LIMIT);
  } catch {
    return [];
  }
}

/** Top SP gắn nhãn tay «Nổi bật» (webBadge = noi_bat) — trang chủ. */
async function loadNoiBatProducts() {
  try {
    const res = await fetchProducts({
      page: 1,
      limit: 6,
      badge: "noi_bat",
      sort: "ten",
    });
    return res.items || [];
  } catch {
    return [];
  }
}

async function ProductSectionBlock({ props }: { props: Record<string, unknown> }) {
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

  if (!products.length) return null;

  const href = byCategory
    ? categoryHref({
        name: nhomName,
        slug: nhomSlug || "danh-muc",
        path: nhomPath || nhomName,
        categoryId: categoryId > 0 ? categoryId : undefined,
      })
    : source === "moi"
      ? "/tim?sort=moi&badge=moi"
      : source === "ban_chay" || banChayByRevenue
        ? "/tim?sort=ban_chay"
        : byBadge
          ? `/tim?badge=${encodeURIComponent(source === "ban_chay" ? "ban_chay_sap_het" : source)}`
          : "/tim?sort=ban_chay";

  return <HomeProductSection title={title} href={href} products={products} />;
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
  return <HeroBanner slides={slides?.length ? slides : undefined} />;
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

export async function renderTopBlocks(blocks: AppearanceBlock[]) {
  const nodes: ReactNode[] = [];
  let showedTrust = false;
  for (const b of blocks) {
    if (b.type === "hero" || b.type === "banner_carousel") {
      nodes.push(
        <div key={b.id}>
          <HeroBlock props={b.props || {}} />
        </div>
      );
    } else if (b.type === "feature_strip") {
      nodes.push(
        <div key={b.id}>
          <HomeTrustBar />
        </div>
      );
      showedTrust = true;
    }
  }
  // Fallback nếu appearance không có feature_strip
  if (!showedTrust) {
    nodes.push(
      <div key="trust-fallback">
        <HomeTrustBar />
      </div>
    );
  }
  const lowStock = await loadLowStockProducts();
  if (lowStock.length) {
    nodes.push(
      <div key="low-stock-sale">
        <HomeLowStockSale products={lowStock} />
      </div>
    );
  }
  const noiBat = await loadNoiBatProducts();
  if (noiBat.length) {
    nodes.push(
      <div key="featured-noi-bat">
        <HomeFeaturedCategories products={noiBat} />
      </div>
    );
  }
  return <>{nodes}</>;
}

/** Homepage: SP bán chạy + SP mới + promo + bài viết (tôn trọng bật/tắt khối appearance). */
export async function renderHomeMainSections(blocks: AppearanceBlock[] = []) {
  const productBlocks = (blocks || []).filter((b) => b && b.type === "product_section");

  const findBlock = (...sources: string[]) =>
    productBlocks.find((b) => sources.includes(String(b.props?.source || "").trim()));

  const banChayBlock = findBlock("ban_chay", "ban_chay_sap_het");
  const moiBlock = findBlock("moi");
  // Thiếu khối trong appearance → mặc định bật; có khối thì theo enabled
  const showBanChay = banChayBlock ? banChayBlock.enabled !== false : true;
  const showMoi = moiBlock ? moiBlock.enabled !== false : true;

  const banChayLimit = Math.max(
    10,
    Math.min(50, Math.round((Number(banChayBlock?.props?.limit) || 10) / 5) * 5)
  );
  const moiLimit = Math.max(
    10,
    Math.min(50, Math.round((Number(moiBlock?.props?.limit) || 50) / 5) * 5)
  );

  let banChay: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  if (showBanChay) {
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

  let moi: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  if (showMoi) {
    try {
      const res = await fetchProducts({
        page: 1,
        limit: moiLimit,
        sort: "moi",
      });
      moi = res.items || [];
    } catch {
      /* empty */
    }
  }

  let articles: Awaited<ReturnType<typeof fetchArticles>>["items"] = [];
  try {
    const res = await fetchArticles({ page: 1, limit: 4 });
    articles = res.items || [];
  } catch {
    /* empty */
  }

  return (
    <>
      {showBanChay ? (
        <HomeFeaturedProducts
          title="SẢN PHẨM BÁN CHẠY"
          products={banChay}
          href="/tim?sort=ban_chay"
          limit={banChayLimit}
        />
      ) : null}
      {showMoi ? (
        <HomeFeaturedProducts
          title="SẢN PHẨM MỚI"
          products={moi}
          href="/tim?sort=moi&badge=moi"
          limit={moiLimit}
          ctaLabel="Xem thêm sản phẩm mới →"
        />
      ) : null}
      <HomePromoStrip />
      {articles.length ? (
        <div className="bg-[var(--aloha-surface)] py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4">
            <HomeArticleSection title="THÔNG TIN HỮU ÍCH" articles={articles} />
          </div>
        </div>
      ) : null}
    </>
  );
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
  const enabled = (blocks || []).filter((b) => b && b.enabled !== false);
  const { top } = splitHomeBlocks(enabled);
  return (
    <>
      {await renderTopBlocks(top)}
      {await renderHomeMainSections(blocks || [])}
    </>
  );
}
