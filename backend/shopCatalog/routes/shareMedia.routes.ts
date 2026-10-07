/**
 * Route: GET /api/shop/share-media?u=<url>
 * Tải ảnh/video SP qua cùng origin để trình duyệt đính kèm file khi chia sẻ Zalo/Facebook
 * (bucket R2 không trả header CORS nên trình duyệt không fetch trực tiếp được).
 */
import type { Express } from "express";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { shopRateLimitOrReject } from "../../shopRateLimit.js";

export const SHARE_MEDIA_MAX_BYTES = 60 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 60_000;
const ALLOWED_TYPES =
  /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))(;|$)/i;

/** Chỉ nhận https tới bucket R2 công khai — chặn SSRF tới host nội bộ. */
export function shareMediaSource(raw: unknown): URL | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  return host.endsWith(".r2.dev") ? u : null;
}

export function registerShareMediaRoutes(app: Express) {
  app.get("/api/shop/share-media", async (req, res) => {
    const src = shareMediaSource(req.query.u);
    if (!src) {
      res.status(400).json({ error: "invalid_media_url" });
      return;
    }
    if (!(await shopRateLimitOrReject(req, res, "shop_share_media", 40, 60_000))) return;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
    res.on("close", () => {
      clearTimeout(timer);
      if (!res.writableEnded) ac.abort();
    });

    try {
      const upstream = await fetch(src, { redirect: "error", signal: ac.signal });
      const type = upstream.headers.get("content-type") || "";
      const len = Number(upstream.headers.get("content-length") || 0);
      if (!upstream.ok || !upstream.body || !ALLOWED_TYPES.test(type)) {
        res.status(502).json({ error: "media_unavailable" });
        return;
      }
      if (len > SHARE_MEDIA_MAX_BYTES) {
        res.status(413).json({ error: "media_too_large" });
        return;
      }

      res.setHeader("Content-Type", type);
      if (len > 0) res.setHeader("Content-Length", String(len));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

      let sent = 0;
      const cap = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          sent += chunk.length;
          cb(sent > SHARE_MEDIA_MAX_BYTES ? new Error("media_too_large") : null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(upstream.body as never), cap, res);
    } catch (e: any) {
      if (!res.headersSent) {
        res.status(502).json({ error: e?.name === "AbortError" ? "media_timeout" : "media_unavailable" });
      } else {
        res.destroy();
      }
    } finally {
      clearTimeout(timer);
    }
  });
}
