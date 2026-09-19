import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { normalizeString } from "../utils/helpers.ts";
import {
  buildShopCategoryMongoFilter,
  parseCategoryIdList,
  parseNhomList,
} from "../shopCatalog/categoryQueryFilter.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFields,
} from "../shopCatalog/categoryMeta.js";
import {
  isLowStockTon,
  isPreOrderTon,
  normalizeWebBadge,
  WEB_BADGE_VALUES,
} from "../shopCatalog/webBadge.js";
import { loadRevenueRankMap } from "../shopCatalog/register.js";

const COL = "aloha_products";
const LOW_STOCK_MAX = 8;

function publicPrice(doc: Record<string, unknown>): number {
  const n = Number(
    doc.giaWeb ?? doc.giaBan ?? doc.giaChung ?? doc.basePrice ?? 0
  );
  return Number.isFinite(n) ? n : 0;
}

function publicTon(doc: Record<string, unknown>): number {
  const n = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function publicAnh(doc: Record<string, unknown>): string {
  const anh = doc.anh;
  if (typeof anh === "string" && anh) return anh;
  const images = doc.images;
  if (Array.isArray(images) && images[0]) return String(images[0]);
  return "";
}

/** Tìm mã/tên bỏ dấu — «thanh pham» khớp «THÀNH PHẨM». */
function productMatchesQuery(
  doc: { ma?: unknown; ten?: unknown; barcode?: unknown },
  q: string
): boolean {
  const needle = normalizeString(q);
  if (!needle) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  const hay = normalizeString(
    [doc.ma, doc.ten, doc.barcode].map((x) => String(x || "")).join(" ")
  );
  if (!hay) return false;
  if (tokens.length <= 1) {
    return hay.includes(needle) || hay.replace(/\s+/g, "").includes(needle);
  }
  return tokens.every((t) => hay.includes(t) || hay.replace(/\s+/g, "").includes(t));
}

export function registerShopProductsAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb?: GetDb,
  _getCatalogSourceDb?: GetDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];
  const productsDb = getShopDb || getDb;

  app.get(
    "/api/shop/admin/products",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const q = String(req.query.q || "").trim();
        const nhomList = parseNhomList(req.query as Record<string, unknown>);
        const categoryIdList = parseCategoryIdList(
          req.query as Record<string, unknown>
        );
        const visible = String(req.query.visible || "all");
        const badge = String(req.query.badge || "all").trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));

        const and: object[] = [
          { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
        ];
        const catFilter = await buildShopCategoryMongoFilter(db, {
          nhomList,
          categoryIdList,
        });
        if (catFilter) and.push(catFilter);
        if (visible === "1" || visible === "0") {
          if (visible === "0") and.push({ hienThiWeb: false });
          else
            and.push({
              $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
            });
        }
        if (badge === "auto") {
          and.push({
            $or: [
              { webBadge: { $exists: false } },
              { webBadge: null },
              { webBadge: "" },
              { webBadge: { $nin: [...WEB_BADGE_VALUES, "ban_chay"] } },
            ],
          });
        } else {
          const n = normalizeWebBadge(badge);
          if (n === "ban_chay_sap_het") {
            and.push({ webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] } });
          } else if (n) {
            and.push({ webBadge: n });
          }
        }

        const filter = { $and: and };
        const col = db.collection(COL);
        const projection = {
          ma: 1,
          ten: 1,
          anh: 1,
          images: 1,
          categoryId: 1,
          categoryName: 1,
          ancestor: 1,
          giaWeb: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          hienThiWeb: 1,
          webPin: 1,
          webBadge: 1,
          barcode: 1,
          seoTitle: 1,
          seoDescription: 1,
        };

        let rows: any[];
        let total: number;
        const badgeNorm = normalizeWebBadge(badge);
        const sortPinned =
          badgeNorm && badge !== "auto"
            ? { webPin: 1 as const, ten: 1 as const }
            : { ten: 1 as const };

        if (q) {
          // Quét theo lọc nhóm/trạng thái rồi khớp bỏ dấu (kho ~ vài nghìn SP — ổn cho admin).
          const all = await col
            .find(filter as any)
            .project(projection)
            .sort(sortPinned)
            .toArray();
          const matched = all.filter((d) => productMatchesQuery(d, q));
          if (badgeNorm && badge !== "auto") {
            matched.sort((a, b) => {
              const pa = Number(a.webPin) > 0 ? Number(a.webPin) : 1e9;
              const pb = Number(b.webPin) > 0 ? Number(b.webPin) : 1e9;
              if (pa !== pb) return pa - pb;
              return String(a.ten || "").localeCompare(String(b.ten || ""), "vi");
            });
          }
          total = matched.length;
          rows = matched.slice((page - 1) * limit, page * limit);
        } else {
          [total, rows] = await Promise.all([
            col.countDocuments(filter as any),
            col
              .find(filter as any)
              .project(projection)
              .sort(sortPinned)
              .skip((page - 1) * limit)
              .limit(limit)
              .toArray(),
          ]);
        }

        const metaById = await loadCategoryMetaById(db);
        const items = rows.map((d) => {
          const aligned = overlayProductCategoryFields(d as any, metaById);
          const ancestor = Array.isArray(aligned.ancestor)
            ? aligned.ancestor.map((x: unknown) => String(x || "").trim()).filter(Boolean)
            : [];
          const categoryName = String(aligned.categoryName || "").trim();
          const nhomPath = ancestor.length
            ? ancestor.join(" >> ")
            : categoryName;
          const nhom = categoryName || (nhomPath.split(/\s*[▸>\/|]\s*/).filter(Boolean).pop() || "");
          return {
          ma: String(aligned.ma || ""),
          ten: String(aligned.ten || ""),
          anh: publicAnh(aligned as any),
          nhom,
          nhomPath: nhomPath || nhom,
          categoryId: Number(aligned.categoryId) || 0,
          categoryName,
          gia: publicPrice(aligned as any),
          ton: publicTon(aligned as any),
          hienThiWeb: aligned.hienThiWeb !== false,
          webPin: Number(aligned.webPin) > 0 ? Math.round(Number(aligned.webPin)) : 0,
          webBadge: normalizeWebBadge(aligned.webBadge),
          seoTitle: String(aligned.seoTitle || ""),
          seoDescription: String(aligned.seoDescription || ""),
        };
        });

        res.json({
          items,
          total,
          page,
          pages: Math.max(1, Math.ceil(total / limit)),
          limit,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "admin_products_failed" });
      }
    }
  );

  app.patch(
    "/api/shop/admin/products/:ma/merchandising",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const col = db.collection(COL);
        const maFilter = {
          $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
        } as any;
        const cur = await col.findOne(maFilter, {
          projection: { ma: 1, webBadge: 1, webPin: 1 },
        });
        if (!cur) {
          res.status(404).json({ error: "not_found" });
          return;
        }

        const $set: Record<string, unknown> = {
          merchandisingUpdatedAt: new Date().toISOString(),
        };
        let nextBadge = normalizeWebBadge(cur.webBadge);
        if (req.body?.webBadge !== undefined) {
          const rawBadge = String(req.body.webBadge ?? "").trim();
          if (rawBadge && !normalizeWebBadge(rawBadge)) {
            res.status(400).json({
              error: "invalid_web_badge",
              message: `Nhãn không hợp lệ: ${rawBadge}`,
            });
            return;
          }
          nextBadge = normalizeWebBadge(rawBadge);
          $set.webBadge = nextBadge;
        }

        let nextPin = Number(cur.webPin) > 0 ? Math.round(Number(cur.webPin)) : 0;
        if (req.body?.webPin !== undefined) {
          const n = Number(req.body.webPin);
          nextPin = Number.isFinite(n) && n > 0 ? Math.min(9999, Math.round(n)) : 0;
        }

        // Xóa nhãn → xóa ghim. Ghim khi chưa có nhãn → không lưu.
        if (!nextBadge) nextPin = 0;
        $set.webPin = nextPin;

        const clearedMas: string[] = [];
        if (nextBadge && nextPin > 0) {
          const badgeIn =
            nextBadge === "ban_chay_sap_het"
              ? ["ban_chay_sap_het", "ban_chay"]
              : [nextBadge];
          const rivals = await col
            .find({
              webPin: nextPin,
              webBadge: { $in: badgeIn },
              ma: { $nin: [ma, ma.toUpperCase(), ma.toLowerCase()] },
            } as any)
            .project({ ma: 1 })
            .toArray();
          for (const r of rivals) {
            const rm = String(r.ma || "").trim();
            if (!rm) continue;
            clearedMas.push(rm);
            await col.updateOne(
              { ma: rm } as any,
              {
                $set: {
                  webPin: 0,
                  merchandisingUpdatedAt: new Date().toISOString(),
                },
              }
            );
          }
        }

        await col.updateOne(maFilter, { $set });
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "web-merchandising", {
          ids: [ma, ...clearedMas],
        });
        res.json({
          ok: true,
          ma,
          webPin: nextPin,
          webBadge: nextBadge,
          clearedMas,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "merchandising_failed" });
      }
    }
  );

  app.patch(
    "/api/shop/admin/products/:ma/seo",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const $set: Record<string, unknown> = {
          seoUpdatedAt: new Date().toISOString(),
        };
        if (req.body?.seoTitle !== undefined) {
          $set.seoTitle = String(req.body.seoTitle || "").trim().slice(0, 120);
        }
        if (req.body?.seoDescription !== undefined) {
          $set.seoDescription = String(req.body.seoDescription || "")
            .trim()
            .slice(0, 320);
        }
        const r = await db.collection(COL).updateOne(
          {
            $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
          } as any,
          { $set }
        );
        if (!r.matchedCount) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "web-seo", { ids: [ma] });
        res.json({ ok: true, ma, ...$set });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "seo_patch_failed" });
      }
    }
  );

  app.patch(
    "/api/shop/admin/products/:ma/visibility",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const hienThiWeb = req.body?.hienThiWeb !== false;
        const r = await db.collection(COL).updateOne(
          {
            $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
          } as any,
          { $set: { hienThiWeb, hienThiWebUpdatedAt: new Date().toISOString() } }
        );
        if (!r.matchedCount) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "hienThiWeb", { ids: [ma] });
        res.json({ ok: true, ma, hienThiWeb });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "visibility_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/products/apply-default-badges",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const col = db.collection(COL);
        const rank = await loadRevenueRankMap(db);
        const docs = await col
          .find({})
          .project({
            ma: 1,
            ton: 1,
            onHand: 1,
            kvTon: 1,
            webBadge: 1,
            createdAt: 1,
          })
          .toArray();

        const now = new Date().toISOString();
        let banChaySapHet = 0;
        let datTruoc = 0;
        let skippedManual = 0;
        const ops: import("mongodb").AnyBulkWriteOperation[] = [];

        for (const d of docs) {
          const ma = String(d.ma || "").trim();
          if (!ma) continue;
          const legacyRaw = String(d.webBadge || "").trim();
          const current = normalizeWebBadge(legacyRaw);
          // Đã gắn nhãn chuẩn → khóa (không đè). Legacy «ban_chay» / rỗng → được áp.
          const isOpen =
            !legacyRaw || legacyRaw === "ban_chay" || !current;
          if (!isOpen) {
            skippedManual++;
            continue;
          }

          const ton = publicTon(d as Record<string, unknown>);
          const maKey = ma.toUpperCase();
          let next = "";
          if (isPreOrderTon(ton)) {
            next = "dat_truoc";
          } else if (isLowStockTon(ton, LOW_STOCK_MAX) && rank.has(maKey)) {
            next = "ban_chay_sap_het";
          }
          // Không gắn cứng «moi» — mục mới theo createdAt

          if (next === current && legacyRaw !== "ban_chay") {
            continue;
          }
          if (!next && !legacyRaw) continue;

          const setDoc: Record<string, unknown> = {
            webBadge: next,
            merchandisingUpdatedAt: now,
          };
          ops.push({
            updateOne: {
              filter: { ma } as any,
              update: { $set: setDoc },
            },
          });
          if (next === "ban_chay_sap_het") banChaySapHet++;
          else if (next === "dat_truoc") datTruoc++;
        }

        let modified = 0;
        const chunk = 500;
        for (let i = 0; i < ops.length; i += chunk) {
          const slice = ops.slice(i, i + chunk);
          if (!slice.length) continue;
          const r = await col.bulkWrite(slice, { ordered: false });
          modified += r.modifiedCount + r.upsertedCount;
        }

        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "web-badge-defaults", {
          banChaySapHet,
          datTruoc,
        });

        res.json({
          ok: true,
          scanned: docs.length,
          updated: ops.length,
          modified,
          banChaySapHet,
          datTruoc,
          moi: 0,
          skippedManual,
          rankedBestsellers: rank.size,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "apply_default_badges_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/products/visibility/bulk",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const mas = Array.isArray(req.body?.mas)
          ? req.body.mas.map((m: unknown) => String(m || "").trim()).filter(Boolean)
          : [];
        const hienThiWeb = req.body?.hienThiWeb !== false;
        if (!mas.length) {
          res.status(400).json({ error: "missing_mas" });
          return;
        }
        const r = await db.collection(COL).updateMany(
          { ma: { $in: mas } } as any,
          { $set: { hienThiWeb, hienThiWebUpdatedAt: new Date().toISOString() } }
        );
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "hienThiWeb-bulk", { ids: mas.slice(0, 50) });
        res.json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount, hienThiWeb });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "bulk_visibility_failed" });
      }
    }
  );
}

/** Điều kiện catalog khách — thiếu field = vẫn hiện. */
export function hienThiWebFilterClause(): object {
  return {
    $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
  };
}
