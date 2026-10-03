import type { StepFail } from "./stepResult.js";
import type { Db } from "mongodb";
import { holdPromotion, releasePromotionHold } from "../../shopPromotions/redemptionService.js";
import {
  holdFirstPurchaseClaims,
  releaseFirstPurchaseClaims,
} from "../../shopPromotions/claimService.js";
import { WALLET_MESSAGES, holdWalletVouchers } from "../../shopPromotions/wallet/walletService.js";

type HoldInput = {
  orderCode: string;
  accountId: string;
  buyerPhone: string;
  buyerEmail: string;
  customerKey: string;
  idempotencyKey: string;
  isNewWebPromo: boolean;
  goods: { promotionId: string; code?: string; discount: number } | null;
  shipping: { promotionId: string; discount: number } | null;
};

export type HoldResult = { ok: true } | StepFail;

/** Giữ lượt claim khách mới, voucher hàng rồi voucher ship; lỗi ở bước nào thì trả lại các bước trước. */
export async function holdOrderPromotions(shopDb: Db, input: HoldInput): Promise<HoldResult> {
  const { orderCode, isNewWebPromo } = input;
  if (isNewWebPromo) {
    const claimHold = await holdFirstPurchaseClaims(shopDb, {
      orderCode,
      accountId: input.accountId,
      buyerPhone: input.buyerPhone,
      ttlMinutes: 60,
    });
    if (!claimHold.ok) {
      return {
        ok: false,
        status: 400,
        body: {
          error: claimHold.error || "Bạn không đủ điều kiện áp dụng ưu đãi khách mới",
          code: claimHold.code || "claim_conflict",
        },
      };
    }
  }
  const buyer = {
    buyerId: input.accountId,
    buyerPhone: input.buyerPhone,
    buyerEmail: input.buyerEmail,
    customerKey: input.customerKey,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.goods && input.goods.discount > 0) {
    const holdRes = await holdPromotion(shopDb, {
      orderCode,
      promotionId: input.goods.promotionId,
      promotionCode: input.goods.code,
      discountAmount: input.goods.discount,
      benefitType: "goods",
      ...buyer,
    });
    if (!holdRes.ok) {
      if (isNewWebPromo) await releaseFirstPurchaseClaims(shopDb, orderCode).catch(() => undefined);
      return {
        ok: false,
        status: 400,
        body: { error: (holdRes as any).error || "Ưu đãi không còn khả dụng" },
      };
    }
  }
  if (input.shipping && input.shipping.discount > 0) {
    const shipHold = await holdPromotion(shopDb, {
      orderCode,
      promotionId: input.shipping.promotionId,
      discountAmount: input.shipping.discount,
      benefitType: "shipping",
      ...buyer,
    });
    if (!shipHold.ok) {
      // Thất bại giữ ship: rollback toàn bộ giao dịch, giải phóng giảm hàng và claim (mục 6.2, 7, AB18)
      await releasePromotionHold(shopDb, orderCode).catch(() => undefined);
      if (isNewWebPromo) await releaseFirstPurchaseClaims(shopDb, orderCode).catch(() => undefined);
      return {
        ok: false,
        status: 409,
        body: {
          code: "quote_stale",
          error: `${(shipHold as any).error || "Hỗ trợ phí ship không còn khả dụng"} — báo giá ship lại`,
        },
      };
    }
  }
  const walletHeld = await holdWalletVouchers(shopDb, {
    accountId: input.accountId,
    orderCode,
    promotionIds: [
      input.goods && input.goods.discount > 0 ? input.goods.promotionId : "",
      input.shipping && input.shipping.discount > 0 ? input.shipping.promotionId : "",
    ],
  });
  if (!walletHeld) {
    await releasePromotionHold(shopDb, orderCode).catch(() => undefined);
    if (isNewWebPromo) await releaseFirstPurchaseClaims(shopDb, orderCode).catch(() => undefined);
    return { ok: false, status: 409, body: { code: "not_claimed", error: WALLET_MESSAGES.usedElsewhere } };
  }
  return { ok: true };
}

/** Trả lại mọi lượt ưu đãi đã giữ cho đơn (khi tạo đơn thất bại sau bước giữ). */
export async function releaseOrderPromotions(
  shopDb: Db,
  orderCode: string,
  isNewWebPromo: boolean
): Promise<void> {
  await releasePromotionHold(shopDb, orderCode).catch(() => undefined);
  if (isNewWebPromo) await releaseFirstPurchaseClaims(shopDb, orderCode).catch(() => undefined);
}
