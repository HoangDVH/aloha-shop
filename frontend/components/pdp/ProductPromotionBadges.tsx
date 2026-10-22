"use client";
import { voucherCustomerTitle } from "@/lib/voucherFormat";

import { useEffect, useState, useMemo } from "react";
import { Ticket, Truck, X, ChevronRight } from "lucide-react";
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

interface ProductPromotionBadgesProps {
  product: ShopProduct;
  livePrice?: number;
  isWholesale?: boolean;
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
      headline: `Giảm ${val}`,
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
}: ProductPromotionBadgesProps) {
  const [promotions, setPromotions] = useState<AvailablePromotionUI[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<AvailablePromotionUI | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const claims = useVoucherClaims();
  const toast = useToast();
  const { user } = useShopAuth();
  const { viewer } = useCampaignView();
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

  const sheetEntries = pdpVoucherSheetEntries(promotions, product, viewer, claims.claimedIds, isWholesale);
  const unavailable = Object.fromEntries(sheetEntries.filter(e => e.reason).map(e => [e.promotion.id, e.reason!]));

  useEffect(() => {
    if (!loaded) return;
    const hasClaimedLeadPromo = promotions.some(
      (p) => claims.claimedIds.has(p.id) && (p.minLeadDays || 0) >= 3
    );
    if (hasClaimedLeadPromo) {
      try {
        if (sessionStorage.getItem("aloha_delivery_speed") !== "delayed_3d") {
          sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
          window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "delayed_3d" } }));
        }
      } catch {}
    }
  }, [loaded, promotions, claims.claimedIds]);

  if (!loaded || sheetEntries.length === 0) {
    return null;
  }

  return (
    <>
      <section
        className="my-3.5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-3 sm:p-3.5 space-y-2.5 shadow-xs"
        aria-label="Voucher và khuyến mãi"
      >
        {delayedPromo ? (
          <div className="flex items-center gap-2 py-2 px-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-xs text-emerald-900">
            <span className="shrink-0 text-base leading-none">🎁</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-emerald-800 leading-snug">
                Ưu đãi đặt trước: Giảm {pctText(delayedPromo)} khi chọn Chờ giao sau {delayedPromo.minLeadDays || 3} ngày tại giỏ hàng
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold text-slate-800">Voucher &amp; khuyến mãi</span>
          <button
            type="button"
            onClick={() => setVoucherOpen(true)}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--aloha-green,#15803d)] hover:underline cursor-pointer"
            aria-haspopup="dialog"
          >
            <span>Xem tất cả ({sheetEntries.length})</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap py-0.5">
          {applicableBadges.map(({ promotion, headline, subline, type }) => {
            const isShipping = type === "shipping";
            const isDelayed = (promotion.minLeadDays || 0) >= 3;
            const isClaimed = claims.claimedIds.has(promotion.id);
            const isPending = claims.pendingId === promotion.id;

            return (
              <div
                key={promotion.id}
                className={`inline-flex shrink-0 items-stretch rounded-xl border text-xs overflow-hidden transition select-none shadow-2xs ${
                  isShipping
                    ? "border-teal-200 bg-teal-50/70 text-teal-900"
                    : isDelayed
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                    : "border-orange-200 bg-orange-50/70 text-orange-950"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (promotion.claimRequired && !isClaimed) {
                      claims.claim(promotion.id);
                      if (isDelayed) {
                        try {
                          sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
                          window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "delayed_3d" } }));
                        } catch {}
                      }
                    } else {
                      setSelectedPromo(promotion);
                    }
                  }}
                  disabled={isPending}
                  className="flex flex-col justify-center px-3 py-1.5 hover:opacity-85 text-left cursor-pointer min-w-[130px] sm:min-w-[145px]"
                  title={`${voucherCustomerTitle(promotion.title, promotion)} · Bấm để xem điều kiện`}
                >
                  <div className="flex items-center gap-1 font-bold text-xs leading-tight">
                    {isShipping ? (
                      <Truck size={13} className="shrink-0 text-teal-600" />
                    ) : isDelayed ? (
                      <span className="shrink-0 text-xs leading-none">🎁</span>
                    ) : (
                      <Ticket size={13} className="shrink-0 text-orange-600" />
                    )}
                    <span className="whitespace-nowrap">{headline}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                    {subline}
                  </div>
                </button>

                {promotion.claimRequired && (
                  <button
                    type="button"
                    disabled={isPending || isClaimed}
                    onClick={() => {
                      claims.claim(promotion.id);
                      if (isDelayed) {
                        try {
                          sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
                          window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "delayed_3d" } }));
                        } catch {}
                      }
                    }}
                    className={`px-2.5 text-[11px] font-bold border-l border-dashed border-current/20 flex items-center justify-center transition shrink-0 ${
                      isClaimed
                        ? "bg-black/5 opacity-60 cursor-default"
                        : isShipping
                        ? "bg-teal-700 text-white hover:bg-teal-800 cursor-pointer"
                        : isDelayed
                        ? "bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer"
                        : "bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
                    }`}
                  >
                    {isPending ? "..." : isClaimed ? "Đã lưu" : "Lưu"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />
      {voucherOpen && <PdpVoucherSheet items={sheetEntries.map(e => e.promotion)} unavailable={unavailable} claimed={claims.claimedIds} pendingId={claims.pendingId}
        onClose={() => setVoucherOpen(false)} onDetails={p => { setVoucherOpen(false); setSelectedPromo(p); }}
        onClaim={(p) => {
          if (!user) setVoucherOpen(false);
          claims.claim(p.id);
          if ((p.minLeadDays || 0) >= 3) {
            try {
              sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
              window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: "delayed_3d" } }));
            } catch {}
          }
        }} />}
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
