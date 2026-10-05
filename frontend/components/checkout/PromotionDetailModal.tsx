"use client";

import { X, AlertCircle } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { pctText } from "@/lib/voucherFormat";
import dayjs from "dayjs";
import type { EvaluatedCandidateUI } from "./PromotionModal";

type Props = {
  cand: EvaluatedCandidateUI | null;
  onClose: () => void;
};

export function PromotionDetailModal({ cand, onClose }: Props) {
  if (!cand) return null;

  const formatHsd = (dateStr?: string) => {
    if (!dateStr) return "31.12.2026";
    return dayjs(dateStr).format("DD.MM.YYYY");
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3 border border-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Chi tiết điều kiện ưu đãi
            </span>
            <h3 className="text-sm font-bold text-slate-800 mt-1">
              {cand.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Hình thức:</span>
            <span className="font-semibold text-slate-800">
              {cand.benefitType === "shipping"
                ? "Hỗ trợ phí vận chuyển (Tự động áp dụng)"
                : cand.type === "code"
                ? "Mã giảm giá (Coupon)"
                : "Tự động áp dụng"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Mức giảm:</span>
            <span className="font-bold text-red-600">
              {cand.benefitType === "shipping"
                ? `Giảm ${formatVnd(cand.discountValue)} phí ship`
                : cand.discountType === "percentage"
                ? `${pctText(cand)} ${cand.maxDiscountVnd ? `(tối đa ${formatVnd(cand.maxDiscountVnd)})` : ""}`
                : formatVnd(cand.discountValue)}
            </span>
          </div>

          {cand.mystery && !cand.mystery.drawnPercent ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400 shrink-0">Tỉ lệ túi mù:</span>
              <span className="text-right font-medium text-slate-700">
                {cand.mystery.tiers.map((t) => `${t.percent}%: ${t.chance}%`).join(" · ")}
              </span>
            </div>
          ) : null}

          <div className="flex justify-between">
            <span className="text-slate-400">Đơn tối thiểu:</span>
            <span className="font-semibold text-slate-800">
              {cand.minOrderThreshold
                ? `${cand.thresholdOperator === ">=" ? "Từ" : "Trên"} ${formatVnd(cand.minOrderThreshold)}`
                : "Không giới hạn"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Phạm vi áp dụng:</span>
            <span className="font-semibold text-slate-800">
              {cand.scope === "product" ? "Sản phẩm chỉ định" : "Toàn bộ cửa hàng"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Hạn sử dụng:</span>
            <span className="font-semibold text-slate-800">
              {formatHsd(cand.endDate)}
            </span>
          </div>

          {cand.description ? (
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
              {cand.description}
            </div>
          ) : null}

          {cand.ineligibleReason ? (
            <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 font-medium flex items-start gap-1.5 mt-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{cand.ineligibleReason}</span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
