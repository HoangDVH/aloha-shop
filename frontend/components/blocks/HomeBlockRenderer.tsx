import type { ReactNode } from "react";
import { HeroBanner, type HeroSlide } from "@/components/HeroBanner";
import { WhyAloha } from "@/components/WhyAloha";
import { HomeProductSection } from "@/components/HomeProductSection";
import { HomeArticleSection } from "@/components/HomeArticleSection";
import { categoryHref, fetchArticles, fetchProducts } from "@/lib/api";
import type { AppearanceBlock } from "@/lib/appearanceTypes";

async function ProductSectionBlock({ props }: { props: Record<string, unknown> }) {
  const title = String(props.title || "Sản phẩm");
  const source = String(props.source || "ban_chay");
  const limit = Math.max(4, Math.min(40, Number(props.limit) || 15));
  const sort = String(props.sort || "ban_chay");
  const categoryId = Number(props.categoryId) || 0;
  const nhomPath = String(props.nhomPath || "").trim();
  const nhomSlug = String(
    props.categorySlug || props.nhomSlug || ""
  ).trim();
  const nhomName = String(
    props.categoryName || props.nhomName || title
  ).trim();
  const byCategory =
    (source === "nhom" || source === "category") &&
    (categoryId > 0 || Boolean(nhomPath));
  const byBadge =
    source === "ban_chay" || source === "moi" || source === "noi_bat";

  let products: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  try {
    if (byBadge) {
      let res = await fetchProducts({
        page: 1,
        limit,
        badge: source as "ban_chay" | "moi" | "noi_bat",
        sort: "ten",
      });
      // Mục Bán chạy: chưa gắn nhãn → fallback xếp theo doanh thu như cũ
      if (!res.items?.length && source === "ban_chay") {
        res = await fetchProducts({ page: 1, limit, sort: "ban_chay" });
      }
      products = res.items || [];
    } else {
      const res = await fetchProducts({
        page: 1,
        limit,
        sort,
        categoryId: byCategory && categoryId > 0 ? categoryId : undefined,
        nhom:
          byCategory && !(categoryId > 0) && nhomPath ? nhomPath : undefined,
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
    : byBadge
      ? `/tim?badge=${encodeURIComponent(source)}`
      : "/tim?sort=ban_chay";

  return <HomeProductSection title={title} href={href} products={products} />;
}

async function ArticleSectionBlock({ props }: { props: Record<string, unknown> }) {
  const title = String(props.title || "Bài viết mới");
  // Trang chủ: 1 hàng 4 bài — lấy tối thiểu 4
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

export async function HomeBlockRenderer({ blocks }: { blocks: AppearanceBlock[] }) {
  const enabled = (blocks || []).filter((b) => b && b.enabled !== false);
  const sections: ReactNode[] = [];

  for (const b of enabled) {
    try {
      if (b.type === "hero" || b.type === "banner_carousel") {
        sections.push(
          <div key={b.id}>
            <HeroBlock props={b.props || {}} />
          </div>
        );
      } else if (b.type === "feature_strip") {
        sections.push(
          <div key={b.id}>
            <WhyAloha />
          </div>
        );
      } else if (b.type === "product_section") {
        sections.push(
          <div key={b.id}>
            <ProductSectionBlock props={b.props || {}} />
          </div>
        );
      } else if (b.type === "article_section") {
        sections.push(
          <div key={b.id}>
            <ArticleSectionBlock props={b.props || {}} />
          </div>
        );
      } else if (b.type === "rich_text") {
        const html = String(b.props?.html || b.props?.text || "").trim();
        if (html) {
          sections.push(
            <div
              key={b.id}
              className="mx-auto max-w-7xl px-4 py-4 text-sm text-[var(--aloha-green)]"
            >
              {html}
            </div>
          );
        }
      } else if (b.type === "spacer") {
        sections.push(<div key={b.id} className="h-6" />);
      }
    } catch {
      /* skip broken block */
    }
  }

  const productBlocks = sections.filter(Boolean);
  return <>{productBlocks}</>;
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
          <WhyAloha />
        </div>
      );
    }
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
