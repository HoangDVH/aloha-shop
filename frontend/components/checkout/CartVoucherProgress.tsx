"use client";

import { CheckCircle2, Ticket } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { cartVoucherGoal } from "@/lib/campaign/cartGoal";
import type { PromotionQuoteUI } from "./PromotionModal";

/** Thanh tiến độ tới mốc voucher kế tiếp; có `onClaim` thì hiện nút "Lưu" cho voucher chưa lưu. */
export function CartVoucherProgress({
  quote,
  onClaim,
}: {
  quote: PromotionQuoteUI | null;
  onClaim?: (promotionId: string) => void;
}) {
  const goal = cartVoucherGoal(quote);
  if (!goal) return null;

  if (goal.kind === "reached") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700" role="status">
        <CheckCircle2 size={16} aria-hidden />
        <span className="min-w-0 truncate">Đã đủ điều kiện · {goal.label}</span>
      </div>
    );
  }

  if (goal.kind === "claim") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[#FFF3E6] px-3 py-2 text-sm text-slate-700">
        <Ticket size={16} aria-hidden className="shrink-0 text-[#C8102E]" />
        <span className="min-w-0 flex-1">Lưu mã để dùng {goal.label}</span>
        {onClaim ? (
          <button
            type="button"
            onClick={() => onClaim(goal.promotionId)}
            className="min-h-[36px] shrink-0 rounded-full bg-[#C8102E] px-4 text-xs font-bold text-white"
          >
            Lưu
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#FFF3E6] px-3 py-2.5" role="status">
      <p className="text-sm text-slate-700">
        Mua thêm <strong className="text-[#C8102E]">{formatVnd(goal.shortfall)}</strong> để dùng {goal.label}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-orange-100" aria-hidden>
        <div className="h-full rounded-full bg-[#C8102E] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${goal.pct}%` }} />
      </div>
    </div>
  );
}
