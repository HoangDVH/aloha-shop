"use client";
import { voucherCustomerTitle } from "@/lib/voucherFormat";

import { useEffect, useState, useMemo } from "react";
import { ChevronRight, Truck, Ticket, X } from "lucide-react";
import { getAvailablePromotions, type AvailablePromotionUI } from "@/lib/promotions";
import type { ShopProduct } from "@/lib/api";
import { formatVnd } from "@/lib/api";
import { pctText } from "@/lib/voucherFormat";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { useToast } from "@/components/Toast";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { PdpVoucherSheet } from "./PdpVoucherSheet";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { pdpApplicableVouchers, pdpDefaultVouchers, pdpVoucherSheetEntries } from "@/lib/pdpVouchers";

interface AppliedVoucherSummary {
  promotionId: string;
  title: string;
  type?: "auto" | "code";
  code?: string;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  minLeadDays?: number;
}

interface ProductPromotionBadgesProps {
  product: ShopProduct;
  livePrice?: number;
  isWholesale?: boolean;
  appliedVoucher?: AppliedVoucherSummary;
  embedded?: boolean;
  hideHeader?: boolean;
}

interface FormattedTwoLineBadge {
  promotion: AvailablePromotionUI;
  headline: string;
  subline: string;
  type: "goods" | "shipping";
}

