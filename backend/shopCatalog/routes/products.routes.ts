/**
 * Routes:
 * GET /api/shop/products
 * OPTIONS /api/shop/products/prices
 * POST /api/shop/products/prices
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { COL } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { cachedJson, TTL_SEC } from "../catalog/cache.js";
import { viLooseRegex, normalizeMa } from "../catalog/text.js";
import {
  parseNhomQuery,
  parseCategoryIdQuery,
  resolveCategoryIdsForRootIds,
  resolveCategoryIdsForPaths,
  mergeCategoryFilters,
  buildHomeScopeFilter,
} from "../catalog/categoryFilters.js";
import { loadRevenueRankMap } from "../catalog/bestsellers.js";
import {
  shopFilterBase,
  filterRequirePublicImage,
  toPublicProduct,
  sortPublicItems,
  productCreatedMs,
  dedupeListItems,
} from "../catalog/publicProduct.js";
import {
  mapDocsToPublicWithPriceBooks,
  requestShopBuyerEmail,
  filterZeroPriceUnlessTestBuyer,
} from "../catalog/priceContext.js";
import {
  mongoAttrFilter,
  mongoDvtFilter,
  parseAttrQuery,
  parseDvtQuery,
  isComboOrFormulaProduct,
  resolveShopDisplayTon,
} from "../../shopVariantGroup.js";
import { mongoLoaiFilter } from "../../utils/kvProductLoai.js";
import { discountMongoFilter, normalizeWebBadge, webBadgeMongoFilter } from "../webBadge.js";
import { resolvePinBadgeScope, arrangeByAbsolutePin } from "../pinArrange.js";
import { isShopTestBuyerEmail } from "../../shopOrders/checkoutFlags.js";
import {
  loadPriceBooksByMa,
  applyPriceBookOverlay,
} from "../priceOverlay.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFields,
} from "../categoryMeta.js";
import { subtractHeldFromPublicItems } from "../../shopOrders/stockHold.js";
import {
  campaignDealInfo,
  campaignDealMas,
  dealInfoCacheSuffix,
  dealMasCacheSuffix,
  withCampaignPromos,
} from "../../shopCampaigns/catalogPromos.js";
import type { CatalogDealInfo } from "../catalog/publicProduct.js";
import { parseVoucherQuery, voucherProductFilter } from "../../shopPromotions/voucherProductFilter.js";

export function registerProductListRoutes(app: Express, ctx: CatalogCtx) {
  app.get("/api/shop/products", async (req, res) => {
    setCors(req, res);
    try {
      const q = String(req.query.q || "").trim();
      const nhomList = parseNhomQuery(req);
      const categoryIdList = parseCategoryIdQuery(req);
      const homeScope = String(req.query.home || "") === "1";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 24));
      const minPrice = Math.max(0, Number(req.query.minPrice) || 0);
      const maxPrice = Math.max(0, Number(req.query.maxPrice) || 0);
      const inStock = String(req.query.inStock || "") === "1";
      const maxTon = Math.max(0, Math.min(999, Number(req.query.maxTon) || 0));
      const attrFilters = parseAttrQuery(req.query.attr);
      const dvtFilters = parseDvtQuery(req.query.dvt);
      const loai = String(req.query.loai || "").trim();
      const badgeRaw = String(req.query.badge || req.query.webBadge || "").trim();
      const badge = normalizeWebBadge(badgeRaw);
      const sortRaw = String(req.query.sort || "ban_chay").trim();
      const sort =
        sortRaw === "bestsellers" || sortRaw === "ban-chay"
          ? "ban_chay"
          : sortRaw === "newest"
            ? "moi"
            : sortRaw === "ten" || sortRaw === "ton_desc"
              ? "ban_chay"
              : sortRaw;
      const skip = (page - 1) * limit;
      const buyerEmail = requestShopBuyerEmail(req);
      const showZeroPrice = isShopTestBuyerEmail(buyerEmail);
      const needPostFilter =
        minPrice > 0 ||
        maxPrice > 0 ||
        inStock ||
        maxTon > 0 ||
        sort !== "ten" ||
        attrFilters.length > 0 ||
        dvtFilters.length > 0 ||
        Boolean(loai);
      const dealMas = badge === "uu_dai" ? await campaignDealMas(await ctx.catalogDb(), req) : [];
      const deals =
        sort === "giam_gia" ? await campaignDealInfo(await ctx.catalogDb(), req) : new Map<string, CatalogDealInfo>();
      const voucherId = parseVoucherQuery(req.query.voucher);
      const voucher = voucherId ? await voucherProductFilter(await ctx.catalogDb(), voucherId) : null;
      const cacheKey = `shop:products:v38:${q}|cid=${categoryIdList.join(",")}|${nhomList.join("||")}|home=${homeScope ? 1 : 0}|badge=${badge}${dealMasCacheSuffix(dealMas)}|v=${voucherId}|${page}|${limit}|${minPrice}|${maxPrice}|${inStock}|maxTon=${maxTon}|${sort}${dealInfoCacheSuffix(deals)}|${attrFilters.map((a) => `${a.attributeName}:${a.attributeValue}`).join(";")}|${dvtFilters.join(",")}|${loai}|z=${showZeroPrice ? 1 : 0}`;
      const pinScope = resolvePinBadgeScope({ sort, badge, maxTon });

      const { body, cache } = await cachedJson(cacheKey, async () => {
        const db = await ctx.catalogDb();
        const filter: Record<string, unknown> = { ...shopFilterBase() };
        const and = [...((filter.$and as unknown[]) || [])];
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
        if (maxTon > 0) {
          and.push({
            $or: [
              { ton: { $gt: 0, $lte: maxTon } },
              { onHand: { $gt: 0, $lte: maxTon } },
              { kvTon: { $gt: 0, $lte: maxTon } },
            ],
          });
        } else if (inStock) {
          and.push({
            $or: [{ ton: { $gt: 0 } }, { onHand: { $gt: 0 } }, { kvTon: { $gt: 0 } }],
          });
        }
        const attrMongo = mongoAttrFilter(attrFilters);
        if (attrMongo) and.push(attrMongo);
        const dvtMongo = mongoDvtFilter(dvtFilters);
        if (dvtMongo) and.push(dvtMongo);
        const loaiMongo = mongoLoaiFilter(loai);
        if (loaiMongo) and.push(loaiMongo);
        const badgeMongo = webBadgeMongoFilter(badge, dealMas);
        if (badgeMongo) and.push(badgeMongo);
        if (sort === "giam_gia") and.push(discountMongoFilter([...deals.keys()]));
        if (voucher && Object.keys(voucher.filter).length) and.push(voucher.filter);
        filter.$and = and;

        const col = db.collection(COL);
        const projection = {
          ma: 1,
          ten: 1,
          dvt: 1,
          categoryId: 1,
          categoryName: 1,
          ancestor: 1,
          attributes: 1,
          giaWeb: 1, giaSi: 1, allowBackorder: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          anh: 1,
          images: 1,
          videos: 1,
          videoUrl: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          barcode: 1,
          description: 1,
          isActive: 1,
          banTrucTiep: 1,
          trongLuong: 1,
          webPin: 1,
          webBadge: 1,
          kvId: 1,
          id: 1,
          createdAt: 1,
        };

        /** Bán chạy = xếp theo doanh thu HĐ (chỉ đọc). Không ghi aloha_products.
         *  Có lọc giá/ĐVT/attr/loại → đi path post-filter.
         *  inStock / maxTon vẫn dùng fast path (đã lọc sau khi rank doanh thu). */
        const banChayFastPath =
          sort === "ban_chay" &&
          !(
            minPrice > 0 ||
            maxPrice > 0 ||
            attrFilters.length > 0 ||
            dvtFilters.length > 0 ||
            Boolean(loai)
          );
        if (banChayFastPath) {
          const rank = await loadRevenueRankMap(db);
          const rankedMas = [...rank.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([ma]) => ma);

          if (rankedMas.length) {
            // Pins are absolute within the eligible list, including products
            // without revenue. Never paginate either group before applying pins.
            // Preserve the low-stock rule: only revenue-ranked products qualify.
            const eligibleFilter = maxTon > 0
              ? {
                  $and: [
                    ...and,
                    { $expr: { $in: [{ $toUpper: { $ifNull: ["$ma", ""] } }, rankedMas] } },
                  ],
                }
              : filter;
            const eligibleDocs = await col
              .find(eligibleFilter as any)
              .project(projection)
              .toArray();
            const mapped = await mapDocsToPublicWithPriceBooks(db, eligibleDocs as any[]);
            let items = dedupeListItems(mapped.docs, mapped.items);
            if (minPrice > 0) items = items.filter((p) => p.gia >= minPrice);
            if (maxPrice > 0) items = items.filter((p) => p.gia <= maxPrice);
            if (inStock) items = items.filter((p) => p.ton > 0);
            if (maxTon > 0) items = items.filter((p) => p.ton > 0 && p.ton <= maxTon);
            items = filterRequirePublicImage(items);
            const ranked = items.filter((p) => rank.has(normalizeMa(p.ma))).length;
            items = arrangeByAbsolutePin(
              items,
              (a, b) => {
                const ma = normalizeMa(a.ma);
                const mb = normalizeMa(b.ma);
                // Keep ranked products ahead of unranked products, even if a
                // revenue entry is zero/negative (e.g. after returns).
                const group = Number(rank.has(mb)) - Number(rank.has(ma));
                if (group) return group;
                const revenue = (rank.get(mb) || 0) - (rank.get(ma) || 0);
                return revenue || a.ten.localeCompare(b.ten, "vi") || ma.localeCompare(mb);
              },
              badge || "ban_chay_sap_het"
            );
            const total = items.length;
            return {
              items: items.slice(skip, skip + limit),
              total,
              page,
              limit,
              pages: Math.max(1, Math.ceil(total / limit)),
              sortMode: "ban_chay",
              ranked,
            };
          }
          // Chưa có HĐ doanh thu → xếp theo tên (không dùng tồn)
        }

        if (!needPostFilter) {
          // Khi limit === 1 (ví dụ preview đếm), nếu không có post-filter phức tạp, chỉ count và lấy 1 item
          if (limit === 1 && page === 1) {
            const [total, sampleDocs] = await Promise.all([
              col.countDocuments(filter as any),
              col.find(filter as any).project(projection).limit(1).toArray(),
            ]);
            const sampleMapped = await mapDocsToPublicWithPriceBooks(db, sampleDocs as any[]);
            const sampleItems = filterRequirePublicImage(
              filterZeroPriceUnlessTestBuyer(
                dedupeListItems(sampleMapped.docs, sampleMapped.items),
                buyerEmail
              )
            );
            return {
              items: sampleItems.slice(0, 1),
              total,
              page: 1,
              limit: 1,
              pages: Math.max(1, total),
            };
          }

          // Quét đủ rồi dedupe → total/pages khớp số card (shop ~3k SP)
          const docs = await col
            .find(filter as any)
            .project(projection)
            .sort({ ten: 1 })
            .limit(5000)
            .toArray();
          const mapped = await mapDocsToPublicWithPriceBooks(db, docs as any[]);
          const createdMsByMa = new Map<string, number>();
          for (const d of mapped.docs as Record<string, unknown>[]) {
            const ma = normalizeMa(d.ma);
            if (!ma) continue;
            const ms = productCreatedMs(d);
            const prev = createdMsByMa.get(ma) || 0;
            if (ms >= prev) createdMsByMa.set(ma, ms);
          }
          const all = filterRequirePublicImage(
            filterZeroPriceUnlessTestBuyer(
              sortPublicItems(
                dedupeListItems(mapped.docs, mapped.items),
                sort,
                createdMsByMa,
                pinScope,
                deals
              ),
              buyerEmail
            )
          );
          const total = all.length;
          return {
            items: all.slice(skip, skip + limit),
            total,
            page,
            limit,
            pages: Math.max(1, Math.ceil(total / limit)),
          };
        }

        // Lọc giá / sort phức tạp trên bản công khai (sau khi map giá web + price books)
        // Tối ưu: Khi chỉ preview đếm kết quả (limit: 1 và page: 1), chỉ cần project các trường tối thiểu cần thiết để lọc
        const docs = await col
          .find(filter as any)
          .project(limit === 1 && page === 1 ? { ma: 1, ten: 1, giaWeb: 1, giaBan: 1, basePrice: 1, ton: 1, onHand: 1, kvTon: 1, anh: 1, images: 1, categoryId: 1, createdAt: 1 } : projection)
          .limit(5000)
          .toArray();
        const mapped = await mapDocsToPublicWithPriceBooks(db, docs as any[]);
        let items = filterZeroPriceUnlessTestBuyer(
          dedupeListItems(mapped.docs, mapped.items),
          buyerEmail
        );
        if (minPrice > 0) items = items.filter((p) => p.gia >= minPrice);
        if (maxPrice > 0) items = items.filter((p) => p.gia <= maxPrice);
        if (inStock) items = items.filter((p) => p.ton > 0);
        if (maxTon > 0) {
          items = items.filter((p) => p.ton > 0 && p.ton <= maxTon);
        }
        items = filterRequirePublicImage(items);

        // Khi preview đếm (limit: 1), bỏ qua sắp xếp tốn kém
        if (limit === 1 && page === 1) {
          const total = items.length;
          return {
            items: items.slice(0, 1),
            total,
            page: 1,
            limit: 1,
            pages: Math.max(1, total),
            sortMode: sort,
          };
        }

        const createdMsByMa = new Map<string, number>();
        for (const d of mapped.docs as Record<string, unknown>[]) {
          const ma = normalizeMa(d.ma);
          if (!ma) continue;
          const ms = productCreatedMs(d);
          const prev = createdMsByMa.get(ma) || 0;
          if (ms >= prev) createdMsByMa.set(ma, ms);
        }
        items = sortPublicItems(items, sort, createdMsByMa, pinScope, deals);

        const total = items.length;
        const pageItems = items.slice(skip, skip + limit);
        return {
          items: pageItems,
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
          sortMode: sort,
        };
      }, TTL_SEC);
      const promo = await withCampaignPromos(await ctx.catalogDb(), req, (body as any)?.items || []);
      if (cache === "BYPASS" || promo.noStore) {
        res.setHeader("Cache-Control", "no-store");
      } else {
        res.setHeader(
          "Cache-Control",
          `public, max-age=0, s-maxage=${TTL_SEC}, stale-while-revalidate=60, must-revalidate`
        );
      }
      res.setHeader("X-Shop-Cache", cache);
      const voucherInfo = voucher ? { voucher: { id: voucherId, title: voucher.title } } : {};
      res.json(Array.isArray((body as any)?.items) ? { ...(body as any), items: promo.items, ...voucherInfo } : body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "products_failed" });
    }
  });

  /** Giá hiện tại theo mã — không cache (dùng làm mới giỏ/checkout). */
  app.options("/api/shop/products/prices", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.post("/api/shop/products/prices", async (req, res) => {
    setCors(req, res);
    try {
      const raw: unknown[] = Array.isArray(req.body?.mas) ? req.body.mas : [];
      const mas = [
        ...new Set(
          raw
            .map((x: unknown) => String(x || "").trim().toUpperCase())
            .filter(Boolean)
            .slice(0, 80)
        ),
      ];
      if (!mas.length) {
        res.json({ items: [] });
        return;
      }
      const db = await ctx.catalogDb();
      const docs = await db
        .collection(COL)
        .find({
          $and: [
            ...(shopFilterBase().$and as object[]),
            {
              $or: [
                { ma: { $in: mas } },
                { ma: { $in: mas.map((m) => m.toLowerCase()) } },
              ],
            },
          ],
        } as any)
        .project({
          ma: 1,
          ten: 1,
          dvt: 1,
          anh: 1,
          images: 1,
          videos: 1,
          videoUrl: 1,
          giaWeb: 1, giaSi: 1, allowBackorder: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          trongLuong: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          categoryId: 1,
          categoryName: 1,
          ancestor: 1,
          isActive: 1,
          type: 1,
          productType: 1,
          loai: 1,
          hasFormula: 1,
          productFormulas: 1,
          formulas: 1,
          hangThanhPhan: 1,
          attributes: 1,
        })
        .toArray();

      const byMa = new Map<string, Record<string, unknown>>();
      for (const d of docs) {
        const key = String((d as any).ma || "").trim().toUpperCase();
        if (key) byMa.set(key, d as any);
      }

      const pbByMa = await loadPriceBooksByMa(db, mas);
      const metaById = await loadCategoryMetaById(db);
      const items: Array<ReturnType<typeof toPublicProduct>> = [];
      for (const ma of mas) {
        const raw = byMa.get(ma);
        if (!raw) continue;
        const doc = applyPriceBookOverlay(
          overlayProductCategoryFields(raw, metaById),
          pbByMa.get(ma)
        );
        const p = toPublicProduct(doc);
        let ton = p.ton;
        if (ton <= 0 && isComboOrFormulaProduct(doc)) {
          ton = await resolveShopDisplayTon(db, COL, doc);
        }
        items.push({
          ...p,
          ma: p.ma,
          gia: p.gia,
          priceKind: p.priceKind,
          allowBackorder: p.allowBackorder,
          ton,
          ten: p.ten,
          anh: p.anh,
          path: p.path,
          dvt: p.dvt,
          trongLuong: p.trongLuong,
          attributes: p.attributes,
          isActive: p.isActive,
        });
      }

      res.setHeader("Cache-Control", "no-store");
      const available = await subtractHeldFromPublicItems(db, items);
      res.json({ items: (await withCampaignPromos(db, req, available)).items });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "prices_failed" });
    }
  });
}
