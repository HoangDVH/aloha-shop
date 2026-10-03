"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Sparkles, ShoppingBag, Check, ArrowRight, Lightbulb } from "lucide-react";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { voucherConditionText } from "@/lib/voucherFormat";
import { voucherIconAndTone } from "./VoucherVault";
import type { TicketTone } from "./VoucherTicket";

function vnDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const STUB_GRADIENT: Record<TicketTone, string> = {
  green: "bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#115E59] text-white",
  red: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  bronze: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  peach: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  cream: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  gray: "bg-slate-200 text-slate-500",
};

export type ClaimSuccessModalProps = {
  voucher: CampaignVoucherUI | null;
  open: boolean;
  onClose: () => void;
  targetHref?: string;
  onShopNow?: () => void;
};

/**
 * Modal chúc mừng lưu mã voucher thành công chuẩn sàn TMĐT (Shopee / TikTok Shop).
 * Hiển thị thẻ vé coupon mini, thông điệp tự động áp dụng và nút "Mua sắm ngay" chuyển hướng tới trang ưu đãi.
 */
export function ClaimSuccessModal({
  voucher,
  open,
  onClose,
  targetHref = "/uu-dai?tab=deal-hot",
  onShopNow,
}: ClaimSuccessModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lắng nghe phím ESC và khóa scroll body khi mở modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open || !voucher) return null;

  const { icon, tone, stubTopLabel, stubValue } = voucherIconAndTone(voucher);
  const condition = voucherConditionText(voucher);
  const headline = voucher.title || "Voucher ưu đãi";

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-success-title"
    >
      <div
        className="aloha-modal-spring relative w-full max-w-[420px] rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-black/5 text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng tròn góc trên */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          aria-label="Đóng popup"
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        {/* 1. Icon chúc mừng với hiệu ứng nảy & confetti burst */}
        <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[#165A36] text-white shadow-lg shadow-emerald-600/30 aloha-badge-glow aloha-confetti-burst">
          <Sparkles size={28} strokeWidth={2.2} />
        </div>

        {/* 2. Tiêu đề chúc mừng */}
        <h3 id="claim-success-title" className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
          ĐÃ LƯU MÃ THÀNH CÔNG!
        </h3>
        <p className="mt-1 text-xs sm:text-[13px] text-slate-500 font-medium">
          Mã ưu đãi đã được thêm vào ví voucher của bạn
        </p>

        {/* 3. Thẻ coupon vé thu nhỏ (Perforated ticket) */}
        <div className="my-4 flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden text-left relative">
          {/* Cuống vé màu đậm bên trái */}
          <div
            className={`relative flex w-[96px] sm:w-[104px] shrink-0 flex-col items-center justify-center p-2.5 text-center select-none ${STUB_GRADIENT[tone]}`}
          >
            <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-white/95 leading-tight">
              {icon}
              <span>{stubTopLabel}</span>
            </div>
            <span className="mt-1 text-2xl font-black tracking-tight leading-none text-white drop-shadow-sm">
              {stubValue}
            </span>

            {/* Vết cắt khuyết tròn trên đỉnh */}
            <span
              className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white border border-slate-200/80 shadow-inner z-10"
              aria-hidden="true"
            />
            {/* Vết cắt khuyết tròn dưới đáy */}
            <span
              className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full bg-white border border-slate-200/80 shadow-inner z-10"
              aria-hidden="true"
            />
            {/* Đường gân đứt nét phân cách cuống vé và thân vé */}
            <div className="absolute right-0 top-2 bottom-2 w-0 border-r border-dashed border-white/40 z-10" />
          </div>

          {/* Thân vé bên phải */}
          <div className="relative flex flex-1 flex-col justify-center min-w-0 p-3 pl-3.5 bg-slate-50/50">
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 break-words" title={headline}>
              {headline}
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium truncate">
              {condition}
            </p>
            {voucher.endDate ? (
              <p className="mt-0.5 text-[11px] text-slate-400">
                HSD: {vnDate(voucher.endDate)}
              </p>
            ) : null}
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <Check size={12} strokeWidth={3} className="shrink-0" />
              <span>Sẵn sàng áp dụng</span>
            </div>
          </div>
        </div>

        {/* 4. Mẹo sàn TMĐT: Yên tâm tự động trừ tiền */}
        <div className="mb-4.5 rounded-xl bg-emerald-50/80 border border-emerald-100/90 p-2.5 text-left text-xs text-emerald-950 flex items-start gap-2">
          <Lightbulb size={16} className="shrink-0 text-emerald-600 mt-0.5" />
          <p className="leading-relaxed">
            Hệ thống sẽ <strong className="font-bold text-emerald-800">tự động kích hoạt mức giảm tối đa</strong> khi bạn thêm sản phẩm vào giỏ và tiến hành thanh toán!
          </p>
        </div>

        {/* 5. Nút Mua ngay (Dẫn đến trang ưu đãi) & Nút phụ */}
        <div className="space-y-2">
          <Link
            href={targetHref}
            onClick={() => {
              onShopNow?.();
              onClose();
            }}
            className="aloha-voucher-shine relative overflow-hidden group flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#165A36] to-[#0F3822] text-sm sm:text-[15px] font-black tracking-wide text-white shadow-md shadow-[#165A36]/25 hover:brightness-110 active:scale-[0.98] transition select-none cursor-pointer"
          >
            <ShoppingBag size={18} strokeWidth={2.4} />
            <span>MUA SẮM NGAY</span>
            <ArrowRight size={16} strokeWidth={2.6} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[32px] items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-800 transition py-1 cursor-pointer"
          >
            Lưu tiếp mã khác
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
