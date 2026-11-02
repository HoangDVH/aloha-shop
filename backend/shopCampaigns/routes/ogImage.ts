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

async function readImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    let rel = "";
    if (imageUrl.startsWith("/uploads/")) {
      rel = imageUrl.slice("/uploads/".length);
    } else if (imageUrl.includes("/uploads/")) {
      rel = imageUrl.split("/uploads/")[1];
    }

    if (rel) {
      const localPath = path.resolve(uploadsDir, rel);
      if (localPath.startsWith(uploadsDir) && fs.existsSync(localPath)) {
        return await fs.promises.readFile(localPath);
      }
    }

    // Nếu ảnh là URL ngoài hoặc không tìm thấy ở local
    const fullUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `https://alohathegioichaucay.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    const resp = await fetch(fullUrl, { headers: { "User-Agent": "Aloha-OG-Fetcher/1.0" } });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

export async function campaignOgImageHandler(getDb: GetDb, req: Request, res: Response): Promise<void> {
  const cid = typeof req.query.cid === "string" ? req.query.cid.trim() : "";
  const cacheKey = cid || "current";

  const cached = MEM_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.send(cached.buffer);
    return;
  }

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
    const mainBanner = banners.find((b) => b.kind === "main") || banners[0];
    const rawUrl = mainBanner?.imageUrl || "";

    if (!rawUrl) {
      res.redirect(302, "/brand/logo-full.png");
      return;
    }

    const rawBuffer = await readImageBuffer(rawUrl);
    if (!rawBuffer) {
      res.redirect(302, "/brand/logo-full.png");
      return;
    }

    // Xử lý tạo ảnh chuẩn 1.91:1 (1200 x 630 px) cho Facebook / Zalo không bị crop
    const bg = await sharp(rawBuffer, { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover" })
      .blur(25)
      .modulate({ brightness: 0.88 })
      .toBuffer();

    const fg = await sharp(rawBuffer, { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "inside" })
      .toBuffer();

    const fgMeta = await sharp(fg).metadata();
    const fgW = fgMeta.width || OG_WIDTH;
    const fgH = fgMeta.height || OG_HEIGHT;
    const left = Math.max(0, Math.round((OG_WIDTH - fgW) / 2));
    const top = Math.max(0, Math.round((OG_HEIGHT - fgH) / 2));

    const finalBuffer = await sharp(bg)
      .composite([{ input: fg, left, top }])
      .jpeg({ quality: 90 })
      .toBuffer();

    MEM_CACHE.set(cacheKey, { buffer: finalBuffer, expiresAt: Date.now() + CACHE_TTL_MS });

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.send(finalBuffer);
  } catch {
    res.redirect(302, "/brand/logo-full.png");
  }
}
