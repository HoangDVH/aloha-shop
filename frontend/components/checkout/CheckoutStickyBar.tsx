"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { formatVnd } from "@/lib/api";

type Props = {
  total: number;
  grandTotal: number;
  shippingFee?: number;
  showShipping?: boolean;
  canSubmit: boolean;
  submitting: boolean;
  orderBlockedReason?: string;
  agree: boolean;
  onAgreeChange: (v: boolean) => void;
  onPlaceOrder: () => void;
};

/**
 * Thanh cố định đáy màn hình (mobile).
 * Portal ra `document.body` để tránh cha có `transform` (animate-fade-up)
 * làm `position: fixed` bị kéo theo khi cuộn.
 */
export function CheckoutStickyBar({
  total,
  grandTotal,
  shippingFee = 0,
  showShipping = false,
  canSubmit,
  submitting,
  orderBlockedReason,
  agree,
  onAgreeChange,
  onPlaceOrder,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = (
    <div
      className="shop-sticky-bottom fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--aloha-line)] bg-white px-3 pt-3 shadow-[0_-8px_28px_rgba(0,0,0,0.1)] lg:hidden"
      style={{ position: "fixed" }}
    >
      <div className="mx-auto max-w-7xl space-y-2.5">
        <div className="space-y-1.5 text-[13px] text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền hàng</span>
            <span className="tabular-nums">{formatVnd(total)}</span>
          </div>
          {showShipping ? (
            <div className="flex items-center justify-between gap-3">
              <span>Phí vận chuyển</span>
              <span className="tabular-nums">
                {shippingFee > 0 ? formatVnd(shippingFee) : "—"}
              </span>
            </div>
          ) : null}
          <div className="border-t border-slate-200/90" />
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền thanh toán</span>
            <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
              {formatVnd(grandTotal)}
            </span>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-slate-600">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => onAgreeChange(e.target.checked)}
            className="mt-0.5 shrink-0 accent-[var(--aloha-green)]"
          />
          <span>Tôi đồng ý với các Điều kiện giao dịch chung của website</span>
        </label>
        {!canSubmit && orderBlockedReason ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-amber-800">
            {orderBlockedReason}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onPlaceOrder}
          className="flex w-full flex-col items-center justify-center rounded-full bg-[var(--aloha-green)] px-4 py-3 text-white shadow-sm transition hover:bg-[var(--aloha-green-hover)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <span className="text-[15px] font-extrabold leading-none">
            {submitting ? "Đang gửi…" : "Đặt hàng"}
          </span>
          <span className="mt-1 text-[11px] font-medium leading-none opacity-90">
            {submitting
              ? "Vui lòng chờ trong giây lát"
              : "Aloha gửi ảnh xác nhận trước khi đóng gói"}
          </span>
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(bar, document.body);
}
