/**
 * Routes:
 * 1. GET /api/shop/products/:ma/variants (MUST BE REGISTERED BEFORE /:ma)
 * 2. GET /api/shop/products/:ma
 * 3. GET /api/shop/resolve
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { COL } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import {
  shopFilterBase,
  toPublicProduct,
  findByProductSlug,
} from "../catalog/publicProduct.js";
import {
  findAttrSiblings,
  findUnitPairDocs,
  buildAxesAndModels,
  isComboOrFormulaProduct,
  resolveShopDisplayTon,
  normalizeAttrs,
} from "../../shopVariantGroup.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFieldsMany,
  overlayProductCategoryFields,
} from "../categoryMeta.js";
import {
  loadPriceBooksByMa,
  overlayDocsWithPriceBooks,
  applyPriceBookOverlay,
} from "../priceOverlay.js";
import {
  subtractHeldFromPublicItems,
  availableTonAfterHold,
} from "../../shopOrders/stockHold.js";
import { isShopTestBuyerEmail } from "../../shopOrders/checkoutFlags.js";
import { requestShopBuyerEmail } from "../catalog/priceContext.js";
import { withCampaignPromos } from "../../shopCampaigns/catalogPromos.js";

export function registerProductDetailRoutes(app: Express, ctx: CatalogCtx) {
  /** Biến thể + ĐVT — chỉ đọc Mongo. */
  app.get("/api/shop/products/:ma/variants", async (req, res) => {
    setCors(req, res);
    try {
      const ma = String(req.params.ma || "").trim();
      if (!ma) {
        res.status(400).json({ error: "missing_ma" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      const db = await ctx.catalogDb();
      const seed = await db.collection(COL).findOne({
        $and: [
          ...(shopFilterBase().$and as object[]),
          {
            $or: [
              { ma },
              { ma: ma.toUpperCase() },
              { ma: ma.toLowerCase() },
              { _id: ma },
            ],
          },
        ],
      } as any);
      if (!seed) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const attrSiblings = await findAttrSiblings(db, COL, seed as any, 40);
      const unitPair = await findUnitPairDocs(db, COL, seed as any);
      const byMa = new Map<string, Record<string, unknown>>();
      for (const d of [...attrSiblings, ...unitPair]) {
        const k = String(d.ma || "").trim().toUpperCase();
        if (k) byMa.set(k, d);
      }
      const rawDocs = [...byMa.values()];
      const metaById = await loadCategoryMetaById(db);
      const alignedDocs = overlayProductCategoryFieldsMany(rawDocs, metaById);
      const pbByMa = await loadPriceBooksByMa(
        db,
        alignedDocs.map((d) => String(d.ma || "").trim())
      );
      const docs = overlayDocsWithPriceBooks(alignedDocs, pbByMa);
      byMa.clear();
      for (const d of docs) {
        const k = String(d.ma || "").trim().toUpperCase();
        if (k) byMa.set(k, d);
      }
      const packed = buildAxesAndModels(docs, toPublicProduct as any, String((seed as any).ma || ma));
      // Chỉ combo/công thức (ton=0): gắn tồn hiển thị — không đụng mã thường hết hàng.
      const models: typeof packed.models = [];
      for (const m of packed.models) {
        const src = byMa.get(m.ma.toUpperCase());
        if (!src || !isComboOrFormulaProduct(src) || m.ton > 0) {
          models.push(m);
          continue;
        }
        const ton = await resolveShopDisplayTon(db, COL, src, docs);
        models.push(ton !== m.ton ? { ...m, ton } : m);
      }
      const modelsAvail = await subtractHeldFromPublicItems(db, models);
      const currentMa = String(packed.current?.ma || (seed as any).ma || ma).toUpperCase();
      const current =
        modelsAvail.find((m) => m.ma.toUpperCase() === currentMa) ||
        (packed.current
          ? (await subtractHeldFromPublicItems(db, [packed.current]))[0]
          : null);
      // Chỉ trả khi có gì để chọn
      const useful =
        packed.axes.length > 0 &&
        (modelsAvail.length > 1 ||
          packed.axes.some((a) => a.values.length > 1) ||
          (normalizeAttrs((seed as any).attributes).length > 0 && packed.axes.length > 0));
      res.json({
        ok: true,
        current: current || null,
        axes: useful ? packed.axes : [],
        models: useful ? modelsAvail : current ? [current] : [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "variants_failed" });
    }
  });

  app.get("/api/shop/products/:ma", async (req, res) => {
    setCors(req, res);
    try {
      const ma = String(req.params.ma || "").trim();
      if (!ma) {
        res.status(400).json({ error: "missing_ma" });
        return;
      }
      // Không Redis — giá/tồn phải khớp Mongo ngay (giỏ/search đã no-cache).
      res.setHeader("Cache-Control", "no-store");
      const db = await ctx.catalogDb();
      const doc = await db.collection(COL).findOne({
        $and: [
          ...(shopFilterBase().$and as object[]),
          {
            $or: [
              { ma },
              { ma: ma.toUpperCase() },
              { ma: ma.toLowerCase() },
              { _id: ma },
              { _id: ma.toUpperCase() },
            ],
          },
        ],
      } as any);
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const maKey = String((doc as any).ma || ma).trim().toUpperCase();
      const pbByMa = await loadPriceBooksByMa(db, [maKey]);
      const metaById = await loadCategoryMetaById(db);
      const overlaid = applyPriceBookOverlay(
        overlayProductCategoryFields(doc as any, metaById),
        pbByMa.get(maKey)
      );
      const item = toPublicProduct(overlaid);
      if (
        !(Number(item.gia) > 0) && item.priceKind !== "si_missing" &&
        !isShopTestBuyerEmail(requestShopBuyerEmail(req))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      let ton = item.ton;
      if (ton <= 0 && isComboOrFormulaProduct(overlaid)) {
        ton = await resolveShopDisplayTon(db, COL, overlaid);
      }
      ton = await availableTonAfterHold(db, item.ma, ton);
      res.setHeader("X-Shop-Cache", "BYPASS");
      const [withPromo] = (await withCampaignPromos(db, req, [ton !== item.ton ? { ...item, ton } : item])).items;
      res.json({ item: withPromo });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "product_failed" });
    }
  });

  /** Resolve /c/.../p/... → mã SP công khai */
  app.get("/api/shop/resolve", async (req, res) => {
    setCors(req, res);
    try {
      const pathRaw = String(req.query.path || "").trim();
      const productSlugQ = String(req.query.productSlug || "").trim();
      let slug = productSlugQ;
      if (!slug && pathRaw) {
        const m = pathRaw.match(/\/p\/([^/?#]+)/i);
        if (m) slug = decodeURIComponent(m[1]);
      }
      if (!slug) {
        res.status(400).json({ error: "missing_path" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      const db = await ctx.catalogDb();
      const doc = await findByProductSlug(db, slug);
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const maKey = String((doc as any).ma || "").trim().toUpperCase();
      const pbByMa = await loadPriceBooksByMa(db, [maKey]);
      const metaById = await loadCategoryMetaById(db);
      const overlaid = applyPriceBookOverlay(
        overlayProductCategoryFields(doc as any, metaById),
        pbByMa.get(maKey)
      );
      const item = toPublicProduct(overlaid);
      if (
        !(Number(item.gia) > 0) && item.priceKind !== "si_missing" &&
        !isShopTestBuyerEmail(requestShopBuyerEmail(req))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const ton = await availableTonAfterHold(db, item.ma, item.ton);
      res.setHeader("X-Shop-Cache", "BYPASS");
      const [withPromo] = (await withCampaignPromos(db, req, [ton !== item.ton ? { ...item, ton } : item])).items;
      res.json({ item: withPromo });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "resolve_failed" });
    }
  });
}
