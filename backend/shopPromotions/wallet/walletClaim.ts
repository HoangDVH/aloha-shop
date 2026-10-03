import type { Db } from "mongodb";
import { CAMPAIGN_ERROR_MESSAGES } from "../../shopCampaigns/messages.js";
import { voucherWalletEnabled } from "../../shopCampaigns/flags.js";
import { getCurrentCampaign } from "../../shopCampaigns/currentCampaign.js";
import type { CampaignViewer } from "../../shopCampaigns/viewer.js";
import { checkIsNewWebBuyer } from "../customerEligibility.js";
import { PROMOTIONS_COL, type PromotionDoc } from "../types.js";
import {
  WALLET_MESSAGES,
  claimWindowError,
  fail,
  insertWalletEntry,
  type ClaimResult,
  type WalletSource,
} from "./walletService.js";

/** Chặn chung trước khi xét từng voucher: cờ, đăng nhập, khoá, khách lẻ. */
export function viewerClaimError(viewer: CampaignViewer, promotionId = ""): ClaimResult | null {
  if (!voucherWalletEnabled()) return fail("wallet_disabled", 404, WALLET_MESSAGES.disabled, promotionId);
  if (!viewer.accountId) return fail("login_required", 401, WALLET_MESSAGES.login, promotionId);
  if (viewer.status.locked) return fail("account_locked", 403, WALLET_MESSAGES.locked, promotionId);
  if (!viewer.status.retail) return fail("retail_only", 403, CAMPAIGN_ERROR_MESSAGES.retail_only, promotionId);
  return null;
}

/** Voucher lưu được qua kho: đang bật, phải lưu, công khai, không phải voucher sỉ. */
function isClaimable(p: PromotionDoc | null | undefined): p is PromotionDoc {
  return Boolean(
    p && p.status === "active" && p.claimRequired && p.isPublic !== false && p.targetCustomer !== "wholesale"
  );
}

async function newWebError(db: Db, promo: PromotionDoc, viewer: CampaignViewer): Promise<ClaimResult | null> {
  if (promo.targetCustomer !== "new_web") return null;
  const isNew = await checkIsNewWebBuyer(db, {
    phone: viewer.phone,
    email: viewer.email,
    userId: viewer.accountId || undefined,
  });
  return isNew === false ? fail("not_eligible", 409, WALLET_MESSAGES.newOnly, promo.id) : null;
}

async function claimOne(
  db: Db,
  promo: PromotionDoc,
  viewer: CampaignViewer,
  source: WalletSource,
  nowIso: string
): Promise<ClaimResult> {
  const windowErr = claimWindowError(promo, nowIso);
  if (windowErr) return windowErr;
  const newErr = await newWebError(db, promo, viewer);
  if (newErr) return newErr;
  return insertWalletEntry(db, promo, viewer.accountId as string, source, nowIso);
}

/** Id voucher của chiến dịch khách đang thấy (chiến dịch chỉ-test chỉ tài khoản test thấy). */
async function viewerCampaignVoucherIds(db: Db, viewer: CampaignViewer, nowMs: number): Promise<string[]> {
  const state = await getCurrentCampaign(db, nowMs, { isTestBuyer: viewer.status.isTestBuyer }, { fresh: true });
  return state.active?.content.voucherIds || [];
}

/** Lưu 1 voucher từ kho voucher chiến dịch. Voucher không nằm trong chiến dịch đang chạy → 404. */
export async function claimVoucher(
  db: Db,
  viewer: CampaignViewer,
  promotionId: string,
  nowMs = Date.now()
): Promise<ClaimResult> {
  const id = String(promotionId || "").trim();
  const blocked = viewerClaimError(viewer, id);
  if (blocked) return blocked;
  const ids = await viewerCampaignVoucherIds(db, viewer, nowMs);
  const promo = ids.includes(id) ? await db.collection<PromotionDoc>(PROMOTIONS_COL).findOne({ id }) : null;
  if (!isClaimable(promo)) return fail("not_found", 404, WALLET_MESSAGES.notFound, id);
  return claimOne(db, promo, viewer, "vault", new Date(nowMs).toISOString());
}

export type BatchSummary = {
  ok: true;
  saved: number;
  total: number;
  skipped: number;
  message: string;
  results: ClaimResult[];
};

/** "Thu thập tất cả": lưu mọi voucher đủ điều kiện; gửi lại nhiều lần cho cùng kết quả. */
export async function claimAllVouchers(
  db: Db,
  viewer: CampaignViewer,
  nowMs = Date.now()
): Promise<BatchSummary | ClaimResult> {
  const blocked = viewerClaimError(viewer);
  if (blocked) return blocked;
  const ids = await viewerCampaignVoucherIds(db, viewer, nowMs);
  const promos = (await db.collection<PromotionDoc>(PROMOTIONS_COL).find({ id: { $in: ids } }).toArray()).filter(
    isClaimable
  );
  const nowIso = new Date(nowMs).toISOString();
  const results: ClaimResult[] = [];
  for (const p of promos) results.push(await claimOne(db, p, viewer, "batch", nowIso));
  const saved = results.filter((r) => r.ok).length;
  const skipped = results.length - saved;
  const message = skipped
    ? `Đã lưu ${saved}/${results.length}, ${skipped} mã không đủ điều kiện`
    : `Đã lưu ${saved}/${results.length} voucher`;
  return { ok: true, saved, total: results.length, skipped, message, results };
}

/**
 * Khách nhập tay mã của voucher phải-lưu mà chưa lưu: tự lưu rồi áp (không cần voucher nằm trong kho).
 * Chỉ tài khoản khách lẻ đã đăng nhập; trả lỗi để hiện lý do ("Voucher đã hết lượt").
 */
export async function claimByCode(
  db: Db,
  viewer: CampaignViewer,
  promo: PromotionDoc,
  nowMs = Date.now()
): Promise<ClaimResult> {
  const blocked = viewerClaimError(viewer, promo.id);
  if (blocked) return blocked;
  if (promo.status !== "active" || !promo.claimRequired || promo.targetCustomer === "wholesale") {
    return fail("not_found", 404, WALLET_MESSAGES.notFound, promo.id);
  }
  return claimOne(db, promo, viewer, "code", new Date(nowMs).toISOString());
}
