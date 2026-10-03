/**
 * Route: GET /api/shop/facets
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { COL } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { cachedJson } from "../catalog/cache.js";
import { viLooseRegex } from "../catalog/text.js";
import {
  parseNhomQuery,
  parseCategoryIdQuery,
  resolveCategoryIdsForRootIds,
  resolveCategoryIdsForPaths,
  mergeCategoryFilters,
  buildHomeScopeFilter,
} from "../catalog/categoryFilters.js";
import { shopFilterBase } from "../catalog/publicProduct.js";
import {
  compactAttributeFacets,
  compactDvtFacetLabels,
} from "../../shopVariantGroup.js";
import { normalizeWebBadge, webBadgeMongoFilter } from "../webBadge.js";
import { campaignDealMas, dealMasCacheSuffix } from "../../shopCampaigns/catalogPromos.js";

export function registerFacetRoutes(app: Express, ctx: CatalogCtx) {
  app.get("/api/shop/facets", async (req, res) => {
    setCors(req, res);
    try {
      const q = String(req.query.q || "").trim();
      const nhomList = parseNhomQuery(req);
      const categoryIdList = parseCategoryIdQuery(req);
      const homeScope = String(req.query.home || "") === "1";
      /** Trang «Tất cả sản phẩm» (/tim) — facets toàn catalog. */
      const allCatalog = String(req.query.all || "") === "1";
      const badgeRaw = String(req.query.badge || req.query.webBadge || "").trim();
      const badge = normalizeWebBadge(badgeRaw);
      // Không có mục/từ khóa → không dump cả shop; trang chủ dùng home=1; /tim dùng all=1
      const scoped =
        categoryIdList.length > 0 ||
        nhomList.length > 0 ||
        Boolean(q) ||
        homeScope ||
        allCatalog ||
        Boolean(badge);
      const dealMas = badge === "uu_dai" ? await campaignDealMas(await ctx.catalogDb(), req) : [];
      const cacheKey = `shop:facets:v7:${q}|cid=${categoryIdList.join(",")}|${nhomList.join("||")}|home=${homeScope ? 1 : 0}|all=${allCatalog ? 1 : 0}|badge=${badge}${dealMasCacheSuffix(dealMas)}|${scoped ? "1" : "0"}`;
      const { body, cache } = await cachedJson(cacheKey, async () => {
        if (!scoped) {
          return { attributes: {}, dvt: ["Cái", "Cây", "Thùng", "Gói", "Bao"] };
        }
        const db = await ctx.catalogDb();
        const and = [...((shopFilterBase().$and as unknown[]) || [])];
        if (q) {
          const rx = viLooseRegex(q);
          and.push({
            $or: [
              { ma: rx },
              { ten: rx },
              { barcode: rx },
              { categoryName: rx },
              { ancestor: rx },
            ],
          });
        }
        const badgeMongo = webBadgeMongoFilter(badge, dealMas);
        if (badgeMongo) and.push(badgeMongo);
        if (categoryIdList.length) {
          const catIds = await resolveCategoryIdsForRootIds(db, categoryIdList);
          if (catIds.length) and.push({ categoryId: { $in: catIds } });
        } else if (nhomList.length) {
          const catIds = await resolveCategoryIdsForPaths(db, nhomList);
          const catFilter = mergeCategoryFilters(nhomList, catIds);
          if (catFilter) and.push(catFilter);
        } else if (homeScope) {
          const homeFilter = await buildHomeScopeFilter(db);
          if (homeFilter) and.push(homeFilter);
        }
        // allCatalog: chỉ shopFilterBase — toàn bộ SP đang bán
        const match = { $and: and };
        const attrLimit = allCatalog ? 1200 : 500;
        const dvtLimit = allCatalog ? 120 : 80;
        const [attrRows, dvtRows] = await Promise.all([
          db
            .collection(COL)
            .aggregate([
              { $match: match },
              { $unwind: { path: "$attributes", preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: {
                    n: {
                      $ifNull: ["$attributes.attributeName", { $ifNull: ["$attributes.name", ""] }],
                    },
                    v: {
                      $ifNull: [
                        "$attributes.attributeValue",
                        { $ifNull: ["$attributes.value", ""] },
                      ],
                    },
                  },
                  c: { $sum: 1 },
                },
              },
              { $match: { "_id.n": { $nin: [null, ""] }, "_id.v": { $nin: [null, ""] } } },
              { $sort: { c: -1 } },
              { $limit: attrLimit },
            ])
            .toArray(),
          db
            .collection(COL)
            .aggregate([
              { $match: match },
              { $group: { _id: { $ifNull: ["$dvt", "Cái"] }, c: { $sum: 1 } } },
              { $match: { _id: { $nin: [null, ""] } } },
              { $sort: { c: -1 } },
              { $limit: dvtLimit },
            ])
            .toArray(),
        ]);
        const attributes = compactAttributeFacets(
          attrRows.map((row) => ({
            name: String((row as any)?._id?.n || "").trim(),
            value: String((row as any)?._id?.v || "").trim(),
            count: Number((row as any)?.c) || 0,
          })),
          allCatalog
            ? { maxAttrs: 18, maxValues: 36 }
            : { maxAttrs: 10, maxValues: 24 }
        );
        const dvt = compactDvtFacetLabels(
          dvtRows.map((r) => ({
            label: String((r as any)._id || "").trim(),
            count: Number((r as any).c) || 0,
          })),
          allCatalog ? 24 : 10
        );
        return { attributes, dvt };
      }, 30);
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "facets_failed" });
    }
  });
}
