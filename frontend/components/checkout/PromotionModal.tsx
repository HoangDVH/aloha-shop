"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Truck,
} from "lucide-react";
import { ReturnedBadge, type VoucherReturnInfo } from "@/components/voucher/ReturnedBadge";
import { formatVnd } from "@/lib/api";
import { pctText, sortVouchersGrouped, type MysteryInfo } from "@/lib/voucherFormat";
import { getAvailablePromotions, DEFAULT_SHIP_TIERS, type AvailablePromotionUI } from "@/lib/promotions";
import { PromotionDetailModal } from "./PromotionDetailModal";
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
  /** Mức hỗ trợ ship thực tế và thông tin voucher ship từ trang checkout. */
  shippingDiscount?: number;
  shippingPromotionTitle?: string;
  shippingPromotionId?: string;
  shippingFee?: number | null;
};

function stubMaxLabel(c: EvaluatedCandidateUI): string | undefined {
  return c.maxDiscountVnd && c.discountType === "percentage"
    ? `TỐI ĐA ${Math.round(c.maxDiscountVnd / 1000)}K`
    : undefined;
}

function minOrderText(c: EvaluatedCandidateUI): string {
  return c.minOrderThreshold ? `Đơn từ ${formatVnd(c.minOrderThreshold)}` : "Mọi đơn hàng";
}

