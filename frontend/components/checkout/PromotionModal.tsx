"use client";

import { useState } from "react";
import {
  Ticket,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Tag,
  Calendar,
  ShoppingCart,
  Percent,
  ChevronRight,
  Package,
  Layers,
  Leaf,
  Info,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import dayjs from "dayjs";

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
  scope?: "all" | "category" | "product";
  targetCustomer?: "all" | "retail" | "wholesale" | "new_web";
  endDate?: string;
  description?: string;
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
  const [filterType, setFilterType] = useState<"all" | "code" | "product">("all");
  const [viewDetailCand, setViewDetailCand] = useState<EvaluatedCandidateUI | null>(null);

  if (!open) return null;

  const applied = quote?.applied;
  const candidates = quote?.candidates || [];

  // Filter according to category pills: "Tất cả" | "Mã giảm giá" | "Ưu đãi sản phẩm"
  const filteredCandidates = candidates.filter((c) => {
    if (filterType === "code") return c.type === "code";
    if (filterType === "product") return c.scope === "product";
    return true;
  });

  const eligibleCandidates = filteredCandidates.filter((c) => c.eligible);
  const ineligibleCandidates = filteredCandidates.filter((c) => !c.eligible);

  const handleApplyInput = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;
    setSubmittingCode(true);
    onApplyCode(clean);
    setTimeout(() => setSubmittingCode(false), 300);
  };

  const formatHsd = (dateStr?: string) => {
    if (!dateStr) return "31.12.2026";
    return dayjs(dateStr).format("DD.MM.YYYY");
  };

  const getStubValue = (c: EvaluatedCandidateUI) => {
    if (c.discountType === "percentage") {
      return `${c.discountValue}%`;
    }
    // Fixed amount in K format (VD: 30000 -> 30K, 100000 -> 100K)
    const val = Number(c.discountValue) || 0;
    if (val >= 1000) {
      return `${Math.round(val / 1000)}K`;
    }
    return formatVnd(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 animate-fade-in backdrop-blur-xs">
      <div
        className="flex max-h-[92vh] w-full max-w-[500px] flex-col rounded-t-[28px] sm:rounded-[28px] bg-[#FAF8F5] shadow-2xl transition-all overflow-hidden border border-emerald-900/10"
        role="dialog"
        aria-modal="true"
      >
        {/* ========================================================================= */}
        {/* 1. HEADER CHUẨN DESIGN: % Icon badge + Title + Decorative Leaf            */}
        {/* ========================================================================= */}
        <div className="relative flex items-center justify-between border-b border-slate-200/60 bg-[#FAF8F5] px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Soft Green Round Badge with Coupon Icon */}
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2E9] text-[#2E5B32] shadow-2xs">
              <div className="flex items-center justify-center border-2 border-dashed border-[#2E5B32]/40 rounded-lg w-7 h-7">
                <Percent size={15} strokeWidth={2.6} />
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">
                Ưu đãi &amp; Mã giảm giá
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Tự động áp dụng mức giảm tốt nhất cho đơn hàng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Decorative leaf top right */}
            <div className="hidden sm:block text-[#4A6B4C]/20 pointer-events-none">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.52-11 4 2 2 4 4 6 1z" />
              </svg>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. BODY CONTENT (SCROLLABLE): Ô nhập mã, Tự động tốt nhất, Danh sách vé   */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 bg-[#FAF8F5]">
          {/* Ô nhập mã ưu đãi / voucher */}
          <form onSubmit={handleApplyInput} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Tag
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã ưu đãi / voucher"
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold uppercase tracking-wider text-slate-800 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#3B653D] focus:outline-none focus:ring-2 focus:ring-[#3B653D]/15 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={!inputCode.trim() || submittingCode}
              className="rounded-xl bg-[#3B653D] hover:bg-[#2E5B32] px-5 py-2.5 text-sm font-bold text-white transition disabled:bg-slate-200 disabled:text-slate-400 shadow-2xs cursor-pointer shrink-0"
            >
              {submittingCode ? "..." : "Áp dụng"}
            </button>
          </form>

          {/* Banner: Tự động chọn ưu đãi tốt nhất (Chuẩn viền xanh và icon lá như ảnh) */}
          <div
            onClick={onSelectAutoMode}
            className={`relative flex cursor-pointer items-center justify-between rounded-2xl p-3.5 border-2 transition shadow-2xs overflow-hidden ${
              autoMode
                ? "border-[#3B653D] bg-white ring-1 ring-[#3B653D]/10"
                : "border-slate-200/80 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full transition shrink-0 ${
                  autoMode
                    ? "bg-[#3B653D] text-white"
                    : "border-2 border-slate-300 bg-white"
                }`}
              >
                {autoMode ? <Check size={14} strokeWidth={3} /> : null}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 leading-tight">
                  <Sparkles size={14} className="text-amber-500" />
                  Tự động chọn ưu đãi tốt nhất
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Hệ thống tự tính và trừ khoản giảm lớn nhất hợp lệ
                </p>
              </div>
            </div>

            {/* Decorative Botanical Leaf */}
            <div className="text-[#3B653D]/30 shrink-0 pl-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.52-11 4 2 2 4 4 6 1z" />
              </svg>
            </div>
          </div>

          {/* Category Filter Pills (Tất cả • Mã giảm giá • Ưu đãi sản phẩm) */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterType === "all"
                  ? "bg-[#E6EFE4] text-[#2E5B32] border border-[#3B653D]/30 shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Leaf size={13} className="text-emerald-700" />
              Tất cả
            </button>

            <button
              type="button"
              onClick={() => setFilterType("code")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterType === "code"
                  ? "bg-[#E6EFE4] text-[#2E5B32] border border-[#3B653D]/30 shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Tag size={13} className="text-purple-600" />
              Mã giảm giá
            </button>

            <button
              type="button"
              onClick={() => setFilterType("product")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterType === "product"
                  ? "bg-[#E6EFE4] text-[#2E5B32] border border-[#3B653D]/30 shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Package size={13} className="text-blue-600" />
              Ưu đãi sản phẩm
            </button>
          </div>

          {/* ========================================================================= */}
          {/* 3. SECTION: CÓ THỂ SỬ DỤNG (ELIGIBLE TICKETS)                             */}
          {/* ========================================================================= */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Leaf size={14} className="text-emerald-700" />
              <span>Có thể sử dụng</span>
              <span className="rounded-full bg-[#E2EDD0] text-[#2E5B32] px-2 py-0.2 text-[11px] font-black">
                {eligibleCandidates.length}
              </span>
            </div>

            {eligibleCandidates.length > 0 ? (
              <div className="space-y-2.5">
                {eligibleCandidates.map((cand) => {
                  const isCurrent = applied?.promotionId === cand.promotionId;

                  // Màu cuống vé (Ticket Stub Colors)
                  let stubBg = "bg-[#D7ECDA] text-emerald-950"; // Mặc định xanh pastel
                  let isNewWeb = cand.targetCustomer === "new_web";
                  let isFixedVnd = cand.discountType === "fixed";

                  if (isNewWeb) {
                    stubBg = "bg-[#FFE8DE] text-amber-950"; // Cam đào cho khách mới
                  } else if (isFixedVnd) {
                    stubBg = "bg-[#FAEED6] text-amber-950"; // Vàng be cho tiền mặt
                  }

                  return (
                    <div
                      key={cand.promotionId}
                      className={`relative flex items-stretch rounded-2xl bg-white transition shadow-2xs overflow-hidden border ${
                        isCurrent
                          ? "border-2 border-[#3B653D] ring-1 ring-[#3B653D]/10"
                          : "border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      {/* Cuống vé đục lỗ (Ticket Stub) */}
                      <div
                        className={`relative w-[92px] sm:w-[96px] ${stubBg} flex flex-col items-center justify-center p-2 text-center shrink-0 border-r border-dashed border-slate-300/80`}
                      >
                        {/* Vết cắt tròn 2 bên (Ticket notches) */}
                        <div className="absolute -left-2 top-1/2 -mt-2 h-4 w-4 rounded-full bg-[#FAF8F5] border-r border-slate-200/80" />
                        <div className="absolute -right-2 top-1/2 -mt-2 h-4 w-4 rounded-full bg-white border-l border-slate-200/80" />

                        {isNewWeb ? (
                          <span className="text-[9px] font-extrabold uppercase tracking-tight text-red-600 mb-0.5">
                            KHÁCH MỚI
                          </span>
                        ) : null}

                        <span className="text-xl font-black tracking-tight leading-tight">
                          {getStubValue(cand)}
                        </span>

                        {cand.maxDiscountVnd && cand.discountType === "percentage" ? (
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tight mt-0.5">
                            TỐI ĐA {Math.round(cand.maxDiscountVnd / 1000)}K
                          </span>
                        ) : null}
                      </div>

                      {/* Thân vé (Ticket Body) */}
                      <div className="p-3 sm:p-3.5 flex-1 flex items-center justify-between gap-3 min-w-0 bg-white">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug truncate">
                            {cand.title}
                          </h4>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <ShoppingCart size={11} className="text-slate-400 shrink-0" />
                            <span>
                              {cand.minOrderThreshold
                                ? `Đơn từ ${formatVnd(cand.minOrderThreshold)}`
                                : "Mọi đơn hàng"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Calendar size={11} className="text-slate-400 shrink-0" />
                            <span>HSD: {formatHsd(cand.endDate)}</span>
                          </div>

                          <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 max-w-[200px] truncate">
                            {cand.scope === "product" ? "Sản phẩm chỉ định" : "Áp dụng cho toàn bộ sản phẩm"}
                          </span>
                        </div>

                        {/* Nút thao tác bên phải */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#D7ECDA] px-3.5 py-1.5 text-xs font-bold text-[#204E25] shadow-2xs">
                              <Check size={12} strokeWidth={3} />
                              Đã chọn
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
                              className="rounded-full bg-[#3B653D] hover:bg-[#2E5B32] px-4 py-1.5 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
                            >
                              Áp dụng
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewDetailCand(cand)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 transition flex items-center"
                          >
                            Xem điều kiện ›
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center text-xs text-slate-500">
                Không có ưu đãi nào thuộc danh mục này khả dụng cho đơn hàng hiện tại.
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. SECTION: CHƯA ĐỦ ĐIỀU KIỆN (INELIGIBLE TICKETS)                         */}
          {/* ========================================================================= */}
          {ineligibleCandidates.length > 0 ? (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <AlertCircle size={14} className="text-slate-400" />
                <span>Chưa đủ điều kiện</span>
                <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.2 text-[11px] font-bold">
                  {ineligibleCandidates.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {ineligibleCandidates.map((cand) => (
                  <div
                    key={cand.promotionId}
                    className="relative flex items-stretch rounded-2xl bg-white transition shadow-2xs overflow-hidden border border-slate-200/60 opacity-80"
                  >
                    {/* Cuống vé xám (Disabled stub) */}
                    <div className="relative w-[92px] sm:w-[96px] bg-[#ECEEEF] text-slate-400 flex flex-col items-center justify-center p-2 text-center shrink-0 border-r border-dashed border-slate-300">
                      <div className="absolute -left-2 top-1/2 -mt-2 h-4 w-4 rounded-full bg-[#FAF8F5] border-r border-slate-200" />
                      <div className="absolute -right-2 top-1/2 -mt-2 h-4 w-4 rounded-full bg-white border-l border-slate-200" />

                      <span className="text-xl font-black tracking-tight leading-tight">
                        {getStubValue(cand)}
                      </span>

                      {cand.maxDiscountVnd && cand.discountType === "percentage" ? (
                        <span className="text-[9px] font-bold uppercase tracking-tight mt-0.5">
                          TỐI ĐA {Math.round(cand.maxDiscountVnd / 1000)}K
                        </span>
                      ) : null}
                    </div>

                    {/* Thân vé xám */}
                    <div className="p-3 sm:p-3.5 flex-1 flex items-center justify-between gap-3 min-w-0 bg-white">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-600 leading-snug truncate">
                          {cand.title}
                        </h4>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <ShoppingCart size={11} className="shrink-0" />
                          <span>
                            {cand.minOrderThreshold
                              ? `Đơn từ ${formatVnd(cand.minOrderThreshold)}`
                              : "Mọi đơn hàng"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar size={11} className="shrink-0" />
                          <span>HSD: {formatHsd(cand.endDate)}</span>
                        </div>

                        {cand.ineligibleReason ? (
                          <span className="inline-block text-[10px] font-medium bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 max-w-[220px] truncate">
                            {cand.ineligibleReason}
                          </span>
                        ) : null}
                      </div>

                      {/* Nút disabled */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                          Chưa đủ điều kiện
                        </span>

                        <button
                          type="button"
                          onClick={() => setViewDetailCand(cand)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center"
                        >
                          Xem điều kiện ›
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ========================================================================= */}
        {/* 5. FOOTER CHUẨN DESIGN: % Icon + Đã giảm + Nút Xong                       */}
        {/* ========================================================================= */}
        <div className="relative border-t border-slate-200/80 px-6 py-3.5 flex items-center justify-between bg-white rounded-b-[28px] shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF5ED] text-[#3B653D]">
              <Percent size={16} strokeWidth={2.6} />
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium block leading-none">
                Đã giảm:
              </span>
              <p className="text-xl font-black text-slate-900 tabular-nums leading-tight mt-0.5">
                {formatVnd(quote?.discountTotal || 0)}
              </p>
            </div>
          </div>

          {/* Decorative leaf bottom */}
          <div className="hidden sm:block text-[#3B653D]/20 pointer-events-none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.52-11 4 2 2 4 4 6 1z" />
            </svg>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#3B653D] hover:bg-[#2E5B32] px-8 py-2.5 text-sm font-bold text-white shadow-xs transition cursor-pointer"
          >
            Xong
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 6. POPUP XEM CHI TIẾT ĐIỀU KIỆN KHI BẤM "Xem điều kiện ›"                  */}
        {/* ========================================================================= */}
        {viewDetailCand ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3 border border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Chi tiết điều kiện ưu đãi
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">
                    {viewDetailCand.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewDetailCand(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hình thức:</span>
                  <span className="font-semibold text-slate-800">
                    {viewDetailCand.type === "code" ? "Mã giảm giá (Coupon)" : "Tự động áp dụng"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Mức giảm:</span>
                  <span className="font-bold text-red-600">
                    {viewDetailCand.discountType === "percentage"
                      ? `${viewDetailCand.discountValue}% ${viewDetailCand.maxDiscountVnd ? `(tối đa ${formatVnd(viewDetailCand.maxDiscountVnd)})` : ""}`
                      : formatVnd(viewDetailCand.discountValue)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Đơn tối thiểu:</span>
                  <span className="font-semibold text-slate-800">
                    {viewDetailCand.minOrderThreshold
                      ? `${viewDetailCand.thresholdOperator === ">=" ? "Từ" : "Trên"} ${formatVnd(viewDetailCand.minOrderThreshold)}`
                      : "Không giới hạn"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Phạm vi áp dụng:</span>
                  <span className="font-semibold text-slate-800">
                    {viewDetailCand.scope === "product" ? "Sản phẩm chỉ định" : "Toàn bộ cửa hàng"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Hạn sử dụng:</span>
                  <span className="font-semibold text-slate-800">
                    {formatHsd(viewDetailCand.endDate)}
                  </span>
                </div>

                {viewDetailCand.description ? (
                  <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                    {viewDetailCand.description}
                  </div>
                ) : null}

                {viewDetailCand.ineligibleReason ? (
                  <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 font-medium flex items-start gap-1.5 mt-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>{viewDetailCand.ineligibleReason}</span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setViewDetailCand(null)}
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
