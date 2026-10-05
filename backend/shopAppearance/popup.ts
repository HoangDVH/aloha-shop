import type { Express, Request, RequestHandler, Response } from "express";
import { clientIpFromReq, rateLimitAllow } from "../shopRateLimit.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import {
  defaultPopup,
  type AppearancePopup,
  type PopupAudience,
  type PopupPages,
} from "./types.js";

export const POPUP_STATS_COL = "aloha_shop_popup_stats";

const PAGES = new Set<PopupPages>(["home", "home_deals", "all"]);
const AUDIENCES = new Set<PopupAudience>(["all", "new", "returning"]);
const EVENTS = new Set(["view", "click", "close"]);
const CAMPAIGN_ID_RE = /^[\w.-]{1,60}$/;

function isoOrEmpty(v: unknown): string {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export function normalizePopup(raw: Partial<AppearancePopup> | null | undefined): AppearancePopup {
  const base = defaultPopup();
  const p = raw && typeof raw === "object" ? raw : {};
  const delay = Number(p.delaySeconds);
  const freq = Number(p.frequencyDays);
  const startAt = isoOrEmpty(p.startAt);
  let endAt = isoOrEmpty(p.endAt);
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) endAt = "";
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
    startAt,
    endAt,
    pages: PAGES.has(p.pages as PopupPages) ? (p.pages as PopupPages) : base.pages,
    audience: AUDIENCES.has(p.audience as PopupAudience)
      ? (p.audience as PopupAudience)
      : base.audience,
    reopenBadge: p.reopenBadge !== false,
    items: Array.isArray(p.items)
      ? p.items
          .filter((it): it is any => Boolean(it && typeof it === "object" && (it as any).imageUrl))
          .map((it) => ({
            id: it.id ? String(it.id) : undefined,
            imageUrl: String(it.imageUrl || "").trim(),
            ctaHref: String(it.ctaHref || "").trim(),
            ctaLabel: String(it.ctaLabel || "").trim(),
            title: String(it.title || "").trim(),
          }))
      : undefined,
    autoplaySeconds: Number.isFinite(Number(p.autoplaySeconds))
      ? Math.max(2, Math.min(10, Math.round(Number(p.autoplaySeconds))))
      : 3.5,
  };
}

/** Ngày theo giờ VN (UTC+7), dạng YYYY-MM-DD. */
export function vnDay(ms: number): string {
  return new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
}

type StatsDoc = {
  _id: string;
  views?: number;
  clicks?: number;
  closes?: number;
  days?: Record<string, { views?: number; clicks?: number; closes?: number }>;
  updatedAt?: string;
};

/** Đếm lượt hiện / bấm / đóng popup theo mã chiến dịch đang xuất bản. */
export function registerPopupStatsRoutes(
  app: Express,
  gate: RequestHandler[],
  getShopDb: GetShopDb,
  getPublishedPopup: () => Promise<AppearancePopup>
) {
  app.post("/api/shop/appearance/popup-event", async (req: Request, res: Response) => {
    try {
      const event = String(req.body?.event || "");
      if (!EVENTS.has(event)) {
        res.status(400).json({ ok: false, error: "invalid_event" });
        return;
      }
      if (!(await rateLimitAllow(`popup-event:${clientIpFromReq(req)}`, 60, 10 * 60_000))) {
        res.status(429).json({ ok: false, error: "rate_limited" });
        return;
      }
      const popup = await getPublishedPopup();
      if (!popup.enabled || !popup.imageUrl) {
        res.json({ ok: true });
        return;
      }
      const field = `${event}s`;
      const shopDb = await getShopDb();
      await shopDb.collection<StatsDoc>(POPUP_STATS_COL).updateOne(
        { _id: popup.campaignId },
        {
          $inc: { [field]: 1, [`days.${vnDay(Date.now())}.${field}`]: 1 },
          $set: { updatedAt: new Date().toISOString() },
        },
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "popup_event_failed" });
    }
  });

  app.get("/api/shop/admin/appearance/popup-stats", ...gate, async (req: Request, res: Response) => {
    try {
      const campaignId = String(req.query.campaignId || "").trim();
      if (!CAMPAIGN_ID_RE.test(campaignId)) {
        res.status(400).json({ error: "invalid_campaign", message: "Mã chiến dịch không hợp lệ." });
        return;
      }
      const shopDb = await getShopDb();
      const doc = await shopDb.collection<StatsDoc>(POPUP_STATS_COL).findOne({ _id: campaignId });
      const today = doc?.days?.[vnDay(Date.now())] || {};
      res.json({
        campaignId,
        views: doc?.views || 0,
        clicks: doc?.clicks || 0,
        closes: doc?.closes || 0,
        today: { views: today.views || 0, clicks: today.clicks || 0, closes: today.closes || 0 },
        updatedAt: doc?.updatedAt || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "popup_stats_failed" });
    }
  });
}
