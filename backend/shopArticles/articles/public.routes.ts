import type { Express, Response } from "express";
import type { GetDb } from "../../auth/middleware.js";
import type { GetShopDb } from "../../shopOrders/routes.js";
import {
  ARTICLES_COL,
} from "../types.js";
import {
  ensureReady,
  publicFilter,
  toPublicList,
  toPublicDetail,
  toMiniProduct,
  resolveProductsByMas,
  PRODUCTS_COL,
} from "./helpers.js";

export function registerArticlesPublicRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  // —— Public list ——
  app.get("/api/shop/articles", async (req, res: Response) => {
    try {
      const shopDb = await getShopDb();
      await ensureReady(shopDb);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
      const category = String(req.query.category || "").trim();
      const q = String(req.query.q || "").trim().slice(0, 80);
      const filter: Record<string, unknown> = { ...publicFilter() };
      if (category) filter.category = category;
      if (q) {
        const rx = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { title: { $regex: rx, $options: "i" } },
          { excerpt: { $regex: rx, $options: "i" } },
          { category: { $regex: rx, $options: "i" } },
          { bodyHtml: { $regex: rx, $options: "i" } },
          { slug: { $regex: rx, $options: "i" } },
        ];
      }

      const col = shopDb.collection(ARTICLES_COL);
      const [total, rows] = await Promise.all([
        col.countDocuments(filter as any),
        col
          .find(filter as any)
          .sort({ publishedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
      ]);
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({
        items: rows.map((d) => toPublicList(d as any)),
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "articles_list_failed" });
    }
  });

  // —— Public categories ——
  app.get("/api/shop/articles/categories", async (_req, res: Response) => {
    try {
      const shopDb = await getShopDb();
      await ensureReady(shopDb);
      const rows = await shopDb
        .collection(ARTICLES_COL)
        .aggregate([
          { $match: publicFilter() },
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $match: { _id: { $nin: [null, ""] } } },
          { $sort: { count: -1 } },
        ])
        .toArray();
      res.json({
        items: rows.map((r) => ({
          category: String(r._id),
          count: Number(r.count) || 0,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "categories_failed" });
    }
  });

  // —— Sitemap data (static + products + articles) ——
  app.get("/api/shop/sitemap-data", async (_req, res: Response) => {
    try {
      const [shopDb, mainDb] = await Promise.all([getShopDb(), getDb()]);
      await ensureReady(shopDb);
      const now = new Date().toISOString();

      const articles = await shopDb
        .collection(ARTICLES_COL)
        .find(publicFilter(now) as any)
        .project({ slug: 1, updatedAt: 1, publishedAt: 1 })
        .sort({ publishedAt: -1 })
        .limit(5000)
        .toArray();

      const productDocs = await mainDb
        .collection(PRODUCTS_COL)
        .find({
          $and: [
            { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
            {
              $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
            },
          ],
        } as any)
        .project({
          ma: 1,
          ten: 1,
          nhom: 1,
          nhomPath: 1,
          categoryName: 1,
          updatedAt: 1,
        })
        .limit(20000)
        .toArray();

      const products = productDocs.map((d) => {
        const mini = toMiniProduct(d as any);
        return {
          path: mini.path,
          lastModified: d.updatedAt ? String(d.updatedAt) : undefined,
        };
      });

      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({
        static: [
          { path: "/", priority: 1, changeFrequency: "daily" },
          { path: "/tim", priority: 0.8, changeFrequency: "daily" },
          { path: "/bai-viet", priority: 0.7, changeFrequency: "daily" },
        ],
        articles: articles.map((a) => ({
          path: `/bai-viet/${a.slug}`,
          lastModified: String(a.updatedAt || a.publishedAt || now),
        })),
        products,
        categories: [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "sitemap_failed" });
    }
  });

  // —— Public detail by slug (incl. previousSlugs → redirectTo) ——
  app.get("/api/shop/articles/:slug", async (req, res: Response) => {
    try {
      const shopDb = await getShopDb();
      await ensureReady(shopDb);
      const slug = String(req.params.slug || "").trim();
      if (!slug) {
        res.status(400).json({ error: "missing_slug" });
        return;
      }
      const col = shopDb.collection(ARTICLES_COL);
      const now = new Date().toISOString();
      const filter = publicFilter(now);

      let doc = (await col.findOne({
        slug,
        ...filter,
      } as any)) as (import("../types.js").ShopArticleDoc & { _id?: unknown }) | null;

      if (!doc) {
        const byOld = (await col.findOne({
          previousSlugs: slug,
          ...filter,
        } as any)) as (import("../types.js").ShopArticleDoc & { _id?: unknown }) | null;
        if (byOld?.slug) {
          res.json({ redirectTo: byOld.slug });
          return;
        }
        // Admin preview? only 404 for public
        res.status(404).json({ error: "not_found", message: "Không tìm thấy bài viết." });
        return;
      }

      const mainDb = await getDb();
      const products = await resolveProductsByMas(
        mainDb,
        Array.isArray(doc.productMas) ? doc.productMas : []
      );

      let related: ReturnType<typeof toPublicList>[] = [];
      if (doc.category) {
        const rel = await col
          .find({
            ...filter,
            category: doc.category,
            slug: { $ne: doc.slug },
          } as any)
          .sort({ publishedAt: -1 })
          .limit(3)
          .toArray();
        related = rel.map((d) => toPublicList(d as any));
      }

      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({
        item: toPublicDetail(doc),
        products,
        related,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "article_detail_failed" });
    }
  });
}
