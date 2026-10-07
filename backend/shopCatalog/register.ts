/**
 * Catalog API shop — đăng ký route + helper (tách từ shopApi.ts, hành vi giữ nguyên).
 * Entry public vẫn là server/shopApi.ts (re-export).
 * Orchestrator delegating to modular route handlers in ./routes/ and helpers in ./catalog/
 */
import type { Express } from "express";
import { catalogPriceContext } from "../shopWholesale/priceContext.js";
import { setCors } from "./catalog/cors.js";
import type { GetDb, CatalogCtx } from "./catalog/types.js";
import { registerMetaRoutes } from "./routes/meta.routes.js";
import { registerProductListRoutes } from "./routes/products.routes.js";
import { registerFacetRoutes } from "./routes/facets.routes.js";
import { registerProductDetailRoutes } from "./routes/productDetail.routes.js";
import { registerCtvClickRoutes } from "./routes/ctvClick.routes.js";
import { registerCatalogStreamRoutes } from "./routes/stream.routes.js";
import { registerCacheAdminRoutes } from "./routes/cacheAdmin.routes.js";
import { registerShareMediaRoutes } from "./routes/shareMedia.routes.js";

export { loadRevenueRankMap } from "./catalog/bestsellers.js";

export function registerShopApi(
  app: Express,
  getDb: GetDb,
  getShopDb?: GetDb,
  _getCatalogSourceDb?: GetDb
) {
  /** Catalog/SP shop ưu tiên shop DB khi có getShopDb. */
  const catalogDb = getShopDb || getDb;
  app.use(
    ["/api/shop/products", "/api/shop/facets", "/api/shop/resolve"],
    catalogPriceContext(catalogDb)
  );
  app.options("/api/shop/*", (req, res) => {
    setCors(req, res);
    res.status(204).end();
  });

  const ctx: CatalogCtx = { getDb, catalogDb, getShopDb };
  registerMetaRoutes(app, ctx);
  registerProductListRoutes(app, ctx);
  registerFacetRoutes(app, ctx);
  registerProductDetailRoutes(app, ctx);
  registerCtvClickRoutes(app, ctx);
  registerCatalogStreamRoutes(app, ctx);
  registerCacheAdminRoutes(app, ctx);
  registerShareMediaRoutes(app);
}