function formatTwoLineBadge(p: AvailablePromotionUI): FormattedTwoLineBadge {
  const isShipping = p.benefitType === "shipping";
  const isDelayed = (p.minLeadDays || 0) >= 3;

  if (isShipping) {
    const valText =
      p.discountType === "fixed" && p.discountValue > 0
        ? formatVnd(p.discountValue)
        : p.discountType === "percentage" && p.discountValue > 0
        ? `${p.discountValue}%`
        : "";
    const headline = valText ? `Hỗ trợ phí ship ${valText}` : "Hỗ trợ phí ship";
    const subline =
      p.minOrderThreshold && p.minOrderThreshold > 0
        ? `Đơn từ ${formatVnd(p.minOrderThreshold)}`
        : "Phí vận chuyển";
    return { promotion: p, headline, subline, type: "shipping" };
  }

  if (isDelayed) {
    const val = p.discountType === "percentage" ? pctText(p) : formatVnd(p.discountValue);
    return {
      promotion: p,
      headline: `Đặt trước tiết kiệm ${val}`,
      subline: `Chờ giao sau ${p.minLeadDays || 3} ngày`,
      type: "goods",
    };
  }

  if (p.targetCustomer === "returning_web") {
    const val = p.discountType === "percentage" ? pctText(p) : formatVnd(p.discountValue);
    return {
      promotion: p,
      headline: `Giảm ${val} tiền hàng`,
      subline: "Khách hàng cũ",
      type: "goods",
    };
  }

  if (p.targetCustomer === "new_web") {
    const val = p.discountType === "percentage" ? pctText(p) : formatVnd(p.discountValue);
    return {
      promotion: p,
      headline: `Giảm ${val} tiền hàng`,
      subline: "Khách hàng mới",
      type: "goods",
    };
  }

  const val = p.discountType === "percentage" ? pctText(p) : formatVnd(p.discountValue);
  const headline = `Giảm ${val}`;
  const subline =
    p.minOrderThreshold && p.minOrderThreshold > 0
      ? `Đơn từ ${formatVnd(p.minOrderThreshold)}`
      : "Áp dụng tại giỏ";

  return { promotion: p, headline, subline, type: "goods" };
}
export function ProductPromotionBadges({
  product,
  isWholesale = false,
  appliedVoucher,
  embedded = false,
  hideHeader = false,
}: ProductPromotionBadgesProps) {
  const [promotions, setPromotions] = useState<AvailablePromotionUI[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<AvailablePromotionUI | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const claims = useVoucherClaims();
  const toast = useToast();
  const { user } = useShopAuth();
  const { viewer } = useCampaignView();

  const [deliverySpeed, setDeliverySpeed] = useState<"standard" | "delayed_3d">(() => {
    if (typeof window !== "undefined") {
      try {
        const s = sessionStorage.getItem("aloha_delivery_speed");
        if (s === "delayed_3d") return "delayed_3d";
      } catch {}
    }
    return "standard";
  });

  useEffect(() => {
    const onSpeedChanged = (e: any) => {
      const speed = e?.detail?.speed || (typeof window !== "undefined" ? sessionStorage.getItem("aloha_delivery_speed") : null);
      if (speed === "delayed_3d" || speed === "standard") {
        setDeliverySpeed(speed);
      }
    };
    window.addEventListener("aloha-delivery-speed-changed", onSpeedChanged);
    return () => window.removeEventListener("aloha-delivery-speed-changed", onSpeedChanged);
  }, []);

  useEffect(() => {
    if (!claims.claimedVoucherId) return;
    toast.push("Đã lưu voucher vào ví. Mã sẽ được kiểm tra và áp dụng khi thanh toán.");
    claims.clearClaimedVoucherId();
  }, [claims.claimedVoucherId, claims.clearClaimedVoucherId, toast]);

  useEffect(() => {
    let active = true;
    setPromotions([]);
    setSelectedPromo(null);
    setLoaded(false);
    getAvailablePromotions()
      .then((items) => {
        if (active) {
          setPromotions(items);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.siStatus, user?.siRegion, viewer?.newBuyer]);

  const applicablePromotions = useMemo(() =>
    pdpApplicableVouchers(promotions, product, viewer, isWholesale),
    [promotions, product, isWholesale, viewer]);

  const applicableBadges = useMemo<FormattedTwoLineBadge[]>(() =>
    pdpDefaultVouchers(applicablePromotions, viewer).map(formatTwoLineBadge),
    [applicablePromotions, viewer]
  );

  const delayedPromo = useMemo(() =>
    applicablePromotions.find((p) => (p.minLeadDays || 0) >= 3),
    [applicablePromotions]
  );

  const activePromoId = useMemo(() => {
    if (deliverySpeed === "delayed_3d") {
      return delayedPromo?.id || null;
    }
    if (appliedVoucher?.promotionId) {
      return appliedVoucher.promotionId;
    }
    const firstStandard = applicableBadges.find(
      (b) =>
        b.type === "goods" &&
        (b.promotion.minLeadDays || 0) < 3 &&
        (!b.promotion.claimRequired || claims.claimedIds.has(b.promotion.id))
    );
    return firstStandard?.promotion.id || null;
  }, [deliverySpeed, delayedPromo, appliedVoucher, applicableBadges, claims.claimedIds]);

  const handleSelectVoucher = (promo: AvailablePromotionUI) => {
    const isShipping = promo.benefitType === "shipping";
    const isDelayed = (promo.minLeadDays || 0) >= 3;
    const isClaimed = claims.claimedIds.has(promo.id);

    if (promo.claimRequired && !isClaimed) {
      claims.claim(promo.id);
    }

    if (isShipping) {
      toast.push("Voucher vận chuyển được áp dụng và trừ vào phí ship tại bước thanh toán");
      return;
    }

    if (isDelayed) {
      try {
        sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
        sessionStorage.setItem("aloha_delivery_speed_user_explicit", "true");
        window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "delayed_3d" } }));
      } catch {}
      setDeliverySpeed("delayed_3d");
      toast.push(`Đã áp dụng ${voucherCustomerTitle(promo.title, promo)} (Chờ giao sau ${promo.minLeadDays || 3} ngày)`);
    } else {
      try {
        sessionStorage.setItem("aloha_delivery_speed", "standard");
        sessionStorage.setItem("aloha_delivery_speed_user_explicit", "true");
        window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "standard" } }));
      } catch {}
      setDeliverySpeed("standard");
      toast.push(`Đã áp dụng ${voucherCustomerTitle(promo.title, promo)} (Giao ngay tiêu chuẩn)`);
    }
  };

  const sheetEntries = pdpVoucherSheetEntries(promotions, product, viewer, claims.claimedIds, isWholesale);
  const unavailable = Object.fromEntries(sheetEntries.filter(e => e.reason).map(e => [e.promotion.id, e.reason!]));

  if (!loaded || sheetEntries.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={
          embedded
            ? "space-y-2"
            : "-mx-4 border-t-8 border-stone-100 bg-white px-4 py-3.5 sm:mx-0 sm:my-3.5 sm:rounded-2xl sm:border sm:border-stone-200/80 sm:p-3.5 space-y-2.5 sm:shadow-xs"
        }
        aria-label="Voucher và khuyến mãi"
      >
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              {embedded ? "Mã giảm giá" : "Voucher & khuyến mãi"}
            </span>
            <button
              type="button"
              onClick={() => setVoucherOpen(true)}
              className={`inline-flex items-center gap-0.5 text-xs font-bold transition-colors cursor-pointer ${
                embedded ? "text-emerald-700 hover:text-emerald-850" : "text-slate-400 hover:text-slate-600"
              }`}
              aria-haspopup="dialog"
            >
              <span>Xem tất cả ({sheetEntries.length})</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Thanh thẻ voucher trượt ngang hiển thị 100% đầy đủ chữ */}
        <div
          className={`flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x ${
            embedded ? "" : "-mx-4 px-4 sm:mx-0 sm:px-0"
          }`}
        >
          {applicableBadges.map(({ promotion, headline, subline, type }) => {
            const isShipping = type === "shipping";
            const isClaimed = claims.claimedIds.has(promotion.id);
            const isPending = claims.pendingId === promotion.id;
            const isActive = !isShipping && promotion.id === activePromoId;

            return (
              <div
                key={promotion.id}
                className={`relative inline-flex shrink-0 snap-start items-stretch rounded-xl border text-xs overflow-hidden transition select-none bg-white ${
                  isActive
                    ? "ring-1.5 ring-rose-500 border-rose-400 shadow-2xs"
                    : isShipping
                    ? "border-stone-200 hover:border-teal-400 shadow-2xs"
                    : "border-stone-200 hover:border-rose-400 shadow-2xs"
                }`}
              >
                {/* Rãnh khuyết vé bán nguyệt mép trái */}
                <span
                  className={`pointer-events-none absolute -left-1.5 top-1/2 -translate-y-1/2 z-10 h-3 w-3 rounded-full border border-stone-200 ${
                    embedded ? "bg-stone-50" : "bg-white"
                  }`}
                  aria-hidden="true"
                />

                {/* Thân voucher: Hiển thị đầy đủ chữ */}
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      setSelectedPromo(promotion);
                    } else {
                      handleSelectVoucher(promotion);
                    }
                  }}
                  disabled={isPending}
                  className="flex flex-col justify-center px-3.5 py-1.5 hover:opacity-95 text-left cursor-pointer whitespace-nowrap"
                  title={`${voucherCustomerTitle(promotion.title, promotion)} · ${
                    isActive ? "Đang áp dụng · Bấm để xem điều kiện" : "Bấm để áp dụng voucher này"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs leading-tight">
                    {isShipping ? (
                      <Truck size={14} className="shrink-0 text-teal-600" />
                    ) : (
                      <Ticket size={14} className="shrink-0 text-rose-600" />
                    )}
                    <span className={isShipping ? "text-slate-800" : "text-rose-600"}>
                      {headline}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                    <span>{subline}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPromo(promotion);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 underline font-normal shrink-0"
                      title="Xem điều kiện"
                    >
                      Chi tiết ›
                    </span>
                  </div>
                </button>

                {/* Nút hành động Lưu / Đang dùng / Dùng mã */}
                <div className="relative flex shrink-0 items-stretch">
                  {/* Rãnh khuyết trên tại đường đứt đoạn */}
                  <span
                    className={`pointer-events-none absolute -top-1.5 left-0 -translate-x-1/2 z-10 h-3 w-3 rounded-full border border-stone-200 ${
                      embedded ? "bg-stone-50" : "bg-white"
                    }`}
                    aria-hidden="true"
                  />
                  {/* Rãnh khuyết dưới tại đường đứt đoạn */}
                  <span
                    className={`pointer-events-none absolute -bottom-1.5 left-0 -translate-x-1/2 z-10 h-3 w-3 rounded-full border border-stone-200 ${
                      embedded ? "bg-stone-50" : "bg-white"
                    }`}
                    aria-hidden="true"
                  />

                  {isActive ? (
                    <span
                      className={`relative px-3 text-[11px] font-bold border-l border-dashed ${
                        isShipping ? "border-teal-200 text-teal-700" : "border-rose-200 text-rose-600"
                      } flex items-center justify-center shrink-0 select-none bg-white/80 whitespace-nowrap`}
                    >
                      ✓ Đang dùng
                    </span>
                  ) : isClaimed || !promotion.claimRequired ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSelectVoucher(promotion)}
                      className={`relative px-3 text-[11px] font-bold border-l border-dashed ${
                        isShipping ? "border-teal-200 bg-teal-600 hover:bg-teal-700" : "border-rose-200 bg-rose-600 hover:bg-rose-700"
                      } text-white flex items-center justify-center transition shrink-0 select-none cursor-pointer active:scale-95 whitespace-nowrap`}
                    >
                      {isPending ? "..." : "Dùng mã"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => claims.claim(promotion.id)}
                      className="relative px-3 text-[11px] font-bold border-l border-dashed border-rose-200 bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shrink-0 select-none cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      {isPending ? "..." : "Lưu"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />
      {voucherOpen && (
        <PdpVoucherSheet
          items={sheetEntries.map(e => e.promotion)}
          unavailable={unavailable}
          claimed={claims.claimedIds}
          pendingId={claims.pendingId}
          activePromoId={activePromoId}
          onClose={() => setVoucherOpen(false)}
          onDetails={p => {
            setVoucherOpen(false);
            setSelectedPromo(p);
          }}
          onClaim={(p) => {
            if (!user) setVoucherOpen(false);
            claims.claim(p.id);
          }}
          onSelectVoucher={(p) => {
            handleSelectVoucher(p);
            setVoucherOpen(false);
          }}
        />
      )}
      {/* Modal chi tiết điều kiện voucher */}
      {selectedPromo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedPromo(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {selectedPromo.benefitType === "shipping" ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Truck className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Ticket className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {voucherCustomerTitle(selectedPromo.title, selectedPromo) || "Ưu đãi giảm giá"}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedPromo.benefitType === "shipping" ? "Hỗ trợ phí vận chuyển" : "Giảm giá tiền hàng"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 text-xs text-slate-600 leading-relaxed">
              {selectedPromo.description && (
                <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700">
                  {selectedPromo.description}
                </p>
              )}

              <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mức giảm:</span>
                  <span className="font-semibold text-rose-600">
                    {selectedPromo.discountType === "percentage"
                      ? `Giảm ${pctText(selectedPromo)}${
                          selectedPromo.benefitType === "shipping" && selectedPromo.maxDiscountVnd
                            ? ` (Tối đa ${formatVnd(selectedPromo.maxDiscountVnd)})`
                            : ""
                        }`
                      : `Giảm ${formatVnd(selectedPromo.discountValue)}`}
                  </span>
                </div>

                {selectedPromo.benefitType === "shipping" && selectedPromo.minOrderThreshold ? (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Đơn tối thiểu:</span>
                    <span className="font-medium text-slate-800">
                      {formatVnd(selectedPromo.minOrderThreshold)}
                    </span>
                  </div>
                ) : null}

                {selectedPromo.endDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Hạn sử dụng:</span>
                    <span className="font-medium text-slate-800">
                      Đến hết {new Date(selectedPromo.endDate).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                )}

                {selectedPromo.minLeadDays && selectedPromo.minLeadDays >= 3 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Thời gian nhận hàng:</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                      Áp dụng khi chọn Chờ giao sau {selectedPromo.minLeadDays} ngày
                    </span>
                  </div>
                ) : null}

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hình thức áp dụng:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                    {selectedPromo.type === "auto" ? "Tự động áp dụng khi đạt đơn" : "Áp dụng tại bước thanh toán"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="w-full rounded-xl bg-[var(--aloha-green,#15803d)] py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
