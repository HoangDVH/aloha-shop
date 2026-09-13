import Link from "next/link";
import type { Metadata } from "next";
import { fetchArticles, fetchArticleCategories } from "@/lib/api";
import { ArticleGrid } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bài viết",
  description: "Tin tức & hướng dẫn chăm sóc cây từ ALOHA Thế Giới Chậu Cây",
};

type Sp = { page?: string; category?: string; q?: string };

function chipClass(active: boolean) {
  return `inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
    active
      ? "border-[#e6c200] bg-[#ffe566] text-slate-900 shadow-sm"
      : "border-[#d8dee6] bg-white text-slate-800 hover:border-[#e6c200] hover:bg-[#fff8db]"
  }`;
}

export default async function BaiVietListPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const category = String(sp.category || "").trim();
  const q = String(sp.q || "").trim();

  let items: Awaited<ReturnType<typeof fetchArticles>>["items"] = [];
  let total = 0;
  let pages = 1;
  let cats: { category: string; count: number }[] = [];
  let err = "";

  try {
    const [list, catRes] = await Promise.all([
      fetchArticles({
        page,
        limit: 12,
        category: category || undefined,
        q: q || undefined,
      }),
      fetchArticleCategories(),
    ]);
    items = list.items || [];
    total = list.total || 0;
    pages = list.pages || 1;
    cats = catRes.items || [];
  } catch (e: any) {
    err = e?.message || "Không tải được bài viết.";
  }

  const allHref = q ? `/bai-viet?q=${encodeURIComponent(q)}` : "/bai-viet";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-[var(--aloha-green)]">
          Trang chủ
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-[var(--aloha-green)]">Bài viết</span>
      </nav>

      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-extrabold text-[var(--aloha-green)] sm:text-3xl">
          Bài viết
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Gợi ý chọn chậu, chăm sóc cây và tin mới từ ALOHA.
        </p>
        {q ? (
          <p className="text-sm text-slate-600">
            Đang lọc hashtag / từ khóa:{" "}
            <span className="font-bold text-[var(--aloha-green)]">#{q}</span>{" "}
            <Link href="/bai-viet" className="ml-1 font-semibold underline">
              Xóa lọc
            </Link>
          </p>
        ) : null}
      </header>

      {cats.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link href={allHref} className={chipClass(!category && !q)}>
            #Tất cả
          </Link>
          {cats.map((c) => (
            <Link
              key={c.category}
              href={`/bai-viet?category=${encodeURIComponent(c.category)}`}
              className={chipClass(category === c.category && !q)}
            >
              #{c.category}
            </Link>
          ))}
          <Link
            href="/bai-viet"
            className="ml-1 inline-flex items-center gap-0.5 text-sm font-bold text-slate-700 hover:text-[var(--aloha-green)]"
          >
            Xem thêm ›
          </Link>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {err}
        </p>
      ) : null}

      {!err && !items.length ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {q || category
            ? "Không có bài viết khớp bộ lọc."
            : "Chưa có bài viết nào."}
        </p>
      ) : null}

      <ArticleGrid items={items} />
      <Pagination page={page} pages={pages} total={total} />
    </div>
  );
}
