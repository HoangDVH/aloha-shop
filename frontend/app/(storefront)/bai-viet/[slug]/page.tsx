import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  fetchArticleBySlug,
  fetchArticleCategories,
} from "@/lib/api";
import { bodyHtmlForDisplay } from "@/lib/articleBodyHtml";
import { ArticleGrid } from "@/components/ArticleCard";
import { ArticleImageZoom } from "@/components/ArticleImageZoom";
import { ProductGrid } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const SHOP_ORIGIN = (
  process.env.NEXT_PUBLIC_SHOP_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://shop.alohathegioichaucay.com"
).replace(/\/$/, "");

/** Cột bài viết căn giữa — đủ rộng cho ảnh 1400×800 */
const ARTICLE_COL = "mx-auto w-full max-w-[1000px]";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await fetchArticleBySlug(slug);
    if (data.redirectTo) {
      return { alternates: { canonical: `${SHOP_ORIGIN}/bai-viet/${data.redirectTo}` } };
    }
    const item = data.item;
    if (!item) return { title: "Bài viết" };
    const title = item.title;
    const description = item.excerpt || title;
    const url = `${SHOP_ORIGIN}/bai-viet/${item.slug}`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        title,
        description,
        url,
        images: item.coverUrl ? [{ url: item.coverUrl }] : undefined,
      },
    };
  } catch {
    return { title: "Bài viết" };
  }
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function chipClass(active: boolean) {
  return `inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
    active
      ? "border-[#e6c200] bg-[#ffe566] text-slate-900"
      : "border-[#d8dee6] bg-white text-slate-800 hover:border-[#e6c200] hover:bg-[#fff8db]"
  }`;
}

export default async function BaiVietDetailPage({ params }: Props) {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof fetchArticleBySlug>>;
  try {
    data = await fetchArticleBySlug(slug);
  } catch {
    notFound();
  }

  if (data.redirectTo) {
    permanentRedirect(`/bai-viet/${encodeURIComponent(data.redirectTo)}`);
  }

  const item = data.item;
  if (!item) notFound();

  const products = data.products || [];
  const related = data.related || [];
  const shareUrl = `${SHOP_ORIGIN}/bai-viet/${item.slug}`;
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  let cats: { category: string; count: number }[] = [];
  try {
    const catRes = await fetchArticleCategories();
    cats = (catRes.items || []).slice(0, 8);
  } catch {
    cats = [];
  }

  return (
    <div className="bg-[#F7F3EA]/40 py-8">
      <div className={`${ARTICLE_COL} px-4`}>
        <nav
          className="mb-5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-slate-500"
          aria-label="Đường dẫn"
        >
          <Link href="/" className="shrink-0 hover:text-[var(--aloha-green)]">
            Trang chủ
          </Link>
          <span className="shrink-0">/</span>
          <Link href="/bai-viet" className="shrink-0 hover:text-[var(--aloha-green)]">
            Bài viết
          </Link>
          <span className="shrink-0">/</span>
          <span
            className="min-w-0 flex-1 truncate font-semibold text-[var(--aloha-green)]"
            title={item.title}
          >
            {item.title}
          </span>
        </nav>

        {cats.length ? (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Bạn có thể thích:
            </span>
            {cats.map((c) => (
              <Link
                key={c.category}
                href={`/bai-viet?category=${encodeURIComponent(c.category)}`}
                className={chipClass(c.category === item.category)}
              >
                #{c.category}
              </Link>
            ))}
            <Link
              href="/bai-viet"
              className="shrink-0 text-[13px] font-bold text-slate-700 hover:text-[var(--aloha-green)]"
            >
              Xem thêm ›
            </Link>
          </div>
        ) : item.category ? (
          <div className="mb-5">
            <Link
              href={`/bai-viet?category=${encodeURIComponent(item.category)}`}
              className={chipClass(true)}
            >
              #{item.category}
            </Link>
          </div>
        ) : null}

        <header className="mb-4 space-y-2">
          <h1 className="text-[1.65rem] font-extrabold leading-snug text-slate-900 sm:text-[1.85rem]">
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            {item.publishedAt ? (
              <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
            ) : null}
            <span aria-hidden>•</span>
            <a
              href={fbShare}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--aloha-green)] hover:underline"
            >
              Chia sẻ Facebook
            </a>
          </div>
        </header>

        <ArticleImageZoom bodyHtml={bodyHtmlForDisplay(item.bodyHtml || "")}>
          {item.videoUrl ? (
            <div className="article-hero-video mb-6 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-black/[0.04]">
              {/\.(mp4|webm|ogg)(\?|$)/i.test(item.videoUrl) ||
              item.videoUrl.includes("/uploads/") ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={item.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full"
                />
              ) : (
                <iframe
                  src={
                    /youtube\.com\/embed\//i.test(item.videoUrl)
                      ? item.videoUrl
                      : item.videoUrl.replace(
                          /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
                          "https://www.youtube.com/embed/$1"
                        )
                  }
                  title={item.title}
                  className="aspect-video w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
            </div>
          ) : null}

          {item.excerpt ? (
            <p className="mb-6 text-[15px] font-medium leading-relaxed text-slate-700">
              {item.excerpt}
            </p>
          ) : null}
        </ArticleImageZoom>
      </div>

      {/* Cùng cột bài viết (max-w 1000px) — không chèn cột lọc giả 240px (gây lệch trái) */}
      {products.length || related.length ? (
        <div className={`${ARTICLE_COL} mt-12 space-y-12 px-4`}>
          {products.length ? (
            <section className="space-y-4">
              <h2 className="text-xl font-extrabold text-[var(--aloha-green)] sm:text-2xl">
                Sản phẩm liên quan
              </h2>
              <ProductGrid products={products} shopee />
            </section>
          ) : null}

          {related.length ? (
            <section className="space-y-4 border-t border-slate-200 pt-10">
              <h2 className="text-xl font-extrabold text-[var(--aloha-green)] sm:text-2xl">
                Bài viết liên quan
              </h2>
              <ArticleGrid items={related.slice(0, 6)} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
