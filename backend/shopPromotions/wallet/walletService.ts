/**
 * Ví voucher của khách (aloha_shop_voucher_wallet): lưu mã, giữ khi tạo đơn, dùng khi thanh toán,
 * trả về ví khi huỷ. Mỗi (voucher, tài khoản) đúng 1 bản ghi nhờ `_id` cố định.
 */
import type { Db } from "mongodb";
import { VOUCHER_WALLET_COL } from "../../shopCampaigns/types.js";
import { CAMPAIGN_ERROR_MESSAGES } from "../../shopCampaigns/messages.js";
import { voucherWalletEnabled } from "../../shopCampaigns/flags.js";
import { PROMOTIONS_COL, type PromotionDoc } from "../types.js";
import { drawMysteryPercent, isMystery, returnMysteryDraw } from "../mystery.js";

export type WalletStatus = "saved" | "held" | "used" | "expired";
export type WalletSource = "vault" | "batch" | "code";

export type WalletDoc = {
  _id: string;
  promotionId: string;
  accountId: string;
  status: WalletStatus;
  source: WalletSource;
  orderCode?: string | null;
  savedAt: string;
  updatedAt: string;
  usedAt?: string | null;
  /** Voucher túi mù: mức % đã bốc lúc lưu, cố định cho tài khoản này. */
  drawnPercent?: number;
};

export type ClaimFailCode =
  | "retail_only"
  | "account_locked"
  | "login_required"
  | "not_found"
  | "claim_not_started"
  | "expired"
  | "not_eligible"
  | "claim_limit"
  | "wallet_disabled";

export type ClaimResult =
  | { ok: true; already: boolean; promotionId: string; message: string; drawnPercent?: number }
  | { ok: false; status: number; code: ClaimFailCode; error: string; promotionId: string };

export function isClaimFail(r: ClaimResult): r is Extract<ClaimResult, { ok: false }> {
  return r.ok === false;
}

export const WALLET_MESSAGES = {
  saved: "Đã lưu voucher vào ví.",
  already: "Bạn đã lưu voucher này.",
  notFound: "Không tìm thấy voucher.",
  notStarted: "Voucher chưa mở lưu.",
  expired: "Voucher đã hết hạn.",
  newOnly: "Voucher chỉ dành cho khách mua lần đầu trên website.",
  login: "Vui lòng đăng nhập để lưu voucher.",
  locked: "Tài khoản đang bị khoá, không lưu được voucher.",
  disabled: "Tính năng ví voucher đang tắt.",
  notSaved: "Bạn chưa lưu voucher này.",
  usedElsewhere: "Voucher trong ví đã được dùng cho đơn khác.",
} as const;

export function walletId(promotionId: string, accountId: string): string {
  return `${promotionId}:${accountId}`;
}

export async function ensureWalletIndexes(db: Db): Promise<void> {
  const col = db.collection(VOUCHER_WALLET_COL);
  await col.createIndex({ accountId: 1, status: 1 });
  await col.createIndex({ orderCode: 1 }, { sparse: true });
  await col.createIndex({ promotionId: 1, status: 1 });
}

export function fail(code: ClaimFailCode, status: number, error: string, promotionId: string): ClaimResult {
  return { ok: false, status, code, error, promotionId };
}

/** Kiểm tra voucher có đang mở lưu không (không tính lượt). */
export function claimWindowError(promo: PromotionDoc, nowIso: string): ClaimResult | null {
  if (promo.claimStartDate && promo.claimStartDate > nowIso) {
    return fail("claim_not_started", 409, WALLET_MESSAGES.notStarted, promo.id);
  }
  if (promo.endDate && promo.endDate < nowIso) return fail("expired", 409, WALLET_MESSAGES.expired, promo.id);
  return null;
}

/** Tăng `claimedCount` chỉ khi còn lượt — một lệnh ghi nên không vượt tổng lượt kể cả khi tranh chấp. */
async function reserveClaimSlot(db: Db, promotionId: string): Promise<boolean> {
  const r = await db.collection<PromotionDoc>(PROMOTIONS_COL).updateOne(
    {
      id: promotionId,
      status: "active",
      $or: [
        { claimLimitTotal: { $exists: false } },
        { claimLimitTotal: null },
        { claimLimitTotal: { $lte: 0 } },
        { $expr: { $lt: [{ $ifNull: ["$claimedCount", 0] }, "$claimLimitTotal"] } },
      ],
    } as any,
    { $inc: { claimedCount: 1 } as any }
  );
  return r.modifiedCount === 1;
}

async function returnClaimSlot(db: Db, promotionId: string): Promise<void> {
  await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .updateOne({ id: promotionId, claimedCount: { $gt: 0 } } as any, { $inc: { claimedCount: -1 } as any });
}

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/**
 * Ghi 1 bản ghi ví cho voucher đã qua mọi kiểm tra điều kiện.
 * Thứ tự: đã có trong ví → giữ lượt → ghi ví; ghi ví lỗi thì trả lại lượt (bước bù).
 */
