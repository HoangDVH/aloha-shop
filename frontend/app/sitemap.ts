import type { MetadataRoute } from "next";
import { fetchCategoryTree, fetchSitemapData } from "@/lib/api";
import type { ShopCategoryNavNode } from "@/lib/api";
import { SHOP_ORIGIN } from "@/lib/seo";

function flattenCategorySlugs(nodes: ShopCategoryNavNode[], out: string[]) {
  for (const n of nodes || []) {
    const slug = String(n.slug || "").trim();
    if (slug) out.push(slug);
    if (n.subs?.length) flattenCategorySlugs(n.subs, out);
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  const push = (entry: MetadataRoute.Sitemap[number]) => {
    if (!entry.url || seen.has(entry.url)) return;
    // /danh-muc không có trang index — bỏ URL chết
    if (entry.url === `${SHOP_ORIGIN}/danh-muc`) return;
    seen.add(entry.url);
    entries.push(entry);
  };

  try {
    const data = await fetchSitemapData();
    for (const s of data.static || []) {
      push({
        url: `${SHOP_ORIGIN}${s.path}`,
        lastModified: now,
        changeFrequency:
          (s.changeFrequency as MetadataRoute.Sitemap[0]["changeFrequency"]) ||
          "weekly",
        priority: s.priority ?? 0.5,
      });
    }
    for (const a of data.articles || []) {
      push({
        url: `${SHOP_ORIGIN}${a.path}`,
        lastModified: a.lastModified ? new Date(a.lastModified) : now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const p of data.products || []) {
      push({
        url: `${SHOP_ORIGIN}${p.path}`,
        lastModified: p.lastModified ? new Date(p.lastModified) : now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
    for (const c of data.categories || []) {
      push({
        url: `${SHOP_ORIGIN}${c.path}`,
        lastModified: c.lastModified ? new Date(c.lastModified) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    const fallbackStatic: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
      { path: "/", priority: 1, changeFrequency: "daily" },
      { path: "/bac-si-cay", priority: 0.9, changeFrequency: "daily" },
      { path: "/tim", priority: 0.8, changeFrequency: "daily" },
      { path: "/uu-dai", priority: 0.8, changeFrequency: "daily" },
      { path: "/bai-viet", priority: 0.7, changeFrequency: "daily" },
      { path: "/ve-aloha", priority: 0.7, changeFrequency: "weekly" },
      { path: "/dang-ky-si", priority: 0.7, changeFrequency: "weekly" },
      { path: "/tuyen-ctv", priority: 0.7, changeFrequency: "weekly" },
      { path: "/tuyen-dung", priority: 0.6, changeFrequency: "weekly" },
    ];
    for (const s of fallbackStatic) {
      push({
        url: `${SHOP_ORIGIN}${s.path}`,
        lastModified: now,
        changeFrequency: s.changeFrequency,
        priority: s.priority,
      });
    }
  }

  // Bổ sung danh mục từ tree (hoạt động cả khi API sitemap chưa có categories)
  try {
    const tree = await fetchCategoryTree();
    const slugs: string[] = [];
    flattenCategorySlugs(tree.items || [], slugs);
    for (const slug of [...new Set(slugs)]) {
      push({
        url: `${SHOP_ORIGIN}/danh-muc/${encodeURIComponent(slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    /* bỏ qua — catalog vẫn chạy bình thường */
  }

  return entries;
}
