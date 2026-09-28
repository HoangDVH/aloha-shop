"use client";

import { useState } from "react";
import {
  Ticket,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Tag,
  ArrowRight,
} from "lucide-react";
import { formatVnd } from "@/lib/api";

export interface EvaluatedCandidateUI {
  promotionId: string;
  title: string;
  type: "auto" | "code";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ">" | ">=";
  eligible: boolean;
  ineligibleReason?: string;
  calculatedDiscount: number;
  code?: string;
  isPublic?: boolean;
}

export interface PromotionQuoteUI {
  applied?: {
    promotionId: string;
    title: string;
    type: "auto" | "code";
    code?: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    discountAmount: number;
  };
  lineDiscounts: Record<string, number>;
  subtotal: number;
  discountTotal: number;
  finalTotal: number;
  candidates: EvaluatedCandidateUI[];
}

type Props = {
  open: boolean;
  onClose: () => void;
  quote?: PromotionQuoteUI | null;
  loading?: boolean;
  selectedCode: string;
  autoMode: boolean;
  onApplyCode: (code: string) => void;
  onSelectAutoMode: () => void;
  onRemoveDiscount: () => void;
};

export function PromotionModal({
  open,
  onClose,
  quote,
  loading = false,
  selectedCode,
  autoMode,
  onApplyCode,
  onSelectAutoMode,
  onRemoveDiscount,
}: Props) {
  const [inputCode, setInputCode] = useState(selectedCode || "");
  const [submittingCode, setSubmittingCode] = useState(false);

  if (!open) return null;

  const applied = quote?.applied;
  const candidates = quote?.candidates || [];
  const eligibleCandidates = candidates.filter((c) => c.eligible);
  const ineligibleCandidates = candidates.filter((c) => !c.eligible);

  const handleApplyInput = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;
    setSubmittingCode(true);
    onApplyCode(clean);
    setTimeout(() => setSubmittingCode(false), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 animate-fade-in backdrop-blur-xs">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
              <Ticket size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--aloha-ink)]">
                Ưu đãi & Mã giảm giá
              </h2>
              <p className="text-xs text-slate-500">
                Tự động áp dụng mức giảm tốt nhất cho đơn hàng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Ô nhập mã giảm giá */}
          <form onSubmit={handleApplyInput} className="flex gap-2">
            <div className="relative flex-1">
              <Tag
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã ưu đãi / voucher"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold uppercase tracking-wider text-[var(--aloha-ink)] placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-[var(--aloha-green)] focus:outline-none focus:ring-2 focus:ring-[var(--aloha-green)]/20"
              />
            </div>
            <button
              type="submit"
              disabled={!inputCode.trim() || submittingCode}
              className="rounded-xl bg-[var(--aloha-green)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--aloha-green-hover)] disabled:bg-slate-200 disabled:text-slate-400"
            >
              {submittingCode ? "Đang kiểm tra..." : "Áp dụng"}
            </button>
          </form>

          {/* Lựa chọn Tự động tốt nhất */}
          <div
            onClick={onSelectAutoMode}
            className={`flex cursor-pointer items-center justify-between rounded-xl p-3.5 border transition ${
              autoMode
                ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)]/40 ring-1 ring-[var(--aloha-green)]"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                  autoMode
                    ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {autoMode ? <Check size={14} /> : null}
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--aloha-ink)] flex items-center gap-1.5">
                  <Sparkles size={15} className="text-amber-500" />
                  Tự động chọn ưu đãi tốt nhất
                </p>
                <p className="text-xs text-slate-500">
                  Hệ thống tự tính và trừ khoản giảm lớn nhất hợp lệ
                </p>
              </div>
            </div>
          </div>

          {/* Đang áp dụng */}
          {applied ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                    Đang áp dụng
                  </span>
                  <p className="mt-1 text-sm font-bold text-emerald-950">
                    {applied.title}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Tiết kiệm được:{" "}
                    <strong className="text-sm font-black text-[var(--aloha-price)]">
                      {formatVnd(applied.discountAmount)}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRemoveDiscount}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:underline"
                >
                  Bỏ ưu đãi
                </button>
              </div>
            </div>
          ) : null}

          {/* Danh sách ưu đãi khả dụng */}
          {eligibleCandidates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ưu đãi đủ điều kiện ({eligibleCandidates.length})
              </p>
              <div className="space-y-2">
                {eligibleCandidates.map((cand) => {
                  const isCurrent = applied?.promotionId === cand.promotionId;
                  return (
                    <div
                      key={cand.promotionId}
                      className={`relative rounded-xl border p-3.5 transition ${
                        isCurrent
                          ? "border-[var(--aloha-green)] bg-white ring-1 ring-[var(--aloha-green)]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[var(--aloha-ink)]">
                            {cand.title}
                          </p>
                          <p className="text-xs font-semibold text-[var(--aloha-price)]">
                            Giảm {formatVnd(cand.calculatedDiscount)}
                          </p>
                          {cand.minOrderThreshold ? (
                            <p className="text-[11px] text-slate-500">
                              Đơn {cand.thresholdOperator === ">=" ? "từ" : "trên"}{" "}
                              {formatVnd(cand.minOrderThreshold)}
                            </p>
                          ) : null}
                        </div>
                        {isCurrent ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                            <Check size={12} /> Đang chọn
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (cand.code) {
                                onApplyCode(cand.code);
                              } else {
                                onSelectAutoMode();
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--aloha-green)] px-3 py-1.5 text-xs font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                          >
                            Áp dụng <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Danh sách ưu đãi chưa đủ điều kiện */}
          {ineligibleCandidates.length > 0 ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ưu đãi chưa đủ điều kiện
              </p>
              <div className="space-y-2 opacity-80">
                {ineligibleCandidates.map((cand) => (
                  <div
                    key={cand.promotionId}
                    className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3"
                  >
                    <p className="text-sm font-medium text-slate-700">
                      {cand.title}
                    </p>
                    {cand.ineligibleReason ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        {cand.ineligibleReason}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!candidates.length && !loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Hiện chưa có chương trình ưu đãi nào phù hợp với giỏ hàng.
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <div>
            <span className="text-xs text-slate-500">Đã giảm:</span>
            <p className="text-base font-extrabold text-[var(--aloha-price)] tabular-nums">
              {formatVnd(quote?.discountTotal || 0)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--aloha-green)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
