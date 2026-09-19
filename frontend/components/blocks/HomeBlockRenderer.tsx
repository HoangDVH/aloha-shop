import type { ReactNode } from "react";
import { HeroBanner, type HeroSlide } from "@/components/HeroBanner";
import { HomeTrustBar } from "@/components/HomeTrustBar";
import { HomeFeaturedCategories } from "@/components/HomeFeaturedCategories";
import { HomeFeaturedProducts } from "@/components/HomeFeaturedProducts";
import { HomePromoStrip } from "@/components/HomePromoStrip";
import { HomeArticleSection } from "@/components/HomeArticleSection";
import { HomeProductSection } from "@/components/HomeProductSection";
import { categoryHref, fetchArticles, fetchProducts } from "@/lib/api";
import type { AppearanceBlock } from "@/lib/appearanceTypes";

async function ProductSectionBlock({ props }: { props: Record<string, unknown> }) {
  const title = String(props.title || "Sản phẩm");
  const source = String(props.source || "ban_chay");
  const limit = Math.max(4, Math.min(40, Number(props.limit) || 15));
  const sort = String(props.sort || "ban_chay");
  const categoryId = Number(props.categoryId) || 0;
  const nhomPath = String(props.nhomPath || "").trim();
  const nhomSlug = String(props.categorySlug || props.nhomSlug || "").trim();
  const nhomName = String(props.categoryName || props.nhomName || title).trim();
  const byCategory =
    (source === "nhom" || source === "category") &&
    (categoryId > 0 || Boolean(nhomPath));
  const byBadge =
    source === "ban_chay" || source === "moi" || source === "noi_bat";

  let products: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let banChayByRevenue = false;
  try {
    if (byBadge) {
      let res = await fetchProducts({
        page: 1,
        limit,
        badge: source as "ban_chay" | "moi" | "noi_bat",
        sort: "ten",
      });
      if (!res.items?.length && source === "ban_chay") {
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
    : source === "ban_chay" || banChayByRevenue
      ? "/tim?sort=ban_chay"
      : byBadge
        ? `/tim?badge=${encodeURIComponent(source)}`
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
  nodes.push(
    <div key="featured-categories">
      <HomeFeaturedCategories />
    </div>
  );
  return <>{nodes}</>;
}

/** Homepage: SP bán chạy + promo + bài viết. */
export async function renderHomeMainSections() {
  const limit = 12;
  let banChay: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];

  try {
    const a = await fetchProducts({ page: 1, limit, sort: "ban_chay" });
    banChay = a.items || [];
    if (!banChay.length) {
      const fallback = await fetchProducts({
        page: 1,
        limit,
        badge: "ban_chay",
        sort: "ten",
      });
      banChay = fallback.items || [];
    }
  } catch {
    /* empty */
  }

  let articles: Awaited<ReturnType<typeof fetchArticles>>["items"] = [];
  try {
    const res = await fetchArticles({ page: 1, limit: 4 });
    articles = res.items || [];
  } catch {
    articles = [];
  }

  return (
    <>
      <HomeFeaturedProducts banChay={banChay} />
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
      {await renderHomeMainSections()}
    </>
  );
}
