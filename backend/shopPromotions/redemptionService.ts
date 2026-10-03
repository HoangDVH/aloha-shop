import type { Db } from "mongodb";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  PROMOTION_CUSTOMER_USAGE_COL,
  PROMOTION_REDEMPTIONS_COL,
  type PromotionBenefitType,
  type PromotionRedemptionDoc,
} from "./types.js";
import { customerUsageId } from "./checkoutPromotions.js";
import {
  consumeFirstPurchaseClaims,
  releaseFirstPurchaseClaims,
} from "./claimService.js";
import { releaseWalletForOrder, renameWalletOrderCode, useWalletForOrder } from "./wallet/walletService.js";
import { reclaimAfterLatePayment, settleCampaignHolds } from "../shopCampaigns/orderCampaign.js";

function newRedemptionId(): string {
  return `red_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Giữ 1 lượt của khách: upsert có điều kiện `count < limit`.
 * Doc đã đủ lượt thì filter không khớp → upsert chèn trùng _id → E11000 = hết lượt.
 * Hai request cùng tạo doc lần đầu cũng có thể E11000 nên thử lại một lần.
 */
async function reserveCustomerUsage(
  shopDb: Db,
  promotionId: string,
  customerKey: string,
  limit: number
): Promise<boolean> {
  const col = shopDb.collection<any>(PROMOTION_CUSTOMER_USAGE_COL);
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await col.updateOne(
        { _id: customerUsageId(promotionId, customerKey), count: { $lt: limit } },
        {
          $inc: { count: 1 },
          $set: { updatedAt: nowIso },
          $setOnInsert: { promotionId, customerKey, createdAt: nowIso },
        },
        { upsert: true }
      );
      return true;
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
    }
  }
  return false;
}

async function returnCustomerUsage(shopDb: Db, promotionId: string, customerKey: string) {
  await shopDb
    .collection<any>(PROMOTION_CUSTOMER_USAGE_COL)
    .updateOne(
      { _id: customerUsageId(promotionId, customerKey), count: { $gt: 0 } },
      { $inc: { count: -1 }, $set: { updatedAt: new Date().toISOString() } }
    );
}

export async function holdPromotion(
  shopDb: Db,
  args: {
    orderCode: string;
    promotionId: string;
    promotionCode?: string;
    discountAmount: number;
    buyerId?: string;
    buyerPhone?: string;
    buyerEmail?: string;
    customerKey?: string;
    benefitType?: PromotionBenefitType;
    idempotencyKey?: string;
    ttlMinutes?: number;
  }
): Promise<{ ok: true; redemptionId: string } | { ok: false; error: string }> {
  const {
    orderCode,
    promotionId,
    promotionCode,
    discountAmount,
    buyerId,
    buyerPhone,
    buyerEmail,
    customerKey,
    benefitType,
    idempotencyKey,
    ttlMinutes = 60,
  } = args;

  if (discountAmount <= 0) {
    return { ok: true, redemptionId: "" };
  }

  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const promoCol = shopDb.collection(PROMOTIONS_COL);
  const codeCol = shopDb.collection(PROMOTION_CODES_COL);

  // Một đơn có thể giữ cả ưu đãi tiền hàng và voucher ship → idempotency theo từng chương trình
  const existing = await redCol.findOne({
    promotionId,
    $or: [
      { orderCode },
      ...(idempotencyKey ? [{ idempotencyKey }] : []),
    ],
  });

  if (existing) {
    if (existing.status === "held" || existing.status === "used") {
      return { ok: true, redemptionId: String(existing.id || existing._id) };
    }
  }

  const promo = await promoCol.findOne({ id: promotionId }, { projection: { usageLimitPerCustomer: 1 } });
  const perCustomerLimit = Math.max(0, Number(promo?.usageLimitPerCustomer) || 0);
  let usageKey: string | undefined;
  if (perCustomerLimit > 0) {
    if (!customerKey) {
      return { ok: false, error: "Cần đăng nhập để dùng ưu đãi này" };
    }
    const reserved = await reserveCustomerUsage(shopDb, promotionId, customerKey, perCustomerLimit);
    if (!reserved) {
      return { ok: false, error: "Bạn đã dùng hết lượt của ưu đãi này" };
    }
    usageKey = customerKey;
  }

  // Cập nhật tăng heldCount & budgetHeld có điều kiện
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  // Atomically update promo held counts & budget
  const promoUpdateRes = await promoCol.updateOne(
    {
      id: promotionId,
      status: "active",
      // Không vượt tổng lượt (nếu có giới hạn)
      $and: [
        {
          $or: [
            { usageLimitTotal: { $exists: false } },
            { usageLimitTotal: null },
            { $expr: { $lt: [{ $add: ["$usedCount", "$heldCount"] }, "$usageLimitTotal"] } },
          ],
        },
        {
          $or: [
            { budgetTotal: { $exists: false } },
            { budgetTotal: null },
            {
              $expr: {
                $lte: [
                  { $add: ["$budgetUsed", "$budgetHeld", discountAmount] },
                  "$budgetTotal",
                ],
              },
            },
          ],
        },
      ],
    } as any,
    {
      $inc: {
        heldCount: 1,
        budgetHeld: discountAmount,
      },
      $set: {
        updatedAt: now.toISOString(),
      },
    }
  );

  if (promoUpdateRes.matchedCount === 0) {
    if (usageKey) await returnCustomerUsage(shopDb, promotionId, usageKey);
    return {
      ok: false,
      error: "Ưu đãi đã hết lượt hoặc hết ngân sách khả dụng",
    };
  }

  // Nếu có code, kiểm tra và tăng heldCount của code có điều kiện (mục 7 & AB16)
  if (promotionCode) {
    const cleanCode = promotionCode.trim().toUpperCase();
    const codeUpdateRes = await codeCol.updateOne(
      {
        code: cleanCode,
        active: { $ne: false },
        $or: [
          { maxUses: { $exists: false } },
          { maxUses: null },
          { $expr: { $lt: [{ $add: ["$usedCount", "$heldCount"] }, "$maxUses"] } },
        ],
      },
      {
        $inc: { heldCount: 1 },
      }
    );

    if (codeUpdateRes.matchedCount === 0) {
      // Rollback promo update
      await promoCol.updateOne(
        { id: promotionId },
        {
          $inc: { heldCount: -1, budgetHeld: -discountAmount },
          $set: { updatedAt: now.toISOString() },
        }
      );
      if (usageKey) await returnCustomerUsage(shopDb, promotionId, usageKey);
      return {
        ok: false,
        error: "Mã giảm giá đã hết lượt sử dụng",
      };
    }
  }

  const redemptionId = newRedemptionId();
  const redemptionDoc: PromotionRedemptionDoc = {
    id: redemptionId,
    orderCode,
    promotionId,
    promotionCode: promotionCode ? promotionCode.trim().toUpperCase() : undefined,
    buyerPhone,
    buyerEmail,
    buyerId,
    customerKey: usageKey,
    benefitType,
    discountAmount,
    status: "held",
    idempotencyKey,
    expiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await redCol.insertOne(redemptionDoc as any);
  return { ok: true, redemptionId };
}

/** Chuyển held → status; chỉ lần chuyển thành công mới cập nhật counters (gọi lặp không trừ hai lần). */
async function transitionHeldRedemptions(
  shopDb: Db,
  orderCode: string,
  status: "used" | "released"
): Promise<number> {
  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const promoCol = shopDb.collection(PROMOTIONS_COL);
  const codeCol = shopDb.collection(PROMOTION_CODES_COL);

  const held = await redCol.find({ orderCode, status: "held" }).toArray();
  let changed = 0;
  for (const redemption of held) {
    const nowIso = new Date().toISOString();
    const r = await redCol.updateOne(
      { _id: redemption._id, status: "held" },
      { $set: { status, updatedAt: nowIso } }
    );
    if (r.modifiedCount !== 1) continue;
    changed++;

    const discount = Number(redemption.discountAmount) || 0;
    await promoCol.updateOne(
      { id: redemption.promotionId },
      {
        $inc:
          status === "used"
            ? { heldCount: -1, usedCount: 1, budgetHeld: -discount, budgetUsed: discount }
            : { heldCount: -1, budgetHeld: -discount },
        $set: { updatedAt: nowIso },
      }
    );

    if (redemption.promotionCode) {
      await codeCol.updateOne(
        { code: redemption.promotionCode },
        { $inc: status === "used" ? { heldCount: -1, usedCount: 1 } : { heldCount: -1 } }
      );
    }

    if (status === "released" && redemption.customerKey) {
      await returnCustomerUsage(shopDb, String(redemption.promotionId), String(redemption.customerKey));
    }
  }

  // Đồng bộ với bảng claims quyền khách mới (mục 6) và ví voucher
  if (status === "used") {
    await consumeFirstPurchaseClaims(shopDb, orderCode).catch(() => 0);
    await useWalletForOrder(shopDb, orderCode).catch(() => 0);
    const sold = await settleCampaignHolds(shopDb, orderCode, "sold").catch(() => false);
    if (!sold) await reclaimAfterLatePayment(shopDb, orderCode).catch(() => "skip");
  } else if (status === "released") {
    await releaseFirstPurchaseClaims(shopDb, orderCode).catch(() => 0);
    await releaseWalletForOrder(shopDb, orderCode).catch(() => 0);
    await settleCampaignHolds(shopDb, orderCode, "released").catch(() => false);
  }

  return changed;
}

export async function markRedemptionUsed(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean }> {
  return { ok: (await transitionHeldRedemptions(shopDb, orderCode, "used")) > 0 };
}

export async function releasePromotionHold(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean }> {
  return { ok: (await transitionHeldRedemptions(shopDb, orderCode, "released")) > 0 };
}

/** Đơn đổi mã sang mã KiotViet sau khi giữ lượt → lượt phải đi theo mã mới để thanh toán/hủy tìm thấy. */
export async function renameRedemptionOrderCode(
  shopDb: Db,
  fromCode: string,
  toCode: string
): Promise<void> {
  if (!fromCode || !toCode || fromCode === toCode) return;
  await shopDb
    .collection(PROMOTION_REDEMPTIONS_COL)
    .updateMany({ orderCode: fromCode }, { $set: { orderCode: toCode, updatedAt: new Date().toISOString() } });
  await renameWalletOrderCode(shopDb, fromCode, toCode);
}

/**
 * Worker claim từng batch bằng ID chính xác, xử lý đủ danh sách không bỏ sót (mục 6.3 & AB21).
 */
export async function expirePendingPromotionHolds(
  shopDb: Db,
  batchSize = 100
): Promise<{ expiredCount: number }> {
  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const nowIso = new Date().toISOString();
  let totalExpired = 0;

  while (true) {
    const candidates = await redCol
      .find({ status: "held", expiresAt: { $lte: nowIso } })
      .limit(batchSize)
      .toArray();

    if (!candidates.length) break;

    const orderCodes = [...new Set(candidates.map((c) => String(c.orderCode)).filter(Boolean))];
    for (const code of orderCodes) {
      const changed = await transitionHeldRedemptions(shopDb, code, "released");
      if (changed > 0) {
        totalExpired += changed;
      }
    }

    if (candidates.length < batchSize) break;
  }

  return { expiredCount: totalExpired };
}
