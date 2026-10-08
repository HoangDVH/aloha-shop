import fs from "fs";
import path from "path";
import type { Express, Response } from "express";
import mammoth from "mammoth";
import sharp from "sharp";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../../auth/middleware.js";
import type { GetShopDb } from "../../shopOrders/routes.js";
import { sanitizeArticleHtml, slugifyVi, articleVideoUrlSchema } from "../sanitize.js";
import {
  ARTICLES_COL,
  PREVIOUS_SLUGS_MAX,
  type ShopArticleDoc,
} from "../types.js";
import {
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCX_BYTES,
  ALLOWED_MIME,
  ALLOWED_VIDEO_MIME,
  bumpArticles,
  resolveUploadsDir,
  toAdmin,
  normalizeProductMas,
  parseId,
  ensureReady,
} from "./helpers.js";

export function registerArticlesAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

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
        const video = articleVideoUrlSchema.safeParse(req.body?.videoUrl ?? "");
        if (!video.success) {
          res.status(400).json({ error: "invalid_video_url", message: video.error.issues[0]?.message });
          return;
        }
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
          videoUrl: video.data,
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
          const video = articleVideoUrlSchema.safeParse(req.body.videoUrl);
          if (!video.success) {
            res.status(400).json({ error: "invalid_video_url", message: video.error.issues[0]?.message });
            return;
          }
          set.videoUrl = video.data;
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
