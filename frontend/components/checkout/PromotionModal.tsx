"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TicketLine, VoucherTicket } from "@/components/voucher/VoucherTicket";
import {
  Check,
  X,
  AlertCircle,
  Tag,
  Calendar,
  ShoppingCart,
  Percent,
  Package,
  Leaf,
} from "lucide-react";
import { ReturnedBadge, type VoucherReturnInfo } from "@/components/voucher/ReturnedBadge";
import { formatVnd } from "@/lib/api";
import { pctText, type MysteryInfo } from "@/lib/voucherFormat";
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
  /** Voucher phải lưu vào ví trước khi dùng. */
  needsClaim?: boolean;
  benefitType?: "goods" | "shipping";
  /** Tiền hàng còn thiếu để đủ điều kiện, server tính theo giá server. */
  shortfall?: number;
  /** Voucher được hoàn về vì đơn dùng nó trước đó đã huỷ / hết hạn thanh toán. */
  returnedFrom?: VoucherReturnInfo;
  mystery?: MysteryInfo;
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
  /** Giá sale + quà chiến dịch; `subtotal` ở trên đã là tiền hàng sau giá sale. */
  campaign?: import("@/lib/campaign/campaignQuote").CampaignQuoteUI;
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
  /** Nút riêng cho vé chưa đủ điều kiện (ví dụ "Lưu" khi voucher phải lưu trước). */
  ineligibleAction?: (cand: EvaluatedCandidateUI) => ReactNode;
};

function stubMaxLabel(c: EvaluatedCandidateUI): string | undefined {
  return c.maxDiscountVnd && c.discountType === "percentage"
    ? `TỐI ĐA ${Math.round(c.maxDiscountVnd / 1000)}K`
    : undefined;
}

