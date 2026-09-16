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

const COL = "aloha_products";

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
  getShopDb?: GetDb
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
              { webBadge: { $nin: ["ban_chay", "moi", "noi_bat"] } },
            ],
          });
        } else if (
          badge === "ban_chay" ||
          badge === "moi" ||
          badge === "noi_bat"
        ) {
          and.push({ webBadge: badge });
        }

        const filter = { $and: and };
        const col = db.collection(COL);
        const projection = {
          ma: 1,
          ten: 1,
          anh: 1,
          images: 1,
          nhom: 1,
          nhomPath: 1,
          categoryId: 1,
          categoryName: 1,
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

        if (q) {
          // Quét theo lọc nhóm/trạng thái rồi khớp bỏ dấu (kho ~ vài nghìn SP — ổn cho admin).
          const all = await col
            .find(filter as any)
            .project(projection)
            .sort({ ten: 1 })
            .toArray();
          const matched = all.filter((d) => productMatchesQuery(d, q));
          total = matched.length;
          rows = matched.slice((page - 1) * limit, page * limit);
        } else {
          [total, rows] = await Promise.all([
            col.countDocuments(filter as any),
            col
              .find(filter as any)
              .project(projection)
              .sort({ ten: 1 })
              .skip((page - 1) * limit)
              .limit(limit)
              .toArray(),
          ]);
        }

        const items = rows.map((d) => ({
          ma: String(d.ma || ""),
          ten: String(d.ten || ""),
          anh: publicAnh(d as any),
          nhom: String(d.nhom || d.categoryName || ""),
          nhomPath: String(d.nhomPath || d.nhom || d.categoryName || ""),
          categoryId: Number(d.categoryId) || 0,
          categoryName: String(d.categoryName || ""),
          gia: publicPrice(d as any),
          ton: publicTon(d as any),
          hienThiWeb: d.hienThiWeb !== false,
          webPin: Number(d.webPin) > 0 ? Math.round(Number(d.webPin)) : 0,
          webBadge:
            d.webBadge === "ban_chay" ||
            d.webBadge === "moi" ||
            d.webBadge === "noi_bat"
              ? String(d.webBadge)
              : "",
          seoTitle: String(d.seoTitle || ""),
          seoDescription: String(d.seoDescription || ""),
        }));

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
        const $set: Record<string, unknown> = {
          merchandisingUpdatedAt: new Date().toISOString(),
        };
        if (req.body?.webPin !== undefined) {
          const n = Number(req.body.webPin);
          $set.webPin = Number.isFinite(n) && n > 0 ? Math.min(9999, Math.round(n)) : 0;
        }
        if (req.body?.webBadge !== undefined) {
          const b = String(req.body.webBadge || "").trim();
          $set.webBadge =
            b === "ban_chay" || b === "moi" || b === "noi_bat" ? b : "";
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
        syncBus.publish(["aloha_products"], "web-merchandising", { ids: [ma] });
        res.json({ ok: true, ma, ...$set });
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
