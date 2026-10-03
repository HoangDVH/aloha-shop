import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { applyShopCors } from "../../shopCors.js";
import { shopRateLimitOrReject } from "../../shopRateLimit.js";
import { VOUCHER_WALLET_COL } from "../../shopCampaigns/types.js";
import { voucherWalletEnabled } from "../../shopCampaigns/flags.js";
import { readCampaignViewer } from "../../shopCampaigns/viewer.js";
import { PROMOTIONS_COL, type PromotionDoc } from "../types.js";
import { claimAllVouchers, claimVoucher } from "./walletClaim.js";
import { isClaimFail, type WalletDoc } from "./walletService.js";
import { customerKeyFor } from "../checkoutPromotions.js";
import { latestRedemptions, loadVoucherReturns, type VoucherLatest } from "../voucherHistory.js";

type GetDb = () => Promise<Db>;

export type WalletItemState = "usable" | "held" | "upcoming" | "paused" | "locked" | "used" | "expired";

/** Trạng thái hiển thị của 1 vé trong ví (thứ tự ưu tiên: đã dùng → hết hạn → ngừng → khoá → chưa tới ngày). */
export function walletItemState(
  row: Pick<WalletDoc, "status">,
  promo: Pick<PromotionDoc, "status" | "startDate" | "endDate"> | null,
  canUse: boolean,
  nowIso: string
): WalletItemState {
  if (row.status === "used") return "used";
  if (row.status === "expired" || !promo || (promo.endDate && promo.endDate < nowIso)) return "expired";
  if (promo.status !== "active") return "paused";
  if (!canUse) return "locked";
  if (row.status === "held") return "held";
  if (promo.startDate && promo.startDate > nowIso) return "upcoming";
  return "usable";
}

const TAB_OF: Record<WalletItemState, "active" | "used" | "expired"> = {
  usable: "active",
  held: "active",
  upcoming: "active",
  paused: "active",
  locked: "active",
  used: "used",
  expired: "expired",
};

/** Voucher tự áp (không lưu ví) mà khách đã dùng / đang giữ cho đơn — hiện ở ví như Shopee. */
function redemptionOnlyRows(saved: WalletDoc[], latest: Map<string, VoucherLatest>, accountId: string): WalletDoc[] {
  const have = new Set(saved.map((r) => r.promotionId));
  const out: WalletDoc[] = [];
  for (const [promotionId, v] of latest) {
    if (have.has(promotionId) || v.status === "released") continue;
    out.push({
      _id: `redemption:${promotionId}`,
      promotionId,
      accountId,
      status: v.status,
      source: "code",
      orderCode: v.orderCode,
      savedAt: v.at,
      updatedAt: v.at,
      usedAt: v.status === "used" ? v.at : null,
    });
  }
  return out;
}

async function walletHandler(getDb: GetDb, req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (!voucherWalletEnabled()) return res.json({ ok: true, enabled: false, items: [], claimedIds: [] });
  const db = await getDb();
  const viewer = await readCampaignViewer(db, req);
  if (!viewer.accountId) return res.json({ ok: true, enabled: true, loggedIn: false, items: [], claimedIds: [] });
  const saved = await db
    .collection<WalletDoc>(VOUCHER_WALLET_COL)
    .find({ accountId: viewer.accountId })
    .sort({ savedAt: -1 })
    .limit(200)
    .toArray();
  const customerKey = customerKeyFor(viewer.accountId);
  const latest = await latestRedemptions(db, customerKey);
  const returns = await loadVoucherReturns(db, customerKey, latest);
  const rows = [...saved, ...redemptionOnlyRows(saved, latest, viewer.accountId)];
  const promos = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ id: { $in: rows.map((r) => r.promotionId) } })
    .toArray();
  const byId = new Map(promos.map((p) => [p.id, p]));
  const nowIso = new Date().toISOString();
  const canUse = viewer.status.retail && !viewer.status.locked;
  const items = rows.map((r) => {
    const p = byId.get(r.promotionId) || null;
    const state = walletItemState(r, p, canUse, nowIso);
    const ret = r.status === "saved" ? returns.get(r.promotionId) : undefined;
    return {
      promotionId: r.promotionId,
      state,
      tab: TAB_OF[state],
      orderCode: r.status === "held" || r.status === "used" ? r.orderCode || null : null,
      returnedFrom: ret && TAB_OF[state] === "active" ? { orderCode: ret.orderCode, reason: ret.reason } : null,
      savedAt: r.savedAt,
      usedAt: r.usedAt || null,
      voucher: p
        ? {
            id: p.id,
            title: p.title,
            description: p.description || "",
            benefitType: p.benefitType || "goods",
            discountType: p.discountType,
            discountValue: p.discountValue,
            maxDiscountVnd: p.maxDiscountVnd,
            minOrderThreshold: p.minOrderThreshold,
            targetCustomer: p.targetCustomer,
            startDate: p.startDate,
            endDate: p.endDate,
          }
        : null,
    };
  });
  const counts = { active: 0, used: 0, expired: 0 };
  for (const it of items) counts[it.tab]++;
  res.json({
    ok: true,
    enabled: true,
    loggedIn: true,
    items,
    counts,
    claimedIds: saved.map((r) => r.promotionId),
  });
}

async function claimHandler(getDb: GetDb, req: Request, res: Response) {
  if (!(await shopRateLimitOrReject(req as any, res as any, "shop_voucher_claim", 30, 60_000))) return;
  const db = await getDb();
  const viewer = await readCampaignViewer(db, req);
  const r = await claimVoucher(db, viewer, String(req.body?.promotionId || ""));
  if (isClaimFail(r)) return res.status(r.status).json(r);
  res.json(r);
}

async function claimBatchHandler(getDb: GetDb, req: Request, res: Response) {
  if (!(await shopRateLimitOrReject(req as any, res as any, "shop_voucher_claim_batch", 10, 60_000))) return;
  const db = await getDb();
  const viewer = await readCampaignViewer(db, req);
  const r = await claimAllVouchers(db, viewer);
  if ("status" in r && r.ok === false) return res.status(r.status).json(r);
  res.json(r);
}

function wrap(fn: (req: Request, res: Response) => Promise<unknown>, fallback: string) {
  return async (req: Request, res: Response) => {
    applyShopCors(req, res);
    try {
      await fn(req, res);
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e?.message || fallback });
    }
  };
}

export function registerVoucherWalletRoutes(app: Express, getDb: GetDb) {
  app.options("/api/shop/vouchers/*", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });
  app.get("/api/shop/vouchers/wallet", wrap((q, s) => walletHandler(getDb, q, s), "Lỗi tải ví voucher"));
  app.post("/api/shop/vouchers/claim", wrap((q, s) => claimHandler(getDb, q, s), "Lỗi lưu voucher"));
  app.post(
    "/api/shop/vouchers/claim-batch",
    wrap((q, s) => claimBatchHandler(getDb, q, s), "Lỗi lưu voucher")
  );
}
