import fs from "fs";
import path from "path";
import type { Express, Response } from "express";
import type { Db, ObjectId } from "mongodb";
import { ObjectId as MongoObjectId } from "mongodb";
import sharp from "sharp";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import { redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { sanitizeArticleHtml, slugifyVi, normalizeArticleVideoUrl } from "./sanitize.js";
import {
  ARTICLES_COL,
  PREVIOUS_SLUGS_MAX,
  PRODUCT_MAS_MAX,
  type ShopArticleDoc,
} from "./types.js";
import mammoth from "mammoth";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_DOCX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/ogg"]);
const PRODUCTS_COL = "aloha_products";

function bumpArticles(source: string) {
  syncBus.publish([ARTICLES_COL, "aloha_shop_articles"], source);
  void redisInvalidateShopCache();
}

function resolveUploadsDir() {
  const cwd = process.cwd();
  const prod = path.join(cwd, "..", "uploads");
  const dev = path.join(cwd, "uploads");
  const root = fs.existsSync(prod) ? prod : dev;
  const dir = path.join(root, "shop-articles");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function idStr(doc: { _id?: unknown }): string {
  return String(doc._id || "");
}

function publicFilter(nowIso = new Date().toISOString()) {
  return {
    visible: { $ne: false },
    publishedAt: { $lte: nowIso },
  };
}

function toAdmin(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    id: idStr(doc),
    title: doc.title || "",
    slug: doc.slug || "",
    previousSlugs: Array.isArray(doc.previousSlugs) ? doc.previousSlugs : [],
    category: doc.category || "",
    coverUrl: doc.coverUrl || "",
    videoUrl: doc.videoUrl || "",
    excerpt: doc.excerpt || "",
    bodyHtml: doc.bodyHtml || "",
    productMas: Array.isArray(doc.productMas) ? doc.productMas : [],
    publishedAt: doc.publishedAt || doc.createdAt || "",
    visible: doc.visible !== false,
    createdAt: doc.createdAt || "",
    updatedAt: doc.updatedAt || "",
    updatedBy: doc.updatedBy ?? null,
  };
}

function toPublicList(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    id: idStr(doc),
    title: doc.title || "",
    slug: doc.slug || "",
    category: doc.category || "",
    coverUrl: doc.coverUrl || "",
    excerpt: doc.excerpt || "",
    publishedAt: doc.publishedAt || "",
    updatedAt: doc.updatedAt || "",
  };
}

function toPublicDetail(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    ...toPublicList(doc),
    videoUrl: doc.videoUrl || "",
    bodyHtml: doc.bodyHtml || "",
    productMas: Array.isArray(doc.productMas) ? doc.productMas : [],
  };
}

function normalizeProductMas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const ma = String(x || "").trim();
    if (!ma || seen.has(ma)) continue;
    seen.add(ma);
    out.push(ma);
    if (out.length >= PRODUCT_MAS_MAX) break;
  }
  return out;
}

function parseId(raw: string): ObjectId | null {
  try {
    if (!MongoObjectId.isValid(raw)) return null;
    return new MongoObjectId(raw);
  } catch {
    return null;
  }
}

async function ensureIndexes(db: Db) {
  const col = db.collection(ARTICLES_COL);
  await col.createIndex({ slug: 1 }, { unique: true });
  await col.createIndex({ previousSlugs: 1 });
  await col.createIndex({ publishedAt: -1, visible: 1 });
  await col.createIndex({ category: 1, publishedAt: -1 });
}

let indexesReady = false;

async function ensureReady(db: Db) {
  if (indexesReady) return;
  await ensureIndexes(db);
  indexesReady = true;
}

/** Minimal public product shape — khớp shop ProductCard. */
function toMiniProduct(doc: Record<string, unknown>) {
  const ma = String(doc.ma || doc._id || "").trim();
  const ten = String(doc.ten || "").trim();
  const anh =
    (typeof doc.anh === "string" && doc.anh) ||
    (Array.isArray(doc.images) && doc.images[0] ? String(doc.images[0]) : "") ||
    "";
  const gia = Number(doc.giaWeb ?? doc.giaBan ?? doc.giaChung ?? doc.basePrice ?? 0);
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0);
  const nhom = String(doc.nhom || "").trim();
  const nhomPath = String(doc.nhomPath || nhom).trim();
  const catSlug = slugifyVi(nhom.split(">>").pop()?.trim() || "sp") || "sp";
  const pSlug = `${slugifyVi(ten) || "sp"}--${slugifyVi(ma) || "x"}`;
  const webBadge = String(doc.webBadge || "").trim();
  return {
    ma,
    ten,
    dvt: String(doc.dvt || "Cái").trim() || "Cái",
    nhom,
    nhomPath,
    gia: Number.isFinite(gia) ? gia : 0,
    ton: Number.isFinite(ton) ? ton : 0,
    anh,
    images: anh ? [anh] : [],
    isActive: doc.isActive !== false,
    path: `/c/${catSlug}/p/${pSlug}`,
    categorySlug: catSlug,
    productSlug: pSlug,
    webBadge:
      webBadge === "ban_chay" || webBadge === "moi" || webBadge === "noi_bat"
        ? webBadge
        : undefined,
  };
}

