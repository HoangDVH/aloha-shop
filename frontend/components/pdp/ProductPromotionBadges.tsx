"use client";

import { useEffect, useState, useMemo } from "react";
import { Ticket, Truck, X, ArrowRight } from "lucide-react";
import { getAvailablePromotions, type AvailablePromotionUI } from "@/lib/promotions";
import type { ShopProduct } from "@/lib/api";
import { formatVnd } from "@/lib/api";
import { formatVoucherBadge, pctText } from "@/lib/voucherFormat";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { useToast } from "@/components/Toast";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { PdpVoucherSheet } from "./PdpVoucherSheet";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { pdpApplicableVouchers, pdpDefaultVouchers } from "@/lib/pdpVouchers";

interface ProductPromotionBadgesProps {
  product: ShopProduct;
  livePrice?: number;
  isWholesale?: boolean;
}

interface FormattedBadge {
  promotion: AvailablePromotionUI;
  label: string;
  type: "goods" | "shipping";
}

const formatBadgeText = (p: AvailablePromotionUI) => formatVoucherBadge(p);
function shipBadgeLabel(p: AvailablePromotionUI): string {
  if (p.discountType !== "fixed" || !(p.discountValue > 0)) return formatVoucherBadge(p).label;
  return `Hỗ trợ phí ship ${formatVnd(p.discountValue)}${p.minOrderThreshold ? ` đơn từ ${formatVnd(p.minOrderThreshold)}` : ""}`;
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

  const applicableBadges = useMemo<FormattedBadge[]>(() =>
    pdpDefaultVouchers(applicablePromotions, viewer).map(promotion => ({
      promotion,
      ...formatBadgeText(promotion),
      ...(promotion.benefitType === "shipping" ? { label: shipBadgeLabel(promotion) } : {}),
    })), [applicablePromotions, viewer]);

  if (!loaded || applicablePromotions.length === 0) {
    return null;
  }

  return (
    <>
      <section className="space-y-2 pt-1" aria-label="Voucher và khuyến mãi">
        <button type="button" onClick={() => setVoucherOpen(true)} className="flex min-h-9 w-full items-center justify-between text-left text-sm font-semibold text-slate-800" aria-haspopup="dialog"><span>Voucher &amp; khuyến mãi</span><ArrowRight size={15} className="text-slate-400" /></button>

        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          {applicableBadges.map(({ promotion, label, type }) => {
            const isShipping = type === "shipping";
            return (
              <button
                key={promotion.id}
                type="button"
                onClick={() => promotion.claimRequired && !claims.claimedIds.has(promotion.id) ? claims.claim(promotion.id) : setSelectedPromo(promotion)}
                disabled={Boolean(claims.pendingId)}
                title={`${promotion.title}${promotion.minOrderThreshold ? ` · Đơn từ ${formatVnd(promotion.minOrderThreshold)}` : ""} · ${promotion.claimRequired ? "Bấm để lưu voucher" : "Bấm xem điều kiện"}`}
                className={`flex min-h-14 w-[250px] sm:w-[270px] shrink-0 items-stretch overflow-hidden rounded-lg border text-left transition disabled:opacity-50 ${isShipping ? "border-[#bce9df] bg-[#f0fbf8] text-[#087a69] hover:bg-[#e4f7f1]" : "border-[#f4cfc2] bg-[#fff5ef] text-[#b5482d] hover:bg-[#ffede2]"}`}
              >
                <span className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-current/20 px-1 py-1 text-center">
                  {isShipping ? <Truck size={16} /> : <Ticket size={16} />}
                  <span className="w-full text-center text-[9px] font-medium leading-tight">{isShipping ? "Vận chuyển" : "Sản phẩm"}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-2">
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[10px] text-slate-500">{promotion.minOrderThreshold ? `Đơn từ ${formatVnd(promotion.minOrderThreshold)}` : "Không có mức tối thiểu"}</span>
                </span>
                <span className={`my-auto mr-2 shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${promotion.claimRequired && !claims.claimedIds.has(promotion.id) ? isShipping ? "bg-[#087a69] text-white" : "bg-[#bf4e32] text-white" : isShipping ? "bg-[#d9f2e9] text-[#087a69]" : "bg-[#ffe6d8] text-[#a63e20]"}`}>{promotion.claimRequired ? claims.pendingId === promotion.id ? "Đang lưu…" : claims.claimedIds.has(promotion.id) ? "Đã lưu" : "Nhận" : "Chi tiết"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />
      {voucherOpen && <PdpVoucherSheet items={applicablePromotions} claimed={claims.claimedIds} pendingId={claims.pendingId}
        onClose={() => setVoucherOpen(false)} onDetails={p => { setVoucherOpen(false); setSelectedPromo(p); }}
        onClaim={p => { if (!user) setVoucherOpen(false); claims.claim(p.id); }} />}
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
                    {selectedPromo.title || "Ưu đãi giảm giá"}
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
                          selectedPromo.maxDiscountVnd
                            ? ` (Tối đa ${formatVnd(selectedPromo.maxDiscountVnd)})`
                            : ""
                        }`
                      : `Giảm ${formatVnd(selectedPromo.discountValue)}`}
                  </span>
                </div>

                {selectedPromo.minOrderThreshold ? (
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
