import type { Express } from "express";
import { z } from "zod";
import { isAllowedShopOrigin } from "./shopCors.js";
import { rateLimitAllow, shopRateLimitOrReject } from "./shopRateLimit.js";
import { requireAuth, requireActive, requireManager, type GetDb } from "./auth/middleware.js";
import { recordClientError, siteHealth } from "./clientErrorStore.js";

export const clientErrorInput = z.object({
  name: z.string().max(100), message: z.string().max(1000), stack: z.string().max(3000).optional(),
  path: z.string().max(300).startsWith("/"), release: z.string().max(100).regex(/^[A-Za-z0-9_-]+$/),
  source: z.enum(["window", "promise", "boundary"]),
}).strict();

export function redactErrorText(value: string): string {
  return value.replace(/https?:\/\/[^\s)]+/gi, (url) => url.split(/[?#]/)[0])
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]+)*\b/g, "[redacted]")
    .replace(/\b\d{8,}\b/g, "[redacted]")
    .replace(/[\r\n\t]/g, " ");
}

export function registerClientErrors(app: Express, getShopDb: GetDb, getAuthDb: GetDb) {
  app.post("/api/shop/client-errors", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = String(req.headers.origin || "");
    if (!origin || !isAllowedShopOrigin(origin)) return res.sendStatus(403);
    const parsed = clientErrorInput.safeParse(req.body);
    if (!parsed.success) return res.sendStatus(400);
    try {
      if (!await shopRateLimitOrReject(req, res, "client_errors", 10, 60_000)) return;
      if (!await rateLimitAllow("client_errors_global", 120, 60_000)) return res.sendStatus(429);
      const data = parsed.data;
      const report = { ...data,
        at: new Date().toISOString(),
        name: redactErrorText(data.name), message: redactErrorText(data.message),
        stack: redactErrorText(data.stack || ""),
        path: redactErrorText(data.path.split(/[?#]/)[0]),
        release: data.release,
        browser: redactErrorText(String(req.headers["user-agent"] || "").slice(0, 300)),
      };
      await recordClientError(await getShopDb(), report);
      console.warn("[client-error]", JSON.stringify(report));
      return res.sendStatus(204);
    } catch { return res.sendStatus(503); }
  });
  app.get("/api/shop/admin/site-health", requireAuth(getAuthDb), requireActive, requireManager, async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { return res.json(await siteHealth(await getShopDb())); }
    catch { return res.status(503).json({ error: "Chưa tải được tình trạng website. Vui lòng thử lại." }); }
  });
}