const NO_CANDIDATES: EvaluatedCandidateUI[] = [];

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
  shippingDiscount,
  shippingPromotionTitle,
  shippingPromotionId,
  shippingFee,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [inputCode, setInputCode] = useState(selectedCode || "");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeOpen, setCodeOpen] = useState(Boolean(selectedCode));
  const [filterType, setFilterType] = useState<"all" | "goods" | "shipping">("all");
  const [viewDetailCand, setViewDetailCand] = useState<EvaluatedCandidateUI | null>(null);
  const [availableShipPromos, setAvailableShipPromos] = useState<AvailablePromotionUI[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tải danh sách voucher hỗ trợ ship từ server khi mở popup
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getAvailablePromotions()
      .then((items) => {
        if (!alive) return;
        const ships = items.filter((p) => p.benefitType === "shipping");
        if (ships.length > 0) {
          setAvailableShipPromos(ships);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

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

  const applied = quote?.applied;
  const subtotal = quote?.subtotal || 0;
  const quoteCandidates = quote?.candidates ?? NO_CANDIDATES;

  // Nguồn danh sách các voucher ship
  const baseShipPromos = useMemo(() => {
    return availableShipPromos.length > 0 ? availableShipPromos : DEFAULT_SHIP_TIERS;
  }, [availableShipPromos]);

  // Đánh giá tất cả voucher ship theo điều kiện đơn hàng hoặc kết quả tính phí ship từ checkout
  const shipCandidates: EvaluatedCandidateUI[] = useMemo(() => {
    const evaluated: EvaluatedCandidateUI[] = baseShipPromos.map((p) => {
      const minOrder = p.minOrderThreshold || 0;
      // Khớp voucher nếu checkout đã tính và áp dụng
      const isMatchedByCheckout =
        shippingDiscount != null &&
        shippingDiscount > 0 &&
        (p.id === shippingPromotionId ||
          p.title === shippingPromotionTitle ||
          p.discountValue === shippingDiscount);

      const meetsThreshold =
        minOrder <= 0
          ? true
          : p.thresholdOperator === ">"
          ? subtotal > minOrder
          : subtotal >= minOrder;

      const eligible = isMatchedByCheckout || meetsThreshold;
      const shortfall = eligible ? 0 : Math.max(0, minOrder - subtotal);

      // Xem voucher này có notice riêng trong quote không
      const quoteNotice = quoteCandidates.find(
        (c) => c.promotionId === p.id && !c.eligible
      );

      const finalEligible = isMatchedByCheckout ? true : (quoteNotice ? false : eligible);
      const finalReason = isMatchedByCheckout
        ? undefined
        : (quoteNotice?.ineligibleReason || (!eligible && shortfall > 0 ? `Cần mua thêm ${formatVnd(shortfall)} để nhận ưu đãi.` : undefined));

      return {
        promotionId: p.id,
        title: p.title,
        type: p.type || "auto",
        discountType: p.discountType || "fixed",
        discountValue: p.discountValue,
        minOrderThreshold: minOrder,
        thresholdOperator: p.thresholdOperator || ">=",
        eligible: finalEligible,
        ineligibleReason: finalReason,
        calculatedDiscount: finalEligible ? p.discountValue : 0,
        benefitType: "shipping" as const,
        scope: "all" as const,
        targetCustomer: ("targetCustomer" in p ? p.targetCustomer : undefined) || "all",
        endDate: "endDate" in p ? p.endDate : undefined,
        description: p.description,
        needsClaim: quoteNotice?.needsClaim,
        ...(shortfall > 0 && !quoteNotice ? { shortfall } : {}),
      };
    });

    // Nếu checkout đã áp dụng mã ship nhưng chưa có trong danh sách
    if (shippingDiscount != null && shippingDiscount > 0 && shippingPromotionTitle) {
      const alreadyHas = evaluated.some(
        (v) =>
          v.promotionId === shippingPromotionId ||
          v.title === shippingPromotionTitle ||
          v.discountValue === shippingDiscount
      );
      if (!alreadyHas) {
        evaluated.push({
          promotionId: shippingPromotionId || "ship_applied_checkout",
          title: shippingPromotionTitle,
          type: "auto",
          discountType: "fixed",
          discountValue: shippingDiscount,
          minOrderThreshold: 0,
          thresholdOperator: ">=",
          eligible: true,
          calculatedDiscount: shippingDiscount,
          benefitType: "shipping",
          scope: "all",
          targetCustomer: "all",
          description: "Mã hỗ trợ phí vận chuyển áp dụng cho đơn hàng",
        });
      }
    }

    // Deduplicate: Mỗi mức giảm giá ship chỉ giữ 1 mã đại diện tốt nhất (tránh trùng lặp 2 mã 30k)
    const deduped: EvaluatedCandidateUI[] = [];
    for (const cand of evaluated) {
      const existing = deduped.find(
        (d) => d.discountValue === cand.discountValue || d.title === cand.title
      );
      if (!existing) {
        deduped.push(cand);
      } else if (!existing.eligible && cand.eligible) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = cand;
      }
    }

    return deduped;
  }, [
    baseShipPromos,
    subtotal,
    shippingDiscount,
    shippingPromotionId,
    shippingPromotionTitle,
    quoteCandidates,
  ]);

  // Tách biệt rành mạch 2 nhóm voucher chuẩn sàn TMĐT (Shopee / TikTok Shop)
  const goodsCandidates = useMemo(() => {
    return quoteCandidates.filter((c) => c.benefitType !== "shipping");
  }, [quoteCandidates]);

  const eligibleGoods = useMemo(() => {
    return sortVouchersGrouped(goodsCandidates.filter((c) => c.eligible));
  }, [goodsCandidates]);

  const ineligibleGoods = useMemo(() => {
    return sortVouchersGrouped(goodsCandidates.filter((c) => !c.eligible));
  }, [goodsCandidates]);

  const eligibleShips = useMemo(() => {
    return shipCandidates.filter((c) => c.eligible);
  }, [shipCandidates]);

  const ineligibleShips = useMemo(() => {
    return shipCandidates.filter((c) => !c.eligible);
  }, [shipCandidates]);

  // Tìm voucher ship tốt nhất đã đủ điều kiện để tự động áp dụng
  const bestEligibleShip = useMemo(() => {
    if (shippingDiscount != null && shippingDiscount > 0) {
      const matched = eligibleShips.find(
        (v) =>
          v.promotionId === shippingPromotionId ||
          v.title === shippingPromotionTitle ||
          v.discountValue === shippingDiscount
      );
      if (matched) return matched;
    }
    return eligibleShips.reduce<EvaluatedCandidateUI | null>((best, cur) => {
      if (!best) return cur;
      return (cur.discountValue || 0) > (best.discountValue || 0) ? cur : best;
    }, null);
  }, [eligibleShips, shippingDiscount, shippingPromotionId, shippingPromotionTitle]);

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

  // Mọi hook (useState/useEffect/useMemo) phải nằm TRÊN dòng này, nếu không React báo "Rendered more hooks".
  if (!open || !mounted) return null;

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

          {/* Category Filter Pills (Tất cả • Mã giảm giá • Hỗ trợ ship) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "all"
                  ? "bg-[#E6EFE4] text-[#2E5B32] border border-[#3B653D]/30 shadow-2xs font-bold"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Leaf size={12} className="text-emerald-700" />
              Tất cả
            </button>

            <button
              type="button"
              onClick={() => setFilterType("goods")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "goods"
                  ? "bg-rose-50 text-[#C8102E] border border-rose-300 shadow-2xs font-bold"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Tag size={12} className="text-[#C8102E]" />
              Mã giảm giá
              {eligibleGoods.length > 0 ? (
                <span className="rounded-full bg-rose-100 text-[#C8102E] px-1.5 py-0.2 text-[10px] font-bold">
                  {eligibleGoods.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setFilterType("shipping")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "shipping"
                  ? "bg-sky-50 text-[#0284C7] border border-sky-300 shadow-2xs font-bold"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Truck size={12} className="text-[#0284C7]" />
              <span>Hỗ trợ ship</span>
              {bestEligibleShip ? (
                <span className="inline-flex items-center justify-center rounded-full bg-[#0284C7] text-white text-[9px] font-bold px-1.5 py-0.2">
                  ✓
                </span>
              ) : null}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* KHỐI 1: 🚚 MÃ MIỄN PHÍ VẬN CHUYỂN (FREESHIP - CHUẨN SHOPEE)               */}
          {/* ========================================================================= */}
          {(filterType === "all" || filterType === "shipping") && (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                    <Truck size={12} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Mã Miễn Phí Vận Chuyển</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Áp dụng tối đa 1 mã</span>
              </div>

              {eligibleShips.length > 0 ? (
                <div className="space-y-2">
                  {eligibleShips.map((cand) => {
                    const isShipApplied = Boolean(
                      cand.eligible && bestEligibleShip?.promotionId === cand.promotionId
                    );
                    return (
                      <VoucherTicket
                        key={cand.promotionId}
                        tone="green"
                        stubTopLabel="FREESHIP"
                        stubValue={getStubValue(cand)}
                        stubSubLabel="HỖ TRỢ SHIP"
                        title={cand.title}
                        selected={isShipApplied}
                        action={
                          <div className="flex flex-col items-end gap-1.5">
                            {isShipApplied ? (
                              <div
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-bold shadow-2xs"
                                title="Đã tự động áp dụng mức hỗ trợ ship tốt nhất"
                              >
                                <Check size={12} strokeWidth={3} />
                                <span>Đã áp dụng</span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">Khả dụng</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewDetailCand(cand)}
                              className="text-[11px] text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            >
                              Điều kiện ›
                            </button>
                          </div>
                        }
                      >
                        <TicketLine icon={<ShoppingCart size={11} className="text-slate-400 shrink-0" />}>
                          {minOrderText(cand)}
                        </TicketLine>
                        <TicketLine icon={<Calendar size={11} className="text-slate-400 shrink-0" />}>
                          HSD: {formatHsd(cand.endDate)}
                        </TicketLine>
                      </VoucherTicket>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-400">
                  Chưa có mã hỗ trợ ship khả dụng cho đơn hàng này
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* KHỐI 2: 🏷️ MÃ GIẢM GIÁ ĐƠN HÀNG (SHOP VOUCHER - CHUẨN SHOPEE)              */}
          {/* ========================================================================= */}
          {(filterType === "all" || filterType === "goods") && (
            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-800">
                    <Tag size={12} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Mã Giảm Giá Shop</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Áp dụng tối đa 1 mã</span>
              </div>

              {eligibleGoods.length > 0 ? (
                <div className="space-y-2">
                  {eligibleGoods.map((cand) => {
                    const isCurrent = applied?.promotionId === cand.promotionId;
                    return (
                      <VoucherTicket
                        key={cand.promotionId}
                        tone="red"
                        stubTopLabel="GIẢM"
                        stubValue={getStubValue(cand)}
                        stubSubLabel={stubMaxLabel(cand)}
                        title={cand.title}
                        selected={isCurrent}
                        action={
                          <div className="flex flex-col items-end gap-1.5">
                            {isCurrent ? (
                              <button
                                type="button"
                                onClick={onRemoveDiscount}
                                className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-[#C8102E] px-3 py-1 text-xs font-bold shadow-2xs hover:bg-rose-200 transition cursor-pointer group"
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
                                className="rounded-full bg-[#C8102E] hover:bg-[#A00C24] active:scale-95 px-3.5 py-1 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
                              >
                                Áp dụng
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewDetailCand(cand)}
                              className="text-[11px] text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            >
                              Điều kiện ›
                            </button>
                          </div>
                        }
                      >
                        <TicketLine icon={<ShoppingCart size={11} className="text-slate-400 shrink-0" />}>
                          {minOrderText(cand)}
                        </TicketLine>
                        <TicketLine icon={<Calendar size={11} className="text-slate-400 shrink-0" />}>
                          HSD: {formatHsd(cand.endDate)}
                        </TicketLine>
                        {cand.returnedFrom ? <ReturnedBadge info={cand.returnedFrom} /> : null}
                      </VoucherTicket>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-400">
                  Không có mã giảm giá khả dụng cho đơn hàng hiện tại
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* KHỐI 3: CHƯA ĐỦ ĐIỀU KIỆN (INELIGIBLE TICKETS)                            */}
          {/* ========================================================================= */}
          {(() => {
            const allIneligible = [
              ...(filterType !== "shipping" ? ineligibleGoods : []),
              ...(filterType !== "goods" ? ineligibleShips : []),
            ];
            if (allIneligible.length === 0) return null;
            return (
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 px-0.5">
                  <AlertCircle size={13} />
                  <span>Chưa đủ điều kiện ({allIneligible.length})</span>
                </div>
                <div className="space-y-2">
                  {allIneligible.map((cand) => (
                    <VoucherTicket
                      key={cand.promotionId}
                      tone="gray"
                      disabled
                      stubTopLabel={cand.benefitType === "shipping" ? "FREESHIP" : "GIẢM"}
                      stubValue={getStubValue(cand)}
                      stubSubLabel={cand.benefitType === "shipping" ? "HỖ TRỢ SHIP" : stubMaxLabel(cand)}
                      title={cand.title}
                      action={
                        <div className="flex flex-col items-end gap-1.5">
                          {ineligibleAction ? (
                            ineligibleAction(cand)
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                              Chưa đủ ĐK
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewDetailCand(cand)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          >
                            Điều kiện ›
                          </button>
                        </div>
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
                          Mua thêm {formatVnd(cand.shortfall)} để nhận ưu đãi
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
            );
          })()}
        </div>

        {/* ========================================================================= */}
        {/* 5. FOOTER CHUẨN DESIGN & TIKTOK SHOP MOBILE: % Icon + Đã giảm + Nút Xong  */}
        {/* ========================================================================= */}
        {(() => {
          const goodsDiscount = quote?.discountTotal || 0;
          const shipDiscount =
            shippingDiscount != null && shippingDiscount > 0
              ? shippingDiscount
              : bestEligibleShip
              ? bestEligibleShip.discountValue || 0
              : 0;
          const totalDiscount = goodsDiscount + shipDiscount;
          return (
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
                    {formatVnd(totalDiscount)}
                  </p>
                  {totalDiscount > 0 ? (
                    <span className="text-[10.5px] text-slate-500 font-medium block mt-0.5">
                      {goodsDiscount > 0 && shipDiscount > 0
                        ? `Gồm ${formatVnd(goodsDiscount)} giảm hàng + ${formatVnd(shipDiscount)} hỗ trợ ship`
                        : shipDiscount > 0
                        ? `Đã gồm ${formatVnd(shipDiscount)} hỗ trợ ship`
                        : `Giảm ${formatVnd(goodsDiscount)} tiền hàng`}
                    </span>
                  ) : null}
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
          );
        })()}

        {/* ========================================================================= */}
        {/* 6. POPUP XEM CHI TIẾT ĐIỀU KIỆN KHI BẤM "Xem điều kiện ›"                  */}
        {/* ========================================================================= */}
        <PromotionDetailModal cand={viewDetailCand} onClose={() => setViewDetailCand(null)} />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
