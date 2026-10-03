import type { Db } from "mongodb";
import { normalizeVietnamesePhone, maskPhone } from "./phoneNormalization.js";

export const PROMOTION_REVIEWS_COL = "aloha_shop_promotion_reviews";

export type ReviewState = "pending" | "approved" | "rejected";

export interface PromotionReviewDoc {
  id: string;
  orderId: string;
  accountId: string;
  buyerPhoneMasked: string;
  buyerPhoneNormalized?: string;
  reasons: string[];
  state: ReviewState;
  decisionVersion: number;
  actor?: string;
  decisionNote?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function newReviewId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Khách hàng gửi yêu cầu xem xét lại ưu đãi (mục 8, 9, 10).
 * Giới hạn tối đa 3 lần / ngày / tài khoản (mục 8 & AB29).
 */
export async function requestPromotionReview(
  shopDb: Db,
  args: {
    orderId: string;
    accountId: string;
    buyerPhone: string;
    reason: string;
  }
): Promise<{ ok: true; reviewId: string } | { ok: false; error: string; code: string }> {
  const { orderId, accountId, buyerPhone, reason } = args;
  const col = shopDb.collection<PromotionReviewDoc>(PROMOTION_REVIEWS_COL);

  // Kiểm tra giới hạn 3 lần / ngày / tài khoản
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentCount = await col.countDocuments({
    accountId,
    createdAt: { $gte: oneDayAgo },
  });

  if (recentCount >= 3) {
    return {
      ok: false,
      error: "Bạn đã gửi tối đa 3 yêu cầu xem xét trong 24 giờ. Vui lòng thử lại sau.",
      code: "rate_limited",
    };
  }

  const phoneRes = normalizeVietnamesePhone(buyerPhone);
  const buyerPhoneMasked = maskPhone(buyerPhone);
  const buyerPhoneNormalized = phoneRes.valid ? phoneRes.normalized : undefined;

  const id = newReviewId();
  const nowIso = new Date().toISOString();

  const doc: PromotionReviewDoc = {
    id,
    orderId,
    accountId,
    buyerPhoneMasked,
    buyerPhoneNormalized,
    reasons: [reason || "customer_requested_review"],
    state: "pending",
    decisionVersion: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await col.insertOne(doc as any);
  return { ok: true, reviewId: id };
}

/**
 * Admin duyệt hoặc từ chối yêu cầu xem xét (mục 9, AB06, AB32).
 * Kiểm tra optimistic locking bằng decisionVersion để hai nhân viên không ghi đè quyết định nhau.
 */
export async function decidePromotionReview(
  shopDb: Db,
  args: {
    reviewId: string;
    decision: "approved" | "rejected";
    decisionVersion: number;
    actor: string;
    decisionNote?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const { reviewId, decision, decisionVersion, actor, decisionNote } = args;
  const col = shopDb.collection<PromotionReviewDoc>(PROMOTION_REVIEWS_COL);

  const existing = await col.findOne({ id: reviewId });
  if (!existing) {
    return { ok: false, error: "Không tìm thấy yêu cầu xem xét", code: "not_found" };
  }

  if (existing.decisionVersion !== decisionVersion) {
    return {
      ok: false,
      error: "Yêu cầu đã được thay đổi hoặc xử lý bởi nhân viên khác. Vui lòng tải lại.",
      code: "version_conflict",
    };
  }

  const nowIso = new Date().toISOString();
  const updateRes = await col.updateOne(
    { id: reviewId, decisionVersion },
    {
      $set: {
        state: decision,
        actor,
        decisionNote: decisionNote || "",
        ...(decision === "approved" ? { approvedAt: nowIso } : { rejectedAt: nowIso }),
        updatedAt: nowIso,
      },
      $inc: { decisionVersion: 1 },
    }
  );

  if (updateRes.matchedCount === 0) {
    return {
      ok: false,
      error: "Xung đột phiên bản quyết định. Vui lòng tải lại.",
      code: "version_conflict",
    };
  }

  return { ok: true };
}