export async function insertWalletEntry(
  db: Db,
  promo: PromotionDoc,
  accountId: string,
  source: WalletSource,
  nowIso: string
): Promise<ClaimResult> {
  const col = db.collection<WalletDoc>(VOUCHER_WALLET_COL);
  const _id = walletId(promo.id, accountId);
  const alreadyResult = async (): Promise<ClaimResult> => {
    const row = await col.findOne({ _id }, { projection: { drawnPercent: 1 } });
    return {
      ok: true,
      already: true,
      promotionId: promo.id,
      message: WALLET_MESSAGES.already,
      ...(row?.drawnPercent ? { drawnPercent: row.drawnPercent } : {}),
    };
  };
  if (await col.findOne({ _id }, { projection: { _id: 1 } })) return alreadyResult();
  if (!(await reserveClaimSlot(db, promo.id))) {
    return fail("claim_limit", 409, CAMPAIGN_ERROR_MESSAGES.claim_limit, promo.id);
  }
  let drawnPercent: number | null = null;
  if (isMystery(promo)) {
    drawnPercent = await drawMysteryPercent(db, promo);
    if (drawnPercent == null) {
      await returnClaimSlot(db, promo.id);
      return fail("claim_limit", 409, CAMPAIGN_ERROR_MESSAGES.claim_limit, promo.id);
    }
  }
  try {
    await col.insertOne({
      _id,
      promotionId: promo.id,
      accountId,
      status: "saved",
      source,
      orderCode: null,
      savedAt: nowIso,
      updatedAt: nowIso,
      ...(drawnPercent != null ? { drawnPercent } : {}),
    });
  } catch (e) {
    await returnClaimSlot(db, promo.id);
    if (drawnPercent != null) await returnMysteryDraw(db, promo.id, drawnPercent);
    if (isDuplicateKey(e)) return alreadyResult();
    throw e;
  }
  return {
    ok: true,
    already: false,
    promotionId: promo.id,
    message: WALLET_MESSAGES.saved,
    ...(drawnPercent != null ? { drawnPercent } : {}),
  };
}

/** Mức túi mù đã bốc của tài khoản: promotionId → %, chỉ các voucher đang `saved`. */
export async function drawnPercentsFor(db: Db, accountId: string | undefined): Promise<Map<string, number>> {
  if (!accountId) return new Map();
  const rows = await db
    .collection<WalletDoc>(VOUCHER_WALLET_COL)
    .find({ accountId, status: "saved", drawnPercent: { $gt: 0 } }, { projection: { promotionId: 1, drawnPercent: 1 } })
    .toArray();
  return new Map(rows.map((r) => [r.promotionId, r.drawnPercent as number]));
}

/** Các voucher trong ví đang dùng được (status saved) của một tài khoản. */
export async function savedPromotionIds(db: Db, accountId: string | undefined): Promise<Set<string>> {
  if (!accountId) return new Set();
  const rows = await db
    .collection<WalletDoc>(VOUCHER_WALLET_COL)
    .find({ accountId, status: "saved" }, { projection: { promotionId: 1 } })
    .toArray();
  return new Set(rows.map((r) => r.promotionId));
}

/**
 * Tạo đơn: chuyển voucher phải-lưu đã áp từ `saved` sang `held`.
 * Trả false nếu một voucher không còn `saved` (vừa dùng cho đơn khác) — các bản đã giữ được trả lại.
 */
export async function holdWalletVouchers(
  db: Db,
  input: { accountId: string; orderCode: string; promotionIds: string[] }
): Promise<boolean> {
  if (!voucherWalletEnabled() || !input.accountId) return true;
  const ids = [...new Set(input.promotionIds.filter(Boolean))];
  if (!ids.length) return true;
  const claimRequired = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ id: { $in: ids }, claimRequired: true } as any, { projection: { id: 1 } })
    .toArray();
  const col = db.collection<WalletDoc>(VOUCHER_WALLET_COL);
  const nowIso = new Date().toISOString();
  for (const p of claimRequired) {
    const r = await col.updateOne(
      { _id: walletId(p.id, input.accountId), status: "saved" },
      { $set: { status: "held", orderCode: input.orderCode, updatedAt: nowIso } }
    );
    if (r.modifiedCount !== 1) {
      await releaseWalletForOrder(db, input.orderCode);
      return false;
    }
  }
  return true;
}

/** Đơn đã thanh toán: `held` → `used` (điều kiện theo trạng thái nên chỉ chạy đúng 1 lần). */
export async function useWalletForOrder(db: Db, orderCode: string): Promise<number> {
  if (!orderCode) return 0;
  const nowIso = new Date().toISOString();
  const r = await db
    .collection<WalletDoc>(VOUCHER_WALLET_COL)
    .updateMany({ orderCode, status: "held" }, { $set: { status: "used", usedAt: nowIso, updatedAt: nowIso } });
  return r.modifiedCount;
}

/** Đơn huỷ / hết hạn: `held` → `saved` nếu voucher còn hạn, ngược lại `expired`. */
export async function releaseWalletForOrder(db: Db, orderCode: string): Promise<number> {
  if (!orderCode) return 0;
  const col = db.collection<WalletDoc>(VOUCHER_WALLET_COL);
  const held = await col.find({ orderCode, status: "held" }).toArray();
  if (!held.length) return 0;
  const nowIso = new Date().toISOString();
  const promos = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ id: { $in: held.map((h) => h.promotionId) } }, { projection: { id: 1, endDate: 1 } })
    .toArray();
  const ended = new Set(promos.filter((p) => p.endDate && p.endDate < nowIso).map((p) => p.id));
  let changed = 0;
  for (const h of held) {
    const status: WalletStatus = ended.has(h.promotionId) ? "expired" : "saved";
    const r = await col.updateOne(
      { _id: h._id, status: "held", orderCode },
      { $set: { status, orderCode: null, updatedAt: nowIso } }
    );
    changed += r.modifiedCount;
  }
  return changed;
}

export async function renameWalletOrderCode(db: Db, fromCode: string, toCode: string): Promise<void> {
  if (!fromCode || !toCode || fromCode === toCode) return;
  await db
    .collection<WalletDoc>(VOUCHER_WALLET_COL)
    .updateMany({ orderCode: fromCode }, { $set: { orderCode: toCode, updatedAt: new Date().toISOString() } });
}
