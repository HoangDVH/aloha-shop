import type { Db } from "mongodb";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  PROMOTION_REDEMPTIONS_COL,
  type PromotionRedemptionDoc,
} from "./types.js";

function newRedemptionId(): string {
  return `red_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    idempotencyKey,
    ttlMinutes = 60,
  } = args;

  if (discountAmount <= 0) {
    return { ok: true, redemptionId: "" };
  }

  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const promoCol = shopDb.collection(PROMOTIONS_COL);
  const codeCol = shopDb.collection(PROMOTION_CODES_COL);

  // Kiểm tra idempotency nếu đã từng hold cho orderCode này
  const existing = await redCol.findOne({
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

  // Cập nhật tăng heldCount & budgetHeld có điều kiện
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  // Atomically update promo held counts
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
    return {
      ok: false,
      error: "Ưu đãi đã hết lượt hoặc hết ngân sách khả dụng",
    };
  }

  // Nếu có code, tăng heldCount của code
  if (promotionCode) {
    const cleanCode = promotionCode.trim().toUpperCase();
    await codeCol.updateOne(
      { code: cleanCode },
      {
        $inc: { heldCount: 1 },
      }
    );
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

export async function markRedemptionUsed(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean }> {
  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const promoCol = shopDb.collection(PROMOTIONS_COL);
  const codeCol = shopDb.collection(PROMOTION_CODES_COL);

  const redemption = await redCol.findOne({ orderCode, status: "held" });
  if (!redemption) return { ok: false };

  const nowIso = new Date().toISOString();
  await redCol.updateOne(
    { _id: redemption._id },
    {
      $set: {
        status: "used",
        updatedAt: nowIso,
      },
    }
  );

  const discount = Number(redemption.discountAmount) || 0;
  await promoCol.updateOne(
    { id: redemption.promotionId },
    {
      $inc: {
        heldCount: -1,
        usedCount: 1,
        budgetHeld: -discount,
        budgetUsed: discount,
      },
      $set: {
        updatedAt: nowIso,
      },
    }
  );

  if (redemption.promotionCode) {
    await codeCol.updateOne(
      { code: redemption.promotionCode },
      {
        $inc: {
          heldCount: -1,
          usedCount: 1,
        },
      }
    );
  }

  return { ok: true };
}

export async function releasePromotionHold(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean }> {
  const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
  const promoCol = shopDb.collection(PROMOTIONS_COL);
  const codeCol = shopDb.collection(PROMOTION_CODES_COL);

  const redemption = await redCol.findOne({ orderCode, status: "held" });
  if (!redemption) return { ok: false };

  const nowIso = new Date().toISOString();
  await redCol.updateOne(
    { _id: redemption._id },
    {
      $set: {
        status: "released",
        updatedAt: nowIso,
      },
    }
  );

  const discount = Number(redemption.discountAmount) || 0;
  await promoCol.updateOne(
    { id: redemption.promotionId },
    {
      $inc: {
        heldCount: -1,
        budgetHeld: -discount,
      },
      $set: {
        updatedAt: nowIso,
      },
    }
  );

  if (redemption.promotionCode) {
    await codeCol.updateOne(
      { code: redemption.promotionCode },
      {
        $inc: {
          heldCount: -1,
        },
      }
    );
  }

  return { ok: true };
}
