import fs from "fs";
import path from "path";
import type { Express, Response } from "express";
import type { Db } from "mongodb";
import sharp from "sharp";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { buildDefaultAppearanceLayout } from "./seed.js";
import {
  APPEARANCE_COL,
  APPEARANCE_ID,
  APPEARANCE_HISTORY_MAX,
  defaultPopup,
  defaultSeo,
  type AppearanceDoc,
  type AppearanceFontFamily,
  type AppearanceHistoryEntry,
  type AppearanceLayout,
  type AppearancePopup,
  type NavConfig,
} from "./types.js";
import type { GetShopDb } from "../shopOrders/routes.js";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const FONT_IDS = new Set<AppearanceFontFamily>([
  "system",
  "be_vietnam",
  "nunito",
  "roboto",
]);

/** Khớp createApp static /uploads (cwd = project root khi chạy server.ts). */
function resolveAppearanceUploadsDir() {
  const cwd = process.cwd();
  const prod = path.join(cwd, "..", "uploads");
  const dev = path.join(cwd, "uploads");
  const root = fs.existsSync(prod) ? prod : dev;
  const dir = path.join(root, "shop-appearance");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function bumpShopAppearance(source: string) {
  syncBus.publish([APPEARANCE_COL, "aloha_shop_appearance"], source);
  void redisInvalidateShopCache();
}

function emptyNav(): NavConfig {
  return { hiddenCategoryPaths: [], customItems: [] };
}

function normalizePopup(raw: Partial<AppearancePopup> | null | undefined): AppearancePopup {
  const base = defaultPopup();
  const p = raw && typeof raw === "object" ? raw : {};
  const delay = Number(p.delaySeconds);
  const freq = Number(p.frequencyDays);
  return {
    enabled: p.enabled === true,
    campaignId: String(p.campaignId || base.campaignId).trim() || base.campaignId,
    title: String(p.title ?? base.title),
    body: String(p.body ?? base.body),
    imageUrl: String(p.imageUrl || ""),
    ctaLabel: String(p.ctaLabel ?? base.ctaLabel),
    ctaHref: String(p.ctaHref || base.ctaHref),
    couponCode: String(p.couponCode || ""),
    delaySeconds: Number.isFinite(delay)
      ? Math.max(0, Math.min(30, Math.round(delay)))
      : base.delaySeconds,
    frequencyDays: Number.isFinite(freq)
      ? Math.max(1, Math.min(90, Math.round(freq)))
      : base.frequencyDays,
    showOncePerCampaign: p.showOncePerCampaign !== false,
  };
}

function normalizeLayout(raw: Partial<AppearanceLayout> | null | undefined): AppearanceLayout {
  const base = buildDefaultAppearanceLayout();
  if (!raw || typeof raw !== "object") return base;
  const version = Math.max(1, Number(raw.version) || base.version);
  const fontRaw = String(raw.theme?.fontFamily || base.theme.fontFamily) as AppearanceFontFamily;
  const fontFamily = FONT_IDS.has(fontRaw) ? fontRaw : base.theme.fontFamily;
  const seoIn = raw.theme?.seo;
  return {
    version,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    theme: {
      ...base.theme,
      ...(raw.theme || {}),
      fontFamily,
      faviconUrl:
        String(raw.theme?.faviconUrl || "").trim() || base.theme.faviconUrl,
      seo: {
        title:
          String(seoIn?.title || "").trim() || defaultSeo().title,
        description:
          String(seoIn?.description || "").trim() || defaultSeo().description,
      },
      popup: normalizePopup(raw.theme?.popup),
      footer: {
        address:
          String(raw.theme?.footer?.address || "").trim() || base.theme.footer.address,
        phone: String(raw.theme?.footer?.phone || "").trim() || base.theme.footer.phone,
        email: String(raw.theme?.footer?.email || "").trim() || base.theme.footer.email,
        zalo: String(raw.theme?.footer?.zalo || "").trim() || base.theme.footer.zalo,
      },
    },
    nav: {
      hiddenCategoryPaths: Array.isArray(raw.nav?.hiddenCategoryPaths)
        ? raw.nav!.hiddenCategoryPaths.map(String)
        : [],
      customItems: Array.isArray(raw.nav?.customItems) ? (raw.nav!.customItems as any) : [],
    },
    blocks: Array.isArray(raw.blocks) && raw.blocks.length ? (raw.blocks as any) : base.blocks,
  };
}

function pushHistory(
  existing: AppearanceHistoryEntry[] | undefined,
  entry: AppearanceHistoryEntry
): AppearanceHistoryEntry[] {
  return [entry, ...(existing || [])].slice(0, APPEARANCE_HISTORY_MAX);
}

async function ensureDoc(shopDb: Db): Promise<AppearanceDoc> {
  const col = shopDb.collection(APPEARANCE_COL);
  const existing = await col.findOne({ _id: APPEARANCE_ID as any });
  if (!existing) {
    const layout = buildDefaultAppearanceLayout();
    const doc: AppearanceDoc = {
      _id: APPEARANCE_ID,
      draft: layout,
      published: structuredClone(layout),
      publishedAt: layout.updatedAt,
      publishedPrevious: null,
      updatedBy: null,
      history: [],
      scheduledPublishAt: null,
    };
    await col.insertOne(doc as any);
    return doc;
  }

  // Migrate: thêm khối Bài viết mới nếu layout cũ chưa có (để shop hiện bài CMS).
  const doc = existing as unknown as AppearanceDoc;
  const hasArticle = (blocks: unknown) =>
    Array.isArray(blocks) &&
    blocks.some((b: any) => b && b.type === "article_section");
  if (hasArticle(doc.published?.blocks) && hasArticle(doc.draft?.blocks)) {
    return doc;
  }

  const articleBlock = {
    id: `articles_${Date.now().toString(36)}`,
    type: "article_section" as const,
    enabled: true,
    props: { title: "Bài viết mới", limit: 3 },
  };
  const published = normalizeLayout(doc.published);
  const draft = normalizeLayout(doc.draft);
  if (!hasArticle(published.blocks)) published.blocks = [...published.blocks, articleBlock];
  if (!hasArticle(draft.blocks)) {
    draft.blocks = [
      ...draft.blocks,
      { ...articleBlock, id: `articles_draft_${Date.now().toString(36)}` },
    ];
  }
  published.updatedAt = new Date().toISOString();
  draft.updatedAt = published.updatedAt;
  draft.version = Math.max(draft.version, published.version) + 1;
  published.version = draft.version;

  await col.updateOne(
    { _id: APPEARANCE_ID as any },
    { $set: { published, draft } }
  );
  await bumpShopAppearance("migrate-article-section");
  return { ...doc, published, draft };
}

async function publishDoc(
  shopDb: Db,
  doc: AppearanceDoc,
  by: string,
  note: string
) {
  const draft = normalizeLayout(doc.draft);
  const prev = normalizeLayout(doc.published);
  const published: AppearanceLayout = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  const publishedAt = published.updatedAt;
  const history = pushHistory(doc.history, {
    id: `h_${Date.now().toString(36)}`,
    at: publishedAt,
    by,
    note,
    snapshot: structuredClone(published),
  });
  await shopDb.collection(APPEARANCE_COL).updateOne(
    { _id: APPEARANCE_ID as any },
    {
      $set: {
        published,
        publishedPrevious: prev,
        publishedAt,
        draft: published,
        updatedBy: by || null,
        history,
        scheduledPublishAt: null,
      },
    }
  );
  await bumpShopAppearance(note || "appearance-publish");
  return { published, publishedAt, history };
}

let scheduleTimer: ReturnType<typeof setInterval> | null = null;

function startScheduleTicker(getShopDb: GetShopDb) {
  if (scheduleTimer) return;
  const tick = () => {
    void (async () => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const at = doc.scheduledPublishAt ? Date.parse(doc.scheduledPublishAt) : NaN;
        if (!Number.isFinite(at) || at > Date.now()) return;
        await publishDoc(shopDb, doc, doc.updatedBy || "schedule", "scheduled-publish");
      } catch {
        /* ignore tick errors */
      }
    })();
  };
  // 15s — đủ nhanh cho SME, không đợi cả phút
  scheduleTimer = setInterval(tick, 15_000);
  tick();
  if (typeof scheduleTimer.unref === "function") scheduleTimer.unref();
}

