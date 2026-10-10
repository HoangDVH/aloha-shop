"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VoucherTicket } from "@/components/voucher/VoucherTicket";
import { Check, X } from "lucide-react";
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
        className="relative flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out
                   /* Mobile: Bottom sheet drawer (Shopee & TikTok Shop style) */
                   max-h-[85vh] h-[82vh] rounded-t-2xl rounded-b-none border-t border-slate-200
                   /* Desktop: Centered modal */
                   sm:h-auto sm:max-h-[85vh] sm:max-w-[480px] sm:rounded-2xl sm:border sm:border-slate-200
                   overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Drag Indicator */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0 bg-white">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* ========================================================================= */}
        {/* 1. HEADER: Tiêu đề rõ ràng + Nút Đóng (Tối giản, không icon rườm rà)        */}
        {/* ========================================================================= */}
        <div className="relative flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">
              Ưu đãi &amp; Mã giảm giá
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Áp dụng tối đa 1 mã giảm giá và 1 mã vận chuyển
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. BODY: Ô nhập mã + Bộ lọc tab + Danh sách Voucher                        */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 space-y-3.5 bg-slate-50/50">
          {/* Ô nhập mã ưu đãi / voucher */}
          <form onSubmit={handleApplyInput} className="flex gap-2 items-center">
            <input
              aria-label="Mã ưu đãi"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã giảm giá"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold uppercase tracking-wider text-slate-800 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
            <button
              type="submit"
              disabled={!inputCode.trim() || submittingCode}
              className="rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-95 px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-200 disabled:text-slate-400 shadow-2xs cursor-pointer shrink-0"
            >
              {submittingCode ? "..." : "Áp dụng"}
            </button>
          </form>

          {/* Category Filter Pills (Tất cả • Mã giảm giá • Hỗ trợ ship) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Tất cả
            </button>

            <button
              type="button"
              onClick={() => setFilterType("goods")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "goods"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Mã giảm giá</span>
              {eligibleGoods.length > 0 ? (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  filterType === "goods" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                }`}>
                  {eligibleGoods.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setFilterType("shipping")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filterType === "shipping"
                  ? "bg-sky-700 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Hỗ trợ ship</span>
              {bestEligibleShip ? (
                <span className={`inline-flex items-center justify-center rounded-full text-[9px] font-bold px-1.5 py-0.2 ${
                  filterType === "shipping" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
                }`}>
                  ✓
                </span>
              ) : null}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* KHỐI 1: MÃ MIỄN PHÍ VẬN CHUYỂN (FREESHIP)                                 */}
          {/* ========================================================================= */}
          {(filterType === "all" || filterType === "shipping") && (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Mã Miễn Phí Vận Chuyển
                </span>
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
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-bold"
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
                        <p className="text-[11px] text-slate-600 leading-tight">
                          {minOrderText(cand)}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          HSD: {formatHsd(cand.endDate)}
                        </p>
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
          {/* KHỐI 2: MÃ GIẢM GIÁ ĐƠN HÀNG (SHOP VOUCHER)                                */}
          {/* ========================================================================= */}
          {(filterType === "all" || filterType === "goods") && (
            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Mã Giảm Giá Shop
                </span>
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
                                className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-[#C8102E] px-2.5 py-1 text-xs font-bold hover:bg-rose-200 transition cursor-pointer group"
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
                                className="rounded-full bg-[#C8102E] hover:bg-[#A00C24] active:scale-95 px-3 py-1 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
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
                        <p className="text-[11px] text-slate-600 leading-tight">
                          {minOrderText(cand)}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          HSD: {formatHsd(cand.endDate)}
                        </p>
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
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Chưa đủ điều kiện ({allIneligible.length})
                  </span>
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
                      <p className="text-[11px] text-slate-400 leading-tight">
                        {minOrderText(cand)}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        HSD: {formatHsd(cand.endDate)}
                      </p>
                      {cand.shortfall && cand.shortfall > 0 ? (
                        <span className="inline-flex items-center text-[10.5px] font-semibold text-amber-800 bg-amber-50 rounded-md px-2 py-0.5 border border-amber-200/60 max-w-full">
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
        {/* 3. FOOTER: Tổng tiền giảm + Nút Xong (Tối giản chuẩn Shopee / TikTok)    */}
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
            <div className="relative border-t border-slate-200 px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] rounded-b-none sm:rounded-b-2xl">
              <div>
                <span className="text-xs text-slate-500 font-medium block leading-none">
                  Tổng giảm giá:
                </span>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-700 tabular-nums leading-tight mt-0.5">
                  {formatVnd(totalDiscount)}
                </p>
                {totalDiscount > 0 ? (
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                    {goodsDiscount > 0 && shipDiscount > 0
                      ? `Giảm ${formatVnd(goodsDiscount)} hàng + ${formatVnd(shipDiscount)} ship`
                      : shipDiscount > 0
                      ? `Đã gồm ${formatVnd(shipDiscount)} ship`
                      : `Giảm ${formatVnd(goodsDiscount)} tiền hàng`}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 px-6 sm:px-8 py-2.5 text-sm font-bold text-white shadow-2xs transition cursor-pointer"
              >
                Xong
              </button>
            </div>
          );
        })()}

        {/* Modal xem chi tiết điều kiện */}
        <PromotionDetailModal cand={viewDetailCand} onClose={() => setViewDetailCand(null)} />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
