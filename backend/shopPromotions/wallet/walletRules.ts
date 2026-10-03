/**
 * Lọc danh sách ưu đãi theo người mua trước khi tính giảm giá (báo giá, báo giá ship, tạo đơn dùng chung):
 * - voucher chiến dịch / phải-lưu chỉ cho khách lẻ, tài khoản không khoá;
 * - voucher phải-lưu chỉ áp khi đã nằm trong ví (cờ ví bật);
 * - nhập tay mã của voucher phải-lưu thì tự lưu rồi áp.
 */
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../../shopAuth/models.js";
import { campaignEnabled, voucherWalletEnabled } from "../../shopCampaigns/flags.js";
import { liveCampaignVoucherIds } from "../../shopCampaigns/currentCampaign.js";
import { CAMPAIGN_ADMIN_MESSAGES, CAMPAIGN_ERROR_MESSAGES } from "../../shopCampaigns/messages.js";
import { resolveRetailStatus, type RetailStatus } from "../../shopCampaigns/retail.js";
import type { CampaignViewer } from "../../shopCampaigns/viewer.js";
import { loadActivePromotions } from "../checkoutPromotions.js";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  type EvaluatedCandidate,
  type PromotionCodeDoc,
  type PromotionDoc,
} from "../types.js";
import { claimByCode } from "./walletClaim.js";
import { WALLET_MESSAGES, isClaimFail, savedPromotionIds } from "./walletService.js";

export type BuyerPromotionInput = {
  now: Date;
  accountId?: string;
  account?: Record<string, unknown> | null;
  phone?: string;
  email?: string;
  selectedCode?: string;
};

export type BuyerPromotions = {
  promotions: PromotionDoc[];
  /** Voucher bị loại kèm lý do, để hiện trong modal chọn voucher. */
  notices: EvaluatedCandidate[];
  status: RetailStatus;
  /** Voucher của mã khách nhập (nếu mã tồn tại). */
  codePromotionId?: string;
};

const VN_OFFSET_MS = 7 * 3600_000;

function vnDayMonth(iso: string): string {
  const d = new Date(Date.parse(iso) + VN_OFFSET_MS);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function noticeFor(p: PromotionDoc, reason: string, extra: Partial<EvaluatedCandidate> = {}): EvaluatedCandidate {
  return {
    promotionId: p.id,
    title: p.title,
    type: p.type,
    benefitType: p.benefitType || "goods",
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscountVnd: p.maxDiscountVnd,
    minOrderThreshold: p.minOrderThreshold,
    thresholdOperator: p.thresholdOperator,
    eligible: false,
    ineligibleReason: reason,
    calculatedDiscount: 0,
    isPublic: p.isPublic !== false,
    targetCustomer: p.targetCustomer,
    endDate: p.endDate,
    description: p.description,
    ...extra,
  };
}

/**
 * Quy tắc lọc thuần (không đọc DB) — tách riêng để test.
 * `campaignVoucherIds`: voucher gắn với chiến dịch đang bật; `saved`: id đang `saved` trong ví.
 */
export function applyBuyerRules(
  promotions: PromotionDoc[],
  ctx: { status: RetailStatus; campaignVoucherIds: Set<string>; saved: Set<string>; walletOn: boolean }
): { promotions: PromotionDoc[]; notices: EvaluatedCandidate[] } {
  const kept: PromotionDoc[] = [];
  const notices: EvaluatedCandidate[] = [];
  const allowed = ctx.status.retail && !ctx.status.locked;
  for (const p of promotions) {
    const needsWallet = ctx.walletOn && Boolean(p.claimRequired);
    const campaignOnly = ctx.campaignVoucherIds.has(p.id) || needsWallet;
    const visible = p.isPublic !== false;
    if (campaignOnly && !allowed) {
      if (visible) {
        const reason = ctx.status.locked ? CAMPAIGN_ADMIN_MESSAGES.locked : CAMPAIGN_ERROR_MESSAGES.retail_only;
        notices.push(noticeFor(p, reason));
      }
      continue;
    }
    if (needsWallet && !ctx.saved.has(p.id)) {
      if (visible) notices.push(noticeFor(p, WALLET_MESSAGES.notSaved, { needsClaim: true }));
      continue;
    }
    kept.push(p);
  }
  return { promotions: kept, notices };
}

async function loadAccount(db: Db, input: BuyerPromotionInput) {
  if (input.account !== undefined) return input.account;
  if (!input.accountId) return null;
  return (await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(input.accountId))) as Record<string, unknown> | null;
}