function minOrderText(c: EvaluatedCandidateUI): string {
  return c.minOrderThreshold ? `Đơn từ ${formatVnd(c.minOrderThreshold)}` : "Mọi đơn hàng";
}

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
  ineligibleAction,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [inputCode, setInputCode] = useState(selectedCode || "");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeOpen, setCodeOpen] = useState(Boolean(selectedCode));
  const [filterType, setFilterType] = useState<"all" | "code" | "product">("all");
  const [viewDetailCand, setViewDetailCand] = useState<EvaluatedCandidateUI | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync input when selectedCode prop changes
  useEffect(() => {
    if (selectedCode) {
      setInputCode(selectedCode);
    }
  }, [selectedCode]);

  // Freeze background scrolling when modal is open (chuẩn TikTok Shop / E-Commerce)
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

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
      return pctText(c);
    }
    const val = Number(c.discountValue) || 0;
    if (val >= 1000) {
      return `${Math.round(val / 1000)}K`;
    }
    return formatVnd(val);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-2xs transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full flex-col bg-[#FAF8F5] shadow-2xl transition-transform duration-300 ease-out
                   /* Mobile: TikTok Shop bottom-sheet style (hiện từ dưới lên, bo góc trên) */
                   max-h-[85vh] h-[82vh] rounded-t-[24px] rounded-b-none border-t border-slate-200/90
                   /* Desktop: Centered modal */
                   sm:h-auto sm:max-h-[88vh] sm:max-w-[490px] sm:rounded-[28px] sm:border sm:border-emerald-900/10
                   overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        {/* TikTok Shop Mobile Drag Handle Indicator */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0 bg-[#FAF8F5]">
          <div className="h-1.5 w-10 rounded-full bg-slate-300/90" />
        </div>

        {/* ========================================================================= */}
        {/* 1. HEADER CHUẨN DESIGN: % Icon badge + Title + Close Button               */}
        {/* ========================================================================= */}
        <div className="relative flex items-center justify-between border-b border-slate-200/60 bg-[#FAF8F5] px-5 pt-3 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Soft Green Round Badge with Coupon Icon */}
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-[#EAF2E9] text-[#2E5B32] shadow-2xs shrink-0">
              <div className="flex items-center justify-center border-2 border-dashed border-[#2E5B32]/40 rounded-lg w-6 h-6 sm:w-7 sm:h-7">
                <Percent size={14} strokeWidth={2.6} />
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
            {/* Decorative leaf top right on desktop */}
            <div className="hidden sm:block text-[#4A6B4C]/20 pointer-events-none">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.52-11 4 2 2 4 4 6 1z" />
              </svg>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/50 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. BODY CONTENT (SCROLLABLE): Ô nhập mã, Danh mục bộ lọc, Danh sách vé    */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 space-y-3.5 bg-[#FAF8F5]">
          {/* Ô nhập mã ưu đãi / voucher — thu gọn mặc định, hệ thống đã tự áp mã tốt nhất */}
          {!codeOpen ? (
            <button
              type="button"
              onClick={() => setCodeOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-[#3B653D] hover:underline"
            >
              <Tag size={15} aria-hidden />
              Nhập mã khác
            </button>
          ) : (
          <form onSubmit={handleApplyInput} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Tag
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                aria-label="Mã ưu đãi"
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
              className="rounded-xl bg-[#3B653D] hover:bg-[#2E5B32] active:scale-95 px-5 py-2.5 text-sm font-bold text-white transition disabled:bg-slate-200 disabled:text-slate-400 shadow-2xs cursor-pointer shrink-0"
            >
              {submittingCode ? "..." : "Áp dụng"}
            </button>
          </form>
          )}

          {/* Category Filter Pills (Tất cả • Mã giảm giá • Ưu đãi sản phẩm) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
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
                  const isNewWeb = cand.targetCustomer === "new_web";
                  const tone = isNewWeb ? "peach" : cand.discountType === "fixed" ? "cream" : "green";
                  return (
                    <VoucherTicket
                      key={cand.promotionId}
                      tone={tone}
                      stubTopLabel={isNewWeb ? "KHÁCH MỚI" : undefined}
                      stubValue={getStubValue(cand)}
                      stubSubLabel={stubMaxLabel(cand)}
                      title={cand.title}
                      selected={isCurrent}
                      action={
                        <>
                          {isCurrent ? (
                            <button
                              type="button"
                              onClick={onRemoveDiscount}
                              className="inline-flex items-center gap-1 rounded-full bg-[#D7ECDA] px-3.5 py-1.5 text-xs font-bold text-[#204E25] shadow-2xs hover:bg-rose-50 hover:text-rose-700 hover:ring-1 hover:ring-rose-200 transition cursor-pointer group"
                              title="Bấm để bỏ chọn ưu đãi này"
                            >
                              <Check size={12} strokeWidth={3} className="group-hover:hidden" />
                              <span className="group-hover:hidden">Đã chọn</span>
                              <span className="hidden group-hover:inline">Bỏ chọn</span>
                            </button>
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
                              className="rounded-full bg-[#3B653D] hover:bg-[#2E5B32] active:scale-95 px-4 py-1.5 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
                            >
                              Áp dụng
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewDetailCand(cand)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 transition flex items-center cursor-pointer"
                          >
                            Xem điều kiện ›
                          </button>
                        </>
                      }
                    >
                      <TicketLine icon={<ShoppingCart size={11} className="text-slate-400 shrink-0" />}>
                        {minOrderText(cand)}
                      </TicketLine>
                      <TicketLine icon={<Calendar size={11} className="text-slate-400 shrink-0" />}>
                        HSD: {formatHsd(cand.endDate)}
                      </TicketLine>
                      <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 max-w-[190px] truncate">
                        {cand.scope === "product" ? "Sản phẩm chỉ định" : "Toàn bộ sản phẩm"}
                      </span>
                      {cand.returnedFrom ? <ReturnedBadge info={cand.returnedFrom} /> : null}
                    </VoucherTicket>
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
                  <VoucherTicket
                    key={cand.promotionId}
                    tone="gray"
                    disabled
                    stubValue={getStubValue(cand)}
                    stubSubLabel={stubMaxLabel(cand)}
                    title={cand.title}
                    action={
                      <>
                        {ineligibleAction ? (
                          ineligibleAction(cand)
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                            Chưa đủ điều kiện
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setViewDetailCand(cand)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center cursor-pointer"
                        >
                          Xem điều kiện ›
                        </button>
                      </>
                    }
                  >
                    <TicketLine muted icon={<ShoppingCart size={11} className="shrink-0" />}>
                      {minOrderText(cand)}
                    </TicketLine>
                    <TicketLine muted icon={<Calendar size={11} className="shrink-0" />}>
                      HSD: {formatHsd(cand.endDate)}
                    </TicketLine>
                    {cand.shortfall && cand.shortfall > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-800 bg-amber-50 rounded-md px-2 py-0.5 border border-amber-200/60 max-w-full">
                        Mua thêm {formatVnd(cand.shortfall)} để áp dụng mã
                      </span>
                    ) : cand.ineligibleReason ? (
                      <span className="inline-block text-[10px] font-medium bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 max-w-[200px] truncate">
                        {cand.ineligibleReason}
                      </span>
                    ) : null}
                  </VoucherTicket>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ========================================================================= */}
        {/* 5. FOOTER CHUẨN DESIGN & TIKTOK SHOP MOBILE: % Icon + Đã giảm + Nút Xong  */}
        {/* Cực kỳ thông thoáng trên mobile, có safe-area padding chống bị dính đáy    */}
        {/* ========================================================================= */}
        <div className="relative border-t border-slate-200/90 px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] rounded-b-none sm:rounded-b-[28px]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5ED] text-[#3B653D] shrink-0">
              <Percent size={18} strokeWidth={2.6} />
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium block leading-none">
                Đã giảm:
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-tight mt-0.5">
                {formatVnd(quote?.discountTotal || 0)}
              </p>
            </div>
          </div>

          {/* Decorative leaf bottom on desktop */}
          <div className="hidden sm:block text-[#3B653D]/20 pointer-events-none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.52-11 4 2 2 4 4 6 1z" />
            </svg>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#3B653D] hover:bg-[#2E5B32] active:scale-95 px-7 sm:px-8 py-2.5 sm:py-3 text-sm font-bold text-white shadow-xs transition cursor-pointer"
          >
            Xong
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 6. POPUP XEM CHI TIẾT ĐIỀU KIỆN KHI BẤM "Xem điều kiện ›"                  */}
        {/* ========================================================================= */}
        {viewDetailCand ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-in fade-in duration-200">
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
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                      ? `${pctText(viewDetailCand)} ${viewDetailCand.maxDiscountVnd ? `(tối đa ${formatVnd(viewDetailCand.maxDiscountVnd)})` : ""}`
                      : formatVnd(viewDetailCand.discountValue)}
                  </span>
                </div>

                {viewDetailCand.mystery && !viewDetailCand.mystery.drawnPercent ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400 shrink-0">Tỉ lệ túi mù:</span>
                    <span className="text-right font-medium text-slate-700">
                      {viewDetailCand.mystery.tiers.map((t) => `${t.percent}%: ${t.chance}%`).join(" · ")}
                    </span>
                  </div>
                ) : null}

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
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