async function resolveProductsByMas(mainDb: Db, mas: string[]) {
  if (!mas.length) return [];
  const rows = await mainDb
    .collection(PRODUCTS_COL)
    .find({
      ma: { $in: mas },
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
      anh: 1,
      images: 1,
      dvt: 1,
      nhom: 1,
      nhomPath: 1,
      giaWeb: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      ton: 1,
      onHand: 1,
      kvTon: 1,
      isActive: 1,
      webBadge: 1,
    })
    .toArray();
  const map = new Map(rows.map((d) => [String(d.ma), toMiniProduct(d as any)]));
  return mas.map((m) => map.get(m)).filter(Boolean);
}

export function registerShopArticlesRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

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
      } as any)) as (ShopArticleDoc & { _id?: unknown }) | null;

      if (!doc) {
        const byOld = (await col.findOne({
          previousSlugs: slug,
          ...filter,
        } as any)) as (ShopArticleDoc & { _id?: unknown }) | null;
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

  // —— Admin list ——
  app.get(
    "/api/shop/admin/articles",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureReady(shopDb);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
        const q = String(req.query.q || "").trim().toLowerCase();
        const visible = String(req.query.visible || "all");
        const and: object[] = [];
        if (visible === "1") and.push({ visible: { $ne: false } });
        if (visible === "0") and.push({ visible: false });
        const filter = and.length ? { $and: and } : {};
        const col = shopDb.collection(ARTICLES_COL);
        let rows = await col
          .find(filter as any)
          .sort({ updatedAt: -1 })
          .toArray();
        if (q) {
          rows = rows.filter((d) => {
            const hay = `${d.title || ""} ${d.slug || ""} ${d.category || ""}`.toLowerCase();
            return hay.includes(q);
          });
        }
        const total = rows.length;
        const slice = rows.slice((page - 1) * limit, page * limit);
        res.json({
          items: slice.map((d) => toAdmin(d as any)),
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "admin_list_failed" });
      }
    }
  );

  // —— Cover upload (trước :id) ——
  app.post(
    "/api/shop/admin/articles/upload",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const data = String(req.body?.data || "");
        const matches = data.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
        if (!matches) {
          res.status(400).json({
            error: "invalid_data",
            message: "Cần ảnh dạng data URL (base64).",
          });
          return;
        }
        const mime = matches[1].toLowerCase();
        if (!ALLOWED_MIME.has(mime)) {
          res.status(400).json({
            error: "invalid_type",
            message: "Chỉ nhận JPG, PNG hoặc WebP.",
          });
          return;
        }
        const buffer = Buffer.from(matches[2], "base64");
        if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
          res.status(400).json({
            error: "too_large",
            message: "Ảnh tối đa 4MB.",
          });
          return;
        }
        const out = await sharp(buffer, { failOn: "none" })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85, alphaQuality: 90 })
          .toBuffer();

        const stamp = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const fileName = `cover_${stamp}_${rand}.webp`;
        const dir = resolveUploadsDir();
        fs.writeFileSync(path.join(dir, fileName), out);
        const url = `/uploads/shop-articles/${fileName}`;
        res.json({ ok: true, url, bytes: out.length });
      } catch (e: any) {
        res.status(500).json({
          error: e?.message || "upload_failed",
          message: "Không lưu được ảnh.",
        });
      }
    }
  );

  // —— Upload video file (mp4/webm) ——
  app.post(
    "/api/shop/admin/articles/upload-video",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const data = String(req.body?.data || "");
        const matches = data.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
        if (!matches) {
          res.status(400).json({
            error: "invalid_data",
            message: "Cần video dạng data URL (base64).",
          });
          return;
        }
        const mime = matches[1].toLowerCase();
        if (!ALLOWED_VIDEO_MIME.has(mime)) {
          res.status(400).json({
            error: "invalid_type",
            message: "Chỉ nhận MP4, WebM hoặc OGG.",
          });
          return;
        }
        const buffer = Buffer.from(matches[2], "base64");
        if (!buffer.length || buffer.length > MAX_VIDEO_BYTES) {
          res.status(400).json({
            error: "too_large",
            message: "Video tối đa 40MB.",
          });
          return;
        }
        const ext =
          mime === "video/webm" ? "webm" : mime === "video/ogg" ? "ogg" : "mp4";
        const stamp = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const fileName = `video_${stamp}_${rand}.${ext}`;
        const dir = resolveUploadsDir();
        fs.writeFileSync(path.join(dir, fileName), buffer);
        const url = `/uploads/shop-articles/${fileName}`;
        res.json({ ok: true, url, bytes: buffer.length });
      } catch (e: any) {
        res.status(500).json({
          error: e?.message || "upload_video_failed",
          message: "Không lưu được video.",
        });
      }
    }
  );

  // —— Import Word (.docx) → HTML ——
  app.post(
    "/api/shop/admin/articles/import-docx",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const data = String(req.body?.data || "");
        const matches = data.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
        if (!matches) {
          res.status(400).json({
            error: "invalid_data",
            message: "Cần file Word (.docx) dạng data URL.",
          });
          return;
        }
        const buffer = Buffer.from(matches[2], "base64");
        if (!buffer.length || buffer.length > MAX_DOCX_BYTES) {
          res.status(400).json({
            error: "too_large",
            message: "File Word tối đa 12MB.",
          });
          return;
        }
        const dir = resolveUploadsDir();
        const result = await mammoth.convertToHtml(
          { buffer },
          {
            convertImage: (mammoth as any).images.imgElement(async (image: any) => {
              try {
                const imgBuf: Buffer = await image.read();
                const out = await sharp(imgBuf, { failOn: "none" })
                  .rotate()
                  .resize({
                    width: 1400,
                    height: 1400,
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .webp({ quality: 85 })
                  .toBuffer();
                const stamp = Date.now();
                const rand = Math.random().toString(36).slice(2, 8);
                const fileName = `docx_${stamp}_${rand}.webp`;
                fs.writeFileSync(path.join(dir, fileName), out);
                return { src: `/uploads/shop-articles/${fileName}` };
              } catch {
                return { src: "" };
              }
            }),
          }
        );
        const html = sanitizeArticleHtml(String(result.value || ""));
        res.json({
          ok: true,
          html,
          messages: (result.messages || []).slice(0, 8).map((m: any) => m.message),
        });
      } catch (e: any) {
        res.status(500).json({
          error: e?.message || "import_docx_failed",
          message: "Không đọc được file Word. Hãy dùng .docx (không phải .doc cũ).",
        });
      }
    }
  );

  // —— Admin get one ——
  app.get(
    "/api/shop/admin/articles/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureReady(shopDb);
        const oid = parseId(String(req.params.id || ""));
        if (!oid) {
          res.status(400).json({ error: "invalid_id" });
          return;
        }
        const doc = await shopDb.collection(ARTICLES_COL).findOne({ _id: oid } as any);
        if (!doc) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.json({ item: toAdmin(doc as any) });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "admin_get_failed" });
      }
    }
  );

  // —— Admin create ——
  app.post(
    "/api/shop/admin/articles",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureReady(shopDb);
        const title = String(req.body?.title || "").trim();
        if (!title) {
          res.status(400).json({ error: "missing_title", message: "Thiếu tiêu đề." });
          return;
        }
        let slug = slugifyVi(String(req.body?.slug || title));
        const col = shopDb.collection(ARTICLES_COL);
        const clash = await col.findOne({
          $or: [{ slug }, { previousSlugs: slug }],
        } as any);
        if (clash) {
          slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }
        const now = new Date().toISOString();
        const by = String(req.auth?.username || req.auth?.userId || "admin");
        const doc: ShopArticleDoc = {
          title,
          slug,
          previousSlugs: [],
          category: String(req.body?.category || "").trim(),
          coverUrl: String(req.body?.coverUrl || "").trim(),
          videoUrl: normalizeArticleVideoUrl(String(req.body?.videoUrl || "")),
          excerpt: String(req.body?.excerpt || "").trim().slice(0, 500),
          bodyHtml: sanitizeArticleHtml(String(req.body?.bodyHtml || "")),
          productMas: normalizeProductMas(req.body?.productMas),
          publishedAt: String(req.body?.publishedAt || now),
          visible: req.body?.visible !== false,
          createdAt: now,
          updatedAt: now,
          updatedBy: by,
        };
        const r = await col.insertOne(doc as any);
        bumpArticles("article-create");
        res.json({ ok: true, item: toAdmin({ ...doc, _id: r.insertedId }) });
      } catch (e: any) {
        if (String(e?.code) === "11000" || e?.code === 11000) {
          res.status(409).json({
            error: "slug_taken",
            message: "Đường dẫn (slug) đã dùng. Đổi slug khác.",
          });
          return;
        }
        res.status(500).json({ error: e?.message || "create_failed" });
      }
    }
  );

  // —— Admin patch ——
  app.patch(
    "/api/shop/admin/articles/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureReady(shopDb);
        const oid = parseId(String(req.params.id || ""));
        if (!oid) {
          res.status(400).json({ error: "invalid_id" });
          return;
        }
        const col = shopDb.collection(ARTICLES_COL);
        const existing = (await col.findOne({ _id: oid } as any)) as
          | (ShopArticleDoc & { _id?: unknown })
          | null;
        if (!existing) {
          res.status(404).json({ error: "not_found" });
          return;
        }

        const set: Partial<ShopArticleDoc> = {
          updatedAt: new Date().toISOString(),
          updatedBy: String(req.auth?.username || req.auth?.userId || "admin"),
        };

        if (req.body?.title !== undefined) {
          set.title = String(req.body.title || "").trim();
          if (!set.title) {
            res.status(400).json({ error: "missing_title", message: "Thiếu tiêu đề." });
            return;
          }
        }
        if (req.body?.category !== undefined) {
          set.category = String(req.body.category || "").trim();
        }
        if (req.body?.coverUrl !== undefined) {
          set.coverUrl = String(req.body.coverUrl || "").trim();
        }
        if (req.body?.videoUrl !== undefined) {
          set.videoUrl = normalizeArticleVideoUrl(String(req.body.videoUrl || ""));
        }
        if (req.body?.excerpt !== undefined) {
          set.excerpt = String(req.body.excerpt || "").trim().slice(0, 500);
        }
        if (req.body?.bodyHtml !== undefined) {
          set.bodyHtml = sanitizeArticleHtml(String(req.body.bodyHtml || ""));
        }
        if (req.body?.productMas !== undefined) {
          set.productMas = normalizeProductMas(req.body.productMas);
        }
        if (req.body?.publishedAt !== undefined) {
          set.publishedAt = String(req.body.publishedAt || existing.publishedAt);
        }
        if (req.body?.visible !== undefined) {
          set.visible = req.body.visible !== false && req.body.visible !== "0";
        }

        if (req.body?.slug !== undefined) {
          const newSlug = slugifyVi(String(req.body.slug || existing.slug));
          if (newSlug !== existing.slug) {
            const clash = await col.findOne({
              _id: { $ne: oid },
              $or: [{ slug: newSlug }, { previousSlugs: newSlug }],
            } as any);
            if (clash) {
              res.status(409).json({
                error: "slug_taken",
                message: "Đường dẫn (slug) đã dùng. Đổi slug khác.",
              });
              return;
            }
            const prev = Array.isArray(existing.previousSlugs)
              ? [...existing.previousSlugs]
              : [];
            if (existing.slug && !prev.includes(existing.slug)) {
              prev.unshift(existing.slug);
            }
            set.previousSlugs = prev
              .filter((s) => s && s !== newSlug)
              .slice(0, PREVIOUS_SLUGS_MAX);
            set.slug = newSlug;
          }
        }

        await col.updateOne({ _id: oid } as any, { $set: set });
        const next = await col.findOne({ _id: oid } as any);
        bumpArticles("article-patch");
        res.json({ ok: true, item: toAdmin(next as any) });
      } catch (e: any) {
        if (String(e?.code) === "11000" || e?.code === 11000) {
          res.status(409).json({
            error: "slug_taken",
            message: "Đường dẫn (slug) đã dùng. Đổi slug khác.",
          });
          return;
        }
        res.status(500).json({ error: e?.message || "patch_failed" });
      }
    }
  );

  // —— Admin delete ——
  app.delete(
    "/api/shop/admin/articles/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureReady(shopDb);
        const oid = parseId(String(req.params.id || ""));
        if (!oid) {
          res.status(400).json({ error: "invalid_id" });
          return;
        }
        const r = await shopDb.collection(ARTICLES_COL).deleteOne({ _id: oid } as any);
        if (!r.deletedCount) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        bumpArticles("article-delete");
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "delete_failed" });
      }
    }
  );

}
