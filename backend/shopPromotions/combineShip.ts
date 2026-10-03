/**
 * Một đơn dùng tối đa 1 voucher hàng + 1 voucher ship. Voucher hàng có `combineWithShip === false`
 * thì không đi cùng voucher ship: tự chọn → so 2 phương án lấy tổng giảm lớn hơn;
 * khách tự nhập / chọn mã → giữ lựa chọn của khách, bỏ voucher ship kèm lý do.
 */
import type { PromotionDoc, PromotionQuoteResult, ShippingPromotionResult } from "./types.js";
import { isShippingPromotion } from "./evaluator.js";

export const NOT_COMBINABLE_REASON = "Voucher này không dùng chung với hỗ trợ ship";

export type ComboInput = {
  goods: PromotionQuoteResult;
  ship: ShippingPromotionResult | null;
  promotions: PromotionDoc[];
  manualCode: boolean;
  /** Tính lại voucher hàng chỉ với các voucher dùng chung được với ship. */
  reevaluateGoods: (promotions: PromotionDoc[]) => Promise<PromotionQuoteResult>;
};

export type ComboResult = { goods: PromotionQuoteResult; ship: ShippingPromotionResult | null };

export function dropShipApplied(ship: ShippingPromotionResult, reason = NOT_COMBINABLE_REASON): ShippingPromotionResult {
  const appliedId = ship.applied?.promotionId;
  return {
    ...ship,
    applied: undefined,
    candidates: ship.candidates.map((c) =>
      c.promotionId === appliedId ? { ...c, eligible: false, ineligibleReason: reason, calculatedDiscount: 0 } : c
    ),
  };
}

export function combinesWithShip(p: PromotionDoc | undefined): boolean {
  return !p || p.combineWithShip !== false;
}

export async function resolveGoodsShipCombo(input: ComboInput): Promise<ComboResult> {
  const { goods, ship, promotions } = input;
  const goodsPromo = promotions.find((p) => p.id === goods.applied?.promotionId);
  if (!ship?.applied || !goods.applied || combinesWithShip(goodsPromo)) return { goods, ship };
  if (input.manualCode) return { goods, ship: dropShipApplied(ship) };
  const alt = await input.reevaluateGoods(
    promotions.filter((p) => isShippingPromotion(p) || combinesWithShip(p))
  );
  const altTotal = (alt.discountTotal || 0) + ship.applied.discountAmount;
  if (altTotal > (goods.discountTotal || 0)) return { goods: alt, ship };
  return { goods, ship: dropShipApplied(ship) };
}
