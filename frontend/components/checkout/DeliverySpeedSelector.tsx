"use client";

import React from "react";
import { Sparkles, Check } from "lucide-react";
import { formatCompactVnd } from "@/lib/voucherFormat";
import type { PromotionQuoteUI } from "@/components/checkout/PromotionModal";

export type DeliverySpeed = "standard" | "delayed_3d";

interface Props {
  value: DeliverySpeed;
  onChange: (speed: DeliverySpeed) => void;
  quote?: PromotionQuoteUI | null;
  loading?: boolean;
}

export function DeliverySpeedSelector({ value, onChange, quote, loading }: Props) {
  // Tìm voucher có yêu cầu đặt trước / chờ giao hàng (minLeadDays >= 3)
  const delayedCandidate = quote?.candidates?.find(
    (c) => (c.minLeadDays ?? 0) >= 3
  );
  const appliedDelayed =
    quote?.applied && ((quote.applied as any).minLeadDays ?? 0) >= 3
      ? (quote.applied as any)
      : null;

  const voucher = delayedCandidate || appliedDelayed;

  // Nếu không có voucher nào yêu cầu đặt trước trong hệ thống, không hiển thị
  if (!voucher && value !== "delayed_3d") {
    return null;
  }

  // Mức giảm hiển thị rõ ràng (ví dụ: "10%" hoặc "50k")
  const discountStr = voucher?.discountType === "percentage"
    ? `${voucher.discountValue}%`
    : voucher?.discountValue
    ? formatCompactVnd(voucher.discountValue)
    : "10%";

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl gap-1 text-[12px] sm:text-[13px] select-none border border-slate-200/60 shadow-inner">
        {/* Lựa chọn 1: Giao tiêu chuẩn */}
        <button
          type="button"
          onClick={() => onChange("standard")}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
            value === "standard"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/90 font-bold"
              : "text-slate-600 hover:text-slate-900 font-medium"
          }`}
        >
          <span className="leading-tight">Giao tiêu chuẩn</span>
          <span className="text-[11px] font-normal text-slate-500 leading-tight">1 - 2 ngày</span>
        </button>

        {/* Lựa chọn 2: Đặt trước 3 ngày */}
        <button
          type="button"
          onClick={() => onChange("delayed_3d")}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
            value === "delayed_3d"
              ? "bg-white text-emerald-800 shadow-xs border border-emerald-500 ring-1 ring-emerald-500/20 font-bold"
              : "text-slate-600 hover:text-slate-900 font-medium"
          }`}
        >
          <span className={`leading-tight ${value === "delayed_3d" ? "text-emerald-950 font-bold" : "text-slate-800 font-semibold"}`}>
            Đặt trước 3 ngày
          </span>
          <span className={`text-[11px] leading-tight ${value === "delayed_3d" ? "text-emerald-700 font-bold" : "text-emerald-600 font-semibold"}`}>
            Giảm {discountStr}
          </span>
        </button>
      </div>

      {/* Dòng giải thích cơ chế giảm giá để khách hiểu rõ điều kiện được trừ tiền */}
      <div className="px-1 text-[11px] leading-tight">
        {value === "delayed_3d" ? (
          <p className="text-emerald-700 font-medium flex items-center gap-1.5">
            <Check size={13} className="shrink-0 stroke-[2.5]" />
            <span>Đã áp dụng giảm {discountStr} khi đồng ý nhận hàng sau 3 ngày</span>
          </p>
        ) : (
          <p className="text-slate-500 flex items-center gap-1.5">
            <Sparkles size={13} className="shrink-0 text-amber-500" />
            <span>Chọn &ldquo;Đặt trước 3 ngày&rdquo; để nhận hàng sau 3 ngày và được giảm {discountStr}</span>
          </p>
        )}
      </div>
    </div>
  );
}