export function registerShopAppearanceRoutes(
  app: Express,
  _getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(_getDb), requireActive, requireManager];
  startScheduleTicker(getShopDb);

  app.get("/api/shop/appearance", async (_req, res: Response) => {
    try {
      const shopDb = await getShopDb();
      const doc = await ensureDoc(shopDb);
      const published = normalizeLayout(doc.published);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.json({
        theme: published.theme,
        blocks: published.blocks,
        nav: published.nav || emptyNav(),
        version: published.version,
        publishedAt: doc.publishedAt || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "appearance_failed" });
    }
  });

  app.get(
    "/api/shop/admin/appearance",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const draft = normalizeLayout(doc.draft);
        const published = normalizeLayout(doc.published);
        res.json({
          draft,
          published,
          publishedAt: doc.publishedAt || null,
          scheduledPublishAt: doc.scheduledPublishAt || null,
          history: Array.isArray(doc.history)
            ? doc.history.map((h) => ({
                id: h.id,
                at: h.at,
                by: h.by,
                note: h.note,
              }))
            : [],
          dirty:
            JSON.stringify(draft.blocks) !== JSON.stringify(published.blocks) ||
            JSON.stringify(draft.nav) !== JSON.stringify(published.nav) ||
            JSON.stringify(draft.theme) !== JSON.stringify(published.theme),
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "appearance_admin_failed" });
      }
    }
  );

  app.put(
    "/api/shop/admin/appearance/draft",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const clientVersion = Number(req.body?.version);
        const current = normalizeLayout(doc.draft);
        if (
          Number.isFinite(clientVersion) &&
          clientVersion > 0 &&
          clientVersion !== current.version
        ) {
          res.status(409).json({
            error: "version_conflict",
            message: "Có bản nháp mới hơn — tải lại rồi lưu.",
            draft: current,
          });
          return;
        }
        const mergedTheme = req.body?.theme
          ? { ...current.theme, ...req.body.theme }
          : current.theme;
        const next = normalizeLayout({
          ...current,
          version: current.version + 1,
          updatedAt: new Date().toISOString(),
          blocks: Array.isArray(req.body?.blocks) ? req.body.blocks : current.blocks,
          nav: req.body?.nav || current.nav,
          theme: mergedTheme,
        });

        const setDoc: Record<string, unknown> = {
          draft: next,
          updatedBy: req.auth?.username || req.auth?.userId || null,
        };
        if (req.body?.scheduledPublishAt !== undefined) {
          const raw = req.body.scheduledPublishAt;
          setDoc.scheduledPublishAt =
            raw === null || raw === ""
              ? null
              : String(raw);
        }

        await shopDb.collection(APPEARANCE_COL).updateOne(
          { _id: APPEARANCE_ID as any },
          { $set: setDoc }
        );
        res.json({
          ok: true,
          draft: next,
          scheduledPublishAt: setDoc.scheduledPublishAt ?? doc.scheduledPublishAt ?? null,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "draft_save_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/appearance/publish",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const by = String(req.auth?.username || req.auth?.userId || "admin");
        const r = await publishDoc(shopDb, doc, by, "publish");
        res.json({ ok: true, published: r.published, publishedAt: r.publishedAt });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "publish_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/appearance/schedule",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const raw = req.body?.scheduledPublishAt;
        const scheduledPublishAt =
          raw === null || raw === "" || raw === undefined ? null : String(raw);
        const by = String(req.auth?.username || req.auth?.userId || "admin");

        if (scheduledPublishAt) {
          const t = Date.parse(scheduledPublishAt);
          if (!Number.isFinite(t)) {
            res.status(400).json({
              error: "invalid_schedule",
              message: "Thời gian hẹn không hợp lệ.",
            });
            return;
          }
          // Quá khứ > 2 phút → báo lỗi; còn lại nếu đã đến giờ thì áp ngay
          if (t < Date.now() - 120_000) {
            res.status(400).json({
              error: "invalid_schedule",
              message: "Thời gian hẹn đã qua. Chọn giờ mới hơn.",
            });
            return;
          }
          if (t <= Date.now() + 5_000) {
            const r = await publishDoc(shopDb, doc, by, "scheduled-publish-now");
            res.json({
              ok: true,
              scheduledPublishAt: null,
              publishedNow: true,
              publishedAt: r.publishedAt,
            });
            return;
          }
        }

        await shopDb.collection(APPEARANCE_COL).updateOne(
          { _id: APPEARANCE_ID as any },
          {
            $set: {
              scheduledPublishAt,
              updatedBy: by,
            },
          }
        );
        res.json({ ok: true, scheduledPublishAt, publishedNow: false });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "schedule_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/appearance/restore",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const historyId = String(req.body?.historyId || "");
        const entry = (doc.history || []).find((h) => h.id === historyId);
        if (!entry?.snapshot) {
          res.status(404).json({ error: "history_not_found", message: "Không tìm thấy bản lịch sử." });
          return;
        }
        const current = normalizeLayout(doc.draft);
        const restored = normalizeLayout({
          ...entry.snapshot,
          version: current.version + 1,
          updatedAt: new Date().toISOString(),
        });
        await shopDb.collection(APPEARANCE_COL).updateOne(
          { _id: APPEARANCE_ID as any },
          {
            $set: {
              draft: restored,
              updatedBy: req.auth?.username || req.auth?.userId || null,
            },
          }
        );
        res.json({ ok: true, draft: restored });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "restore_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/appearance/revert",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const doc = await ensureDoc(shopDb);
        const prev = doc.publishedPrevious
          ? normalizeLayout(doc.publishedPrevious)
          : normalizeLayout(doc.published);
        const publishedAt = new Date().toISOString();
        const layout: AppearanceLayout = {
          ...prev,
          version: normalizeLayout(doc.draft).version + 1,
          updatedAt: publishedAt,
        };
        const by = String(req.auth?.username || req.auth?.userId || "admin");
        const history = pushHistory(doc.history, {
          id: `h_${Date.now().toString(36)}`,
          at: publishedAt,
          by,
          note: "revert",
          snapshot: structuredClone(layout),
        });
        await shopDb.collection(APPEARANCE_COL).updateOne(
          { _id: APPEARANCE_ID as any },
          {
            $set: {
              draft: layout,
              published: layout,
              publishedAt,
              publishedPrevious: normalizeLayout(doc.published),
              updatedBy: by,
              history,
              scheduledPublishAt: null,
            },
          }
        );
        await bumpShopAppearance("appearance-revert");
        res.json({ ok: true, published: layout, publishedAt });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "revert_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/appearance/upload",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const data = String(req.body?.data || "");
        const kindRaw = String(req.body?.kind || "banner");
        const kind = kindRaw === "logo" || kindRaw === "favicon" ? "logo" : "banner";
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

        const maxSide = kind === "logo" ? (kindRaw === "favicon" ? 256 : 1200) : 1600;
        let pipeline = sharp(buffer, { failOn: "none" }).rotate();
        pipeline = pipeline.resize({
          width: maxSide,
          height: maxSide,
          fit: kindRaw === "favicon" ? "cover" : "inside",
          withoutEnlargement: kindRaw !== "favicon",
        });
        const out = await pipeline
          .webp({ quality: kind === "logo" ? 90 : 85, alphaQuality: 90 })
          .toBuffer();

        const stamp = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const fileName = `${kindRaw === "favicon" ? "favicon" : kind}_${stamp}_${rand}.webp`;
        const dir = resolveAppearanceUploadsDir();
        fs.writeFileSync(path.join(dir, fileName), out);

        const url = `/uploads/shop-appearance/${fileName}`;
        res.json({ ok: true, url, kind: kindRaw, bytes: out.length });
      } catch (e: any) {
        res.status(500).json({
          error: e?.message || "upload_failed",
          message: "Không lưu được ảnh.",
        });
      }
    }
  );
}
