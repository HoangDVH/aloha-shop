"use client";
import { voucherCustomerTitle } from "@/lib/voucherFormat";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Gift, TicketPercent, Truck, Zap, X } from "lucide-react";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { cleanVoucherTitle, formatCompactVnd, pctText, voucherUseHref } from "@/lib/voucherFormat";
import { formatVnd } from "@/lib/api";
import type { ClaimState } from "@/components/voucher/ClaimButton";
import { CompactVoucherCard, ProductScopedVoucherCard } from "@/components/voucher/ProductScopedVoucherCard";
import { openVoucherModal } from "@/lib/campaign/useVoucherModal";
export function tikTokDiscountText(v: CampaignVoucherUI): string {
  if (v.discountType === "percentage") {
    return `Giảm ${pctText(v)}`;
  }
  return `Giảm ${formatVnd(v.discountValue)}`;
}

export function tikTokMinOrderText(v: CampaignVoucherUI): string {
  if (v.benefitType !== "shipping") return "";
  if (v.minOrderThreshold && v.minOrderThreshold > 0) {
    return `Đơn từ ${formatVnd(v.minOrderThreshold)}`;
  }
  return "Đơn từ 0đ";
}

function TikTokLargeVoucherCard({
  v,
  state,
  claims,
}: {
  v: CampaignVoucherUI;
  state: ClaimState;
  claims: ReturnType<typeof useVoucherClaims>;
}) {
  if (v.scope === "product") return <ProductScopedVoucherCard voucher={v} state={state} pending={claims.pendingId === v.id} onClaim={() => claims.claim(v.id)} />;
  const isShip = v.benefitType === "shipping";
  const isClaimed = state === "claimed" || state === "auto";
  const discountText = tikTokDiscountText(v);
  const minOrderText = tikTokMinOrderText(v);
  const title = cleanVoucherTitle(v);

  return (
    <div
      className={`relative flex min-h-[100px] w-full overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs ${
        state === "soldOut" ? "opacity-60" : ""
      }`}
    >
      {/* Cuống trái to */}
      <div
        className={`flex w-[76px] shrink-0 flex-col items-center justify-center p-2 border-r border-dashed ${
          isShip
            ? "bg-[#E6F8F6] text-[#00B5A5] border-[#B2EBE6]"
            : "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
        }`}
      >
        {isShip ? (
          <Truck size={22} strokeWidth={2.2} />
        ) : (
          <TicketPercent size={22} strokeWidth={2.2} />
        )}
        <span className="mt-1 text-[10.5px] font-bold leading-tight">
          {isShip ? "Vận chuyển" : "Sản phẩm"}
        </span>
      </div>

      {/* Vết khuyết bán nguyệt (Notches) */}
      <span className="pointer-events-none absolute -top-1.5 left-[76px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200" />
      <span className="pointer-events-none absolute -bottom-1.5 left-[76px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200" />

      {/* Thân thẻ */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 pl-3.5 relative">
        {/* Góc trên phải: x4 badge nếu có */}
        {v.claimLimitTotal && v.claimLimitTotal > 1 ? (
          <span
            className={`absolute right-2.5 top-2 rounded-xs px-1 text-[9px] font-black text-white ${
              isShip ? "bg-[#00B5A5]" : "bg-[#FE2C55]"
            }`}
          >
            x{v.claimLimitTotal}
          </span>
        ) : null}

        {/* Header tag */}
        <div className="flex items-center gap-1.5 pr-8">
          {isShip ? (
            <span className="rounded-xs bg-[#00B5A5] px-1 py-0.5 text-[8.5px] font-black uppercase text-white leading-none">
              XTRA
            </span>
          ) : (
            <span className="rounded-xs border border-rose-300 bg-rose-50/80 px-1 py-0.5 text-[8.5px] font-bold text-[#FE2C55] leading-none">
              Quy đổi giới hạn
            </span>
          )}
          <span className="text-[10.5px] font-medium text-slate-500">
            Từ Aloha Shop
          </span>
        </div>

        {/* Khối tiêu đề voucher + giá trị + nút */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* TIÊU ĐỀ VOUCHER */}
            <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-1" title={voucherCustomerTitle(v.title) || title}>
              {title}
            </h4>

            {/* MỨC GIẢM & ĐIỀU KIỆN */}
            <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
              <span
                className={`text-[15px] font-black leading-tight shrink-0 ${
                  isShip ? "text-[#008A7E]" : "text-[#FE2C55]"
                }`}
              >
                {discountText}
              </span>
              <span className="text-[11px] text-slate-600 font-medium leading-tight">
                · {minOrderText}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
              Cho sản phẩm đủ điều kiện
            </p>
          </div>

          <div className="shrink-0">
            {isClaimed ? (
              <Link
                href={voucherUseHref(v.id)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold border transition ${
                  isShip
                    ? "border-[#00B5A5] text-[#00B5A5] bg-cyan-50/40"
                    : "border-[#FE2C55] text-[#FE2C55] bg-rose-50/40"
                }`}
              >
                Dùng ngay
              </Link>
            ) : (
              <button
                type="button"
                disabled={claims.pendingId === v.id || state === "soldOut"}
                onClick={() => claims.claim(v.id)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer ${
                  isShip ? "bg-[#00B5A5] hover:bg-[#009E90]" : "bg-[#FE2C55] hover:bg-[#E01E43]"
                }`}
              >
                {claims.pendingId === v.id ? "…" : "Nhận"}
              </button>
            )}
          </div>
        </div>

        {/* Chú thích đáy */}
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
          <span>Áp dụng khi mua hàng tại Aloha</span>
          <span className="text-slate-500 hover:text-slate-700 cursor-pointer">
            Điều khoản & điều kiện
          </span>
        </div>
      </div>
    </div>
  );
}

export function TikTokMobileVoucherStrip({
  vouchers,
  claims,
  states,
}: {
  vouchers: CampaignVoucherUI[];
  claims: ReturnType<typeof useVoucherClaims>;
  states: Map<string, ClaimState>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const shippingVouchers = vouchers.filter((v) => v.benefitType === "shipping");
  const sellerVouchers = vouchers.filter((v) => v.benefitType !== "shipping");

  return (
    <div id="kho-voucher-mobile" className="space-y-2 rounded-2xl bg-white p-3 shadow-2xs border border-rose-100/70">
      {/* 1. Header: Voucher & khuyến mãi > (Mở popup voucher) */}
      <div
        onClick={() => openVoucherModal()}
        className="flex items-center justify-between py-1 px-1 cursor-pointer select-none active:opacity-75 transition-opacity"
      >
        <h3 className="text-[15px] font-black tracking-tight text-slate-900">
          Voucher & khuyến mãi
        </h3>
        <div className="flex items-center text-slate-400 hover:text-slate-700">
          <ChevronRight size={18} strokeWidth={2.2} />
        </div>
      </div>

      {/* 2. Dải cuộn ngang voucher cards chuẩn TikTok Shop (Ảnh 1) */}
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {vouchers.map(v => <div key={v.id} className="w-[270px] max-w-[calc(100vw-40px)] shrink-0"><CompactVoucherCard voucher={v} state={states.get(v.id)!} pending={claims.pendingId === v.id} onClaim={() => claims.claim(v.id)} /></div>)}

      </div>

      {/* 3. Bottom Sheet Modal khi bấm vào header / nút > (Ảnh 2 chuẩn TikTok Shop) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          {/* Backdrop tối mờ */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Khung Sheet */}
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-[26px] bg-white shadow-2xl transition-transform animate-in slide-in-from-bottom duration-300">
            {/* Header Modal */}
            <div className="relative flex items-center justify-center border-b border-stone-100 px-4 py-3.5">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Voucher & khuyến mãi
              </h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="absolute right-3.5 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            {/* Thông điệp chính sách TikTok Shop */}
            <div className="px-4 py-2.5 bg-stone-50/80 border-b border-stone-100 text-[11px] text-slate-500 leading-relaxed">
              Áp 1 voucher vận chuyển và 1 voucher giảm giá cho đơn hàng. Voucher đã nhận sẽ tự động áp dụng khi thanh toán. Có áp dụng điều khoản.
            </div>

            {/* Danh sách cuộn */}
            <div className="overflow-y-auto px-4 py-3.5 pb-12 space-y-4">
              {/* Nhóm 1: Voucher vận chuyển */}
              {shippingVouchers.length > 0 && (
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-900 mb-2.5">
                    Voucher vận chuyển
                  </h4>
                  <div className="space-y-3">
                    {shippingVouchers.map((v) => (
                      <TikTokLargeVoucherCard
                        key={v.id}
                        v={v}
                        state={states.get(v.id) as ClaimState}
                        claims={claims}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm 2: Voucher người bán */}
              {sellerVouchers.length > 0 && (
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-900 mb-2.5">
                    Voucher người bán
                  </h4>
                  <div className="space-y-3">
                    {sellerVouchers.map((v) => (
                      <TikTokLargeVoucherCard
                        key={v.id}
                        v={v}
                        state={states.get(v.id) as ClaimState}
                        claims={claims}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