/** Mã khách nhập thuộc voucher phải-lưu chưa lưu → thử lưu; lỗi thì trả notice để hiện lý do. */
async function autoClaimSelectedCode(
  db: Db,
  viewer: CampaignViewer,
  codeDoc: PromotionCodeDoc | null,
  saved: Set<string>
): Promise<EvaluatedCandidate | null> {
  if (!codeDoc || !viewer.accountId || saved.has(codeDoc.promotionId)) return null;
  const code = codeDoc.code;
  const promo = await db.collection<PromotionDoc>(PROMOTIONS_COL).findOne({ id: codeDoc.promotionId });
  if (!promo?.claimRequired) return null;
  const r = await claimByCode(db, viewer, promo);
  if (!isClaimFail(r)) {
    saved.add(promo.id);
    return null;
  }
  return noticeFor(promo, r.error, { code, needsClaim: r.code !== "claim_limit" });
}

/** Voucher đã lưu nhưng chưa tới ngày dùng (mở lưu sớm) → "Dùng từ 01/10". */
async function notStartedNotices(db: Db, saved: Set<string>, nowIso: string): Promise<EvaluatedCandidate[]> {
  if (!saved.size) return [];
  const rows = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ id: { $in: [...saved] }, status: "active", startDate: { $gt: nowIso } } as any)
    .toArray();
  return rows.map((p) => noticeFor(p, `Dùng từ ${vnDayMonth(p.startDate as string)}`));
}

async function findCode(db: Db, code: string): Promise<PromotionCodeDoc | null> {
  if (!code) return null;
  return db.collection<PromotionCodeDoc>(PROMOTION_CODES_COL).findOne({ code, active: { $ne: false } } as any);
}

export async function loadBuyerPromotions(db: Db, input: BuyerPromotionInput): Promise<BuyerPromotions> {
  const walletOn = voucherWalletEnabled();
  const account = await loadAccount(db, input);
  const phone = String(input.phone || account?.phone || "");
  const email = String(input.email || account?.email || "");
  const code = String(input.selectedCode || "").trim().toUpperCase();
  const [all, status, campaignVoucherIds, saved, codeDoc] = await Promise.all([
    loadActivePromotions(db, input.now),
    resolveRetailStatus(db, { account, phone, email }),
    campaignEnabled() ? liveCampaignVoucherIds(db) : Promise.resolve(new Set<string>()),
    walletOn ? savedPromotionIds(db, input.accountId) : Promise.resolve(new Set<string>()),
    findCode(db, code),
  ]);
  const extra: EvaluatedCandidate[] = [];
  if (walletOn) {
    const viewer: CampaignViewer = { accountId: input.accountId || null, account, email, phone, status };
    const claimNotice = await autoClaimSelectedCode(db, viewer, codeDoc, saved);
    if (claimNotice) extra.push(claimNotice);
    extra.push(...(await notStartedNotices(db, saved, input.now.toISOString())));
  }
  const ruled = applyBuyerRules(all, { status, campaignVoucherIds, saved, walletOn });
  const seen = new Set(ruled.notices.map((n) => n.promotionId));
  return {
    promotions: ruled.promotions,
    notices: [...ruled.notices, ...extra.filter((n) => !seen.has(n.promotionId))],
    status,
    codePromotionId: codeDoc?.promotionId,
  };
}

/**
 * Gắn lý do bị loại vào kết quả báo giá. Mã khách nhập thuộc voucher bị loại thì thay dòng
 * "không còn hoạt động" chung chung bằng lý do cụ thể ("Dành cho khách lẻ", "Bạn chưa lưu voucher này").
 */
export function withBuyerNotices<T extends { candidates: EvaluatedCandidate[] }>(
  quote: T,
  buyer: BuyerPromotions,
  selectedCode?: string
): T {
  const code = String(selectedCode || "").trim().toUpperCase();
  const codeNotice = buyer.notices.find((n) => n.promotionId === buyer.codePromotionId);
  let candidates = quote.candidates;
  if (code && codeNotice) {
    candidates = candidates.filter((c) => !(c.promotionId === "invalid_code" && c.code === code));
  }
  const have = new Set(candidates.map((c) => c.promotionId));
  const extra = buyer.notices
    .filter((n) => !have.has(n.promotionId))
    .map((n) => (n === codeNotice && code ? { ...n, code } : n));
  return { ...quote, candidates: [...candidates, ...extra] };
}
