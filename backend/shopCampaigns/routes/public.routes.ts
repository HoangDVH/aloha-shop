import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { applyShopCors } from "../../shopCors.js";
import { PROMOTIONS_COL, type PromotionDoc } from "../../shopPromotions/types.js";
import { campaignEnabled } from "../flags.js";
import { getCurrentCampaign, type ActiveCampaign } from "../currentCampaign.js";
import { getPhase, phaseEndsAt } from "../campaignPhase.js";
import { getCampaign } from "../campaignRepo.js";
import { isInvalidCampaign, validateCampaignContent } from "../schema.js";
import { verifyPreviewToken } from "../preview.js";
import { readCampaignViewer, type CampaignViewer } from "../viewer.js";
import { CAMPAIGN_ERROR_MESSAGES } from "../messages.js";
import { productGifts } from "../types.js";
import { checkIsNewWebBuyer } from "../../shopPromotions/customerEligibility.js";

type GetDb = () => Promise<Db>;

/** Voucher chiến dịch dạng công khai; bỏ voucher sỉ (chiến dịch chỉ cho khách lẻ). */
async function publicVouchers(db: Db, ids: string[], nowIso: string) {
  if (!ids.length) return [];
  const rows = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ id: { $in: ids }, status: "active", targetCustomer: { $ne: "wholesale" } })
    .toArray();
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows
    .filter((p) => !p.endDate || p.endDate >= nowIso)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description || "",
      type: p.type,
      benefitType: p.benefitType || "goods",
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxDiscountVnd: p.maxDiscountVnd,
      minOrderThreshold: p.minOrderThreshold,
      thresholdOperator: p.thresholdOperator || ">",
      targetCustomer: p.targetCustomer,
      startDate: p.startDate,
      endDate: p.endDate,
      claimRequired: Boolean((p as any).claimRequired),
      claimLimitTotal: (p as any).claimLimitTotal ?? null,
      claimedCount: (p as any).claimedCount ?? 0,
      claimStartDate: (p as any).claimStartDate ?? null,
    }));
}

function publicCampaign(a: ActiveCampaign) {
  const { info, slots, display, products } = a.content;
  return {
    id: a.id,
    name: info.name,
    slug: info.slug,
    startAt: info.startAt,
    endAt: info.endAt,
    teaserDays: info.teaserDays,
    phase: a.phase,
    phaseEndsAt: phaseEndsAt(info, a.phase),
    slots,
    display,
    products: products
      .filter((p) => !p.paused)
      .map((p) => ({ ma: p.ma, slotKey: p.slotKey || null, dealHot: Boolean(p.dealHot), hasGift: productGifts(p).length > 0 })),
    voucherIds: a.content.voucherIds,
  };
}

const NEW_BUYER_TTL_MS = 60_000;
const newBuyerCache = new Map<string, { at: number; value: boolean }>();

/** Khách mới mua lần đầu (khách chưa đăng nhập xem như mới). Cache ngắn theo tài khoản. */
async function isNewBuyer(db: Db, v: CampaignViewer): Promise<boolean> {
  if (!v.accountId) return true;
  const hit = newBuyerCache.get(v.accountId);
  if (hit && Date.now() - hit.at < NEW_BUYER_TTL_MS) return hit.value;
  const value = await checkIsNewWebBuyer(db, { phone: v.phone, email: v.email, userId: v.accountId });
  if (newBuyerCache.size > 5000) newBuyerCache.clear();
  newBuyerCache.set(v.accountId, { at: Date.now(), value });
  return value;
}

function viewerView(v: CampaignViewer, newBuyer: boolean) {
  const allowed = v.status.retail && !v.status.locked;
  return {
    loggedIn: Boolean(v.accountId),
    newBuyer,
    retail: v.status.retail,
    locked: v.status.locked,
    canUse: allowed,
    lockReason: allowed ? null : v.status.locked ? "account_locked" : "retail_only",
    lockMessage: allowed ? null : v.status.locked ? "Tài khoản đang bị khoá." : CAMPAIGN_ERROR_MESSAGES.retail_only,
  };
}

async function currentHandler(getDb: GetDb, req: Request, res: Response) {
  const serverNow = Date.now();
  res.setHeader("Cache-Control", "no-store");
  if (!campaignEnabled()) return res.json({ ok: true, serverNow, campaign: null, state: "none", upcoming: null });
  const db = await getDb();
  const viewer = await readCampaignViewer(db, req);
  const state = await getCurrentCampaign(db, serverNow, { isTestBuyer: viewer.status.isTestBuyer });
  const nowIso = new Date(serverNow).toISOString();
  const active = state.active;
  res.json({
    ok: true,
    serverNow,
    state: active ? active.phase : state.pausedId ? "paused" : "none",
    campaign: active ? publicCampaign(active) : null,
    vouchers: active ? await publicVouchers(db, active.content.voucherIds, nowIso) : [],
    upcoming: state.upcoming ? publicCampaign(state.upcoming) : null,
    viewer: viewerView(viewer, await isNewBuyer(db, viewer)),
  });
}

/**
 * Xem trước bản nháp theo giờ giả lập `at` (CP11). Chỉ đổi phần hiển thị: giá khi báo giá /
 * tạo đơn vẫn đọc chiến dịch đã bật, nên xem trước không bao giờ đổi giá thật.
 */
async function previewHandler(getDb: GetDb, req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const denied = () => res.status(401).json({ ok: false, code: "preview_invalid", error: "Link xem trước đã hết hạn hoặc không hợp lệ." });
  const token = verifyPreviewToken(String(req.query.token || ""));
  if (!token) return denied();
  const db = await getDb();
  const doc = await getCampaign(db, token.cid);
  const v = doc ? validateCampaignContent(doc.draft) : null;
  if (!doc || !v || isInvalidCampaign(v)) return denied();
  const at = Date.parse(String(req.query.at || "")) || Date.now();
  const active: ActiveCampaign = { id: doc._id, content: v.value, phase: getPhase(v.value.info, at), publishedAt: null };
  const viewer = await readCampaignViewer(db, req);
  res.json({
    ok: true,
    serverNow: at,
    preview: true,
    state: active.phase,
    campaign: publicCampaign(active),
    vouchers: await publicVouchers(db, v.value.voucherIds, new Date(at).toISOString()),
    upcoming: null,
    viewer: viewerView(viewer, !viewer.accountId),
  });
}

export function registerCampaignPublicRoutes(app: Express, getDb: GetDb) {
  app.get("/api/shop/campaigns/preview", async (req, res) => {
    applyShopCors(req, res);
    try {
      await previewHandler(getDb, req, res);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải bản xem trước" });
    }
  });

  app.options("/api/shop/campaigns/*", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  app.get("/api/shop/campaigns/current", async (req, res) => {
    applyShopCors(req, res);
    try {
      await currentHandler(getDb, req, res);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải chiến dịch" });
    }
  });
}
