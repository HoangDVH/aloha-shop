import type { EvaluatedCandidateUI, PromotionQuoteUI } from "@/components/checkout/PromotionModal";
import { formatCompactVnd } from "@/lib/voucherFormat";

export type CartGoal =
  | { kind: "reached"; label: string }
  | { kind: "short"; shortfall: number; pct: number; label: string }
  | { kind: "claim"; promotionId: string; label: string };

function valueLabel(c: EvaluatedCandidateUI): string {
  return c.discountType === "percentage" ? `${c.discountValue}%` : formatCompactVnd(c.discountValue).toUpperCase();
}

const isGoods = (c: EvaluatedCandidateUI) => c.benefitType !== "shipping";

/**
 * Thanh "Mua thêm Xđ để dùng voucher giảm 30K". Mọi số lấy từ báo giá server (giá server, không tin giá giỏ).
 * Ưu tiên mốc gần nhất có giá trị lớn hơn mã đang áp; không có mốc thì báo đã đủ điều kiện.
 */
export function cartVoucherGoal(quote: PromotionQuoteUI | null | undefined): CartGoal | null {
  if (!quote) return null;
  const applied = quote.applied?.discountAmount || 0;
  const next = quote.candidates
    .filter((c) => isGoods(c) && !c.eligible && (c.shortfall || 0) > 0 && (c.minOrderThreshold || 0) > 0)
    .filter((c) => c.discountType === "percentage" || c.discountValue > applied)
    .sort((a, b) => (a.shortfall as number) - (b.shortfall as number))[0];
  if (next) {
    const threshold = next.minOrderThreshold as number;
    const shortfall = next.shortfall as number;
    const pct = Math.max(4, Math.min(96, Math.round(((threshold - shortfall) / threshold) * 100)));
    return { kind: "short", shortfall, pct, label: `voucher giảm ${valueLabel(next)}` };
  }
  if (quote.applied) return { kind: "reached", label: quote.applied.title };
  const toClaim = quote.candidates.find((c) => isGoods(c) && c.needsClaim);
  if (toClaim) return { kind: "claim", promotionId: toClaim.promotionId, label: `voucher giảm ${valueLabel(toClaim)}` };
  return null;
}
