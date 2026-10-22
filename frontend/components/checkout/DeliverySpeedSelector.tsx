"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { formatAppliedVoucherTitle, formatCompactVnd } from "@/lib/voucherFormat";
import type { EvaluatedCandidateUI, PromotionQuoteUI } from "@/components/checkout/PromotionModal";

export type DeliverySpeed = "standard" | "delayed_3d";

interface Props {
  value: DeliverySpeed;
  onChange: (speed: DeliverySpeed) => void;
  quote?: PromotionQuoteUI | null;
  loading?: boolean;
}

export function DeliverySpeedSelector({ value, onChange, quote, loading }: Props) {
  // Tìm voucher có yêu cầu chờ giao hàng (minLeadDays >= 3)
  const delayedCandidate = quote?.candidates?.find(
    (c) => (c.minLeadDays ?? 0) >= 3
  );
  const appliedDelayed =
    quote?.applied && ((quote.applied as any).minLeadDays ?? 0) >= 3
      ? (quote.applied as any)
      : null;

  const voucher = delayedCandidate || appliedDelayed;

  // Nếu không có voucher nào yêu cầu chờ giao hàng trong hệ thống, không hiển thị
  if (!voucher && value !== "delayed_3d") {
    return null;
  }

  // Mức giảm hiển thị súc tích trên tab (ví dụ: "-10%" hoặc "-50k")
  const discountLabel = voucher?.discountType === "percentage"
    ? `-${voucher.discountValue}%`
    : voucher?.discountValue
    ? `-${formatCompactVnd(voucher.discountValue)}`
    : "-Ưu đãi";

  const voucherTitle = voucher
    ? formatAppliedVoucherTitle(voucher, voucher.title || "Ưu đãi đặt trước")
    : "Voucher ưu đãi";

  return (
    <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl gap-1 text-[12px] sm:text-[13px] select-none border border-slate-200/60 shadow-inner">
      {/* Lựa chọn 1: Giao tiêu chuẩn */}
      <button
        type="button"
        onClick={() => onChange("standard")}
        className={`flex items-center justify-center py-2 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
          value === "standard"
            ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <span>Giao tiêu chuẩn (1-2 ngày)</span>
      </button>

      {/* Lựa chọn 2: Chờ sau 3 ngày */}
      <button
        type="button"
        onClick={() => onChange("delayed_3d")}
        className={`flex items-center justify-center py-2 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
          value === "delayed_3d"
            ? "bg-white text-emerald-700 shadow-sm border border-emerald-400 ring-1 ring-emerald-400/20"
            : "text-emerald-700 hover:text-emerald-800"
        }`}
      >
        <span>Chờ 3 ngày ({discountLabel} 🎁)</span>
      </button>
    </div>
  );
}
