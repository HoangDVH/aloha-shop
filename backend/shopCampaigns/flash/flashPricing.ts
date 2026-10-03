import type { ShopOrderDetail } from "../../shopOrders/models.js";
import { limitOf } from "./flashOffers.js";
import { FLASH_MESSAGES, type FlashOffer } from "./flashTypes.js";

export type FlashPricingResult = {
  details: ShopOrderDetail[];
  notices: string[];
  /** Tổng tiền khách được giảm nhờ giá sale (giá thường − giá sale) × số lượng. */
  flashSavings: number;
};

/**
 * Tách dòng: phần trong suất và trong giới hạn mỗi khách lấy giá sale, phần vượt giữ giá thường
 * (không từ chối cả đơn). Giá sale chỉ áp khi thấp hơn giá thường hiện tại — giá thường đã rẻ hơn
 * thì khách trả giá thường và không hiện "giảm giá".
 */
export function applyFlashOffers(details: ShopOrderDetail[], offers: Map<string, FlashOffer>): FlashPricingResult {
  const left = new Map([...offers].map(([ma, o]) => [ma, { stock: o.remaining, mine: o.customerRemaining }]));
  const out: ShopOrderDetail[] = [];
  const notices: string[] = [];
  let flashSavings = 0;
  for (const d of details) {
    const offer = offers.get(d.productCode);
    const budget = left.get(d.productCode);
    if (d.isGift || !offer || !budget || !(offer.salePrice < d.price)) {
      out.push(d);
      continue;
    }
    const qty = Math.max(0, Math.min(d.quantity, budget.stock, budget.mine));
    budget.stock -= qty;
    budget.mine -= qty;
    if (qty > 0) {
      out.push({
        ...d,
        quantity: qty,
        price: offer.salePrice,
        flash: { campaignId: offer.campaignId, counterId: offer.counterId, listPrice: d.price, salePrice: offer.salePrice },
      });
      flashSavings += (d.price - offer.salePrice) * qty;
    }
    const rest = d.quantity - qty;
    if (rest > 0) {
      out.push({ ...d, quantity: rest, flash: undefined });
      const name = d.productName || d.productCode;
      if (qty > 0) notices.push(FLASH_MESSAGES.partial(name, qty));
      else if (budget.stock > 0) notices.push(FLASH_MESSAGES.limitReached(name, limitOf(offer.perCustomerLimit)));
      else notices.push(FLASH_MESSAGES.soldOut);
    }
  }
  return { details: out, notices: [...new Set(notices)], flashSavings };
}

/** Tổng giảm nhờ giá sale của các dòng đã tính (dùng lại cho đơn đã lưu). */
export function flashSavingsOf(details: ShopOrderDetail[]): number {
  return details.reduce((n, d) => (d.flash ? n + Math.max(0, d.flash.listPrice - d.price) * d.quantity : n), 0);
}
