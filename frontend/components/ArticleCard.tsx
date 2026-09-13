import Link from "next/link";
import type { ShopArticleListItem } from "@/lib/api";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Card bài viết — cùng kiểu trang /bai-viet (ảnh cover + danh mục/ngày + tiêu đề + tóm tắt).
 * variant editorial giữ lại nếu cần sau, nhưng trang chủ dùng default.
 */
export function ArticleCard({
  article,
  variant = "default",
}: {
  article: ShopArticleListItem;
  variant?: "default" | "editorial";
}) {
  const href = `/bai-viet/${encodeURIComponent(article.slug)}`;

  if (variant === "editorial") {
    return (
      <article className="group flex h-full flex-col overflow-hidden rounded-[var(--aloha-radius)] bg-white shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] transition duration-300 md:hover:-translate-y-0.5 md:hover:shadow-[var(--aloha-shadow-lg)] md:hover:ring-[var(--aloha-green)]/15">
        <Link href={href} className="flex h-full flex-col">
          <div className="article-card-cover article-card-cover--editorial">
            {article.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverUrl}
                alt={article.title}
                className="article-card-cover__img transition duration-500 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="absolute inset-0 bg-[var(--aloha-green-light)]" aria-hidden />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5 bg-[#f3f3f3] px-2.5 py-2.5 sm:px-3 sm:py-3">
            <h3 className="line-clamp-2 text-[12px] font-extrabold uppercase leading-snug tracking-wide text-[var(--aloha-ink)] sm:text-[13px]">
              {article.title}
            </h3>
            <p className="line-clamp-2 flex-1 text-[11px] leading-relaxed text-[var(--aloha-muted)] sm:text-[12px]">
              {article.excerpt || "Đọc thêm nội dung trên blog ALOHA."}
            </p>
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--aloha-price)]">
              Xem thêm
            </span>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--aloha-radius)] bg-white shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] transition-all duration-300 ease-out md:hover:-translate-y-1 md:hover:shadow-[var(--aloha-shadow-lg)] md:hover:ring-[var(--aloha-green)]/15">
      <Link href={href} className="flex h-full flex-col">
        <div className="article-card-cover">
          {article.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.coverUrl}
              alt={article.title}
              className="article-card-cover__img transition duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--aloha-cream)]" aria-hidden />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--aloha-green)]/80">
            {article.category ? <span>{article.category}</span> : null}
            {article.publishedAt ? (
              <span className="normal-case tracking-normal text-slate-400">
                {formatDate(article.publishedAt)}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-[var(--aloha-green)] sm:text-sm">
            {article.title}
          </h3>
          <p className="line-clamp-2 text-[11px] text-slate-600 sm:text-xs">
            {article.excerpt || "\u00a0"}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function ArticleGrid({
  items,
  variant = "default",
}: {
  items: ShopArticleListItem[];
  variant?: "default" | "editorial";
}) {
  if (!items.length) return null;
  if (variant === "editorial") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {items.slice(0, 8).map((a) => (
          <ArticleCard key={a.id || a.slug} article={a} variant="editorial" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">
      {items.map((a) => (
        <ArticleCard key={a.id || a.slug} article={a} />
      ))}
    </div>
  );
}
