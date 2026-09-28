/**
 * Meta routes:
 * GET /api/shop/health
 * GET /api/shop/categories
 * GET /api/shop/category-tree
 */
import type { Express } from "express";
import { redisReady } from "../../redis.js";
import type { CatalogCtx } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { cachedJson } from "../catalog/cache.js";
import { slugify } from "../catalog/text.js";
import { buildShopKvCategoryTree } from "../catalog/categoryTree.js";
import type { CategoryNode } from "../../utils/categoryTree.ts";

export function registerMetaRoutes(app: Express, ctx: CatalogCtx) {
  app.get("/api/shop/health", async (req, res) => {
    setCors(req, res);
    const redis = await redisReady();
    res.json({ ok: true, redis, at: Date.now() });
  });

  app.get("/api/shop/categories", async (req, res) => {
    setCors(req, res);
    try {
      const { body, cache } = await cachedJson("shop:categories:v4", async () => {
        const db = await ctx.catalogDb();
        const { tree } = await buildShopKvCategoryTree(db);
        const items: Array<{
          name: string;
          path: string;
          slug: string;
          count: number;
        }> = [];
        const walk = (nodes: CategoryNode[], prefix: string[]) => {
          for (const n of nodes) {
            const name = String(n.name || "").trim() || "Khác";
            const pathSegs = [...prefix, name];
            const path = pathSegs.join(" >> ");
            const leaf = name;
            items.push({
              name,
              path,
              slug: slugify(leaf) || "khac",
              count: Number((n as typeof n & { productCount?: number }).productCount ?? n.count ?? 0) || 0,
            });
            if (n.children?.length) walk(n.children, pathSegs);
          }
        };
        walk(tree, []);
        items.sort((a, b) => b.count - a.count);
        return { items: items.slice(0, 200) };
      });
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "categories_failed" });
    }
  });

  app.get("/api/shop/category-tree", async (req, res) => {
    setCors(req, res);
    try {
      const { body, cache } = await cachedJson("shop:category-tree:v12", async () => {
        const db = await ctx.catalogDb();
        const { items } = await buildShopKvCategoryTree(db);
        return { items };
      });
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "category_tree_failed" });
    }
  });
}
