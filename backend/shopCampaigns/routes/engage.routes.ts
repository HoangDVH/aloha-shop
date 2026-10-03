import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { applyShopCors } from "../../shopCors.js";
import { clientIpFromReq, shopRateLimitOrReject } from "../../shopRateLimit.js";
import { campaignEnabled } from "../flags.js";
import { getCurrentCampaign } from "../currentCampaign.js";
import { readCampaignViewer } from "../viewer.js";
import { campaignErrorBody } from "../messages.js";
import { recordBannerEvent, recordRemind } from "../stats/campaignStats.js";

type GetDb = () => Promise<Db>;

/** Khoá đếm của khách: tài khoản nếu đã đăng nhập, không thì IP + trình duyệt (chỉ lưu dạng băm). */
function actorOf(req: Request, accountId: string | null): string {
  if (accountId) return `acc:${accountId}`;
  return `anon:${clientIpFromReq(req as any)}|${String(req.headers["user-agent"] || "").slice(0, 160)}`;
}

async function remindHandler(getDb: GetDb, req: Request, res: Response) {
  if (!campaignEnabled()) return res.status(404).json({ ok: false, error: "Chưa có chương trình." });
  if (!(await shopRateLimitOrReject(req as any, res as any, "shop_campaign_remind", 30, 60_000))) return;
  const ma = String(req.body?.ma || "").trim().toUpperCase();
  const db = await getDb();
  const viewer = await readCampaignViewer(db, req);
  if (viewer.status.locked || !viewer.status.retail) return res.status(403).json(campaignErrorBody("retail_only"));
  const nowMs = Date.now();
  const { active } = await getCurrentCampaign(db, nowMs, { isTestBuyer: viewer.status.isTestBuyer });
  if (!active || !active.content.products.some((p) => p.ma === ma && !p.paused)) {
    return res.status(404).json({ ok: false, error: "Sản phẩm không thuộc chương trình đang chạy." });
  }
  const r = await recordRemind(db, {
    campaignId: active.id,
    ma,
    actor: actorOf(req, viewer.accountId),
    nowMs,
    campaignEndMs: Date.parse(active.content.info.endAt),
  });
  res.json({ ok: true, counted: r.counted });
}

async function trackHandler(getDb: GetDb, req: Request, res: Response) {
  if (!campaignEnabled()) return res.status(204).end();
  if (!(await shopRateLimitOrReject(req as any, res as any, "shop_campaign_track", 60, 60_000))) return;
  const event = req.body?.event === "bannerView" ? "bannerView" : req.body?.event === "bannerClick" ? "bannerClick" : null;
  const bannerId = String(req.body?.bannerId || "").slice(0, 64);
  if (!event || !bannerId) return res.status(400).json({ ok: false });
  const db = await getDb();
  const nowMs = Date.now();
  const { active } = await getCurrentCampaign(db, nowMs, { isTestBuyer: false });
  if (!active || !active.content.display.banners.some((b) => b.id === bannerId)) return res.status(204).end();
  await recordBannerEvent(db, { campaignId: active.id, bannerId, event, nowMs });
  res.status(204).end();
}

export function registerCampaignEngageRoutes(app: Express, getDb: GetDb) {
  app.post("/api/shop/campaigns/remind", async (req, res) => {
    applyShopCors(req, res);
    try {
      await remindHandler(getDb, req, res);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi ghi nhắc" });
    }
  });
  app.post("/api/shop/campaigns/track", async (req, res) => {
    applyShopCors(req, res);
    try {
      await trackHandler(getDb, req, res);
    } catch {
      res.status(204).end();
    }
  });
}
