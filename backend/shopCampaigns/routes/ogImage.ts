import type { Request, Response } from "express";
import type { Db } from "mongodb";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { getCampaign } from "../campaignRepo.js";
import { getCurrentCampaign } from "../currentCampaign.js";
import type { CampaignContent, CampaignDoc } from "../types.js";

type GetDb = () => Promise<Db>;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const MEM_CACHE = new Map<string, { buffer: Buffer; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút trong RAM
const MAX_CACHE_ENTRIES = 50;

function resolveUploadsDir(): string {
  const cwd = process.cwd();
  const prod = path.resolve(cwd, "..", "uploads");
  const dev = path.resolve(cwd, "uploads");
  return fs.existsSync(prod) ? prod : dev;
}

async function readImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    const uploadsDir = resolveUploadsDir();
    let rel = "";
    if (imageUrl.startsWith("/uploads/")) {
      rel = imageUrl.slice("/uploads/".length);
    } else if (imageUrl.includes("/uploads/")) {
      rel = imageUrl.split("/uploads/")[1] || "";
    }
    rel = rel.split(/[?#]/)[0] || "";

    if (rel) {
      const localPath = path.resolve(uploadsDir, rel);
      if (localPath.startsWith(uploadsDir + path.sep) && fs.existsSync(localPath)) {
        return await fs.promises.readFile(localPath);
      }
    }

    // Nếu ảnh là URL ngoài hoặc không tìm thấy ở local
    const fullUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `https://alohathegioichaucay.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    const resp = await fetch(fullUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Aloha-OG-Fetcher/1.0" },
    });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Chuẩn hoá ảnh OG cho Facebook/Zalo (1200×630 Baseline JPEG):
 * - Giữ kích thước chuẩn 1200×630 & dung lượng gọn (~150-250 KB) để Facebook không ép nén gắt
 * - Không sharpen nhân tạo, không 4:4:4 phình file (tránh lem chữ đỏ khi FB chuyển về 4:2:0)
 */
export async function renderCampaignOgImage(
  rawBuffer: Buffer,
  options?: { isCustomShare?: boolean }
): Promise<Buffer> {
  const meta = await sharp(rawBuffer, { failOn: "none" }).metadata();
  const rawW = meta.width || OG_WIDTH;
  const rawH = meta.height || OG_HEIGHT;
  const rawAspect = rawW / Math.max(1, rawH);

  const jpegOpts = { quality: 90, progressive: false, mozjpeg: false } as const;

  if (options?.isCustomShare || rawAspect <= 2.05) {
    return sharp(rawBuffer, { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "center" })
      .jpeg(jpegOpts)
      .toBuffer();
  }

  // Banner ngang rộng (panoramic > 2.05:1 như 8:3):
  // Hiển thị trọn vẹn nội dung chữ & sản phẩm ở giữa trên nền mờ cùng tông màu
  const [bg, fg] = await Promise.all([
    sharp(rawBuffer, { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "center" })
      .blur(36)
      .modulate({ brightness: 0.85, saturation: 1.05 })
      .toBuffer(),
    sharp(rawBuffer, { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "inside" })
      .toBuffer(),
  ]);

  const fgMeta = await sharp(fg).metadata();
  const fgW = fgMeta.width || OG_WIDTH;
  const fgH = fgMeta.height || OG_HEIGHT;
  const left = Math.max(0, Math.round((OG_WIDTH - fgW) / 2));
  const top = Math.max(0, Math.round((OG_HEIGHT - fgH) / 2));

  return sharp(bg)
    .composite([{ input: fg, left, top }])
    .jpeg(jpegOpts)
    .toBuffer();
}

function sendOgJpeg(res: Response, buffer: Buffer): void {
  res.removeHeader("ETag");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Accept-Ranges", "bytes");
  res.end(buffer);
}

function putMemCache(key: string, buffer: Buffer): void {
  const now = Date.now();
  if (MEM_CACHE.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of MEM_CACHE.entries()) {
      if (v.expiresAt <= now) MEM_CACHE.delete(k);
    }
    if (MEM_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldest = MEM_CACHE.keys().next().value;
      if (oldest) MEM_CACHE.delete(oldest);
    }
  }
  MEM_CACHE.set(key, { buffer, expiresAt: now + CACHE_TTL_MS });
}

export async function campaignOgImageHandler(getDb: GetDb, req: Request, res: Response): Promise<void> {
  const cid =
    typeof req.params?.cid === "string"
      ? req.params.cid.trim()
      : typeof req.query.cid === "string"
      ? req.query.cid.trim()
      : "";
  const fitMode = typeof req.query.fit === "string" ? req.query.fit.trim() : "cover";

  try {
    const db = await getDb();
    let content: CampaignContent | null = null;

    if (cid) {
      const doc = await getCampaign(db, cid);
      content = (doc?.published as CampaignContent) || (doc?.draft as CampaignContent) || null;
    } else {
      const state = await getCurrentCampaign(db, Date.now(), { isTestBuyer: false });
      const active = state.active || state.upcoming;
      content = active?.content || null;
    }

    const banners = content?.display?.banners || [];
    const shareBanner = banners.find((b) => (b.kind as string) === "share" || (b.kind as string) === "og");
    const isCustomShare = Boolean(shareBanner?.imageUrl);
    const mainBanner = shareBanner || banners.find((b) => b.kind === "main") || banners[0];
    const rawUrl = mainBanner?.imageUrl || "";

    if (!rawUrl) {
      res.redirect(302, "/brand/logo-full.png");
      return;
    }

    const cacheKey = `${cid || "current"}_${rawUrl.slice(-40)}_${fitMode}_og1200_v2`;
    const cached = MEM_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      sendOgJpeg(res, cached.buffer);
      return;
    }

    const rawBuffer = await readImageBuffer(rawUrl);
    if (!rawBuffer) {
      res.redirect(302, "/brand/logo-full.png");
      return;
    }

    const finalBuffer = await renderCampaignOgImage(rawBuffer, { isCustomShare });
    putMemCache(cacheKey, finalBuffer);
    sendOgJpeg(res, finalBuffer);
  } catch {
    res.redirect(302, "/brand/logo-full.png");
  }
}
