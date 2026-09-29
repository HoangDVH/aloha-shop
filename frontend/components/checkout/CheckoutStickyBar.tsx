"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { formatVnd } from "@/lib/api";

type Props = {
  total: number;
  discount?: number;
  grandTotal: number;
  shippingFee: number | null;
  shippingDiscount?: number;
  deliveryMethod?: "giao_tan_noi" | "nhan_cua_hang";
  showShipping?: boolean;
  canSubmit: boolean;
  submitting: boolean;
  orderBlockedReason?: string;
  onPlaceOrder: () => void;
};

/**
 * Thanh cố định đáy màn hình (mobile).
 * Portal ra `document.body` để tránh cha có `transform` (animate-fade-up)
 * làm `position: fixed` bị kéo theo khi cuộn.
 */
export function CheckoutStickyBar({
  total,
  discount = 0,
  grandTotal,
  shippingFee,
  shippingDiscount = 0,
  deliveryMethod = "giao_tan_noi",
  showShipping = false,
  canSubmit,
  submitting,
  orderBlockedReason,
  onPlaceOrder,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--aloha-line)] bg-white px-3 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.1)] lg:hidden"
      style={{ position: "fixed" }}
    >
      <div className="mx-auto max-w-7xl space-y-2.5">
        <div className="space-y-1.5 text-[13px] text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền hàng</span>
            <span className="tabular-nums">{formatVnd(total)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
              <span>Giảm giá ưu đãi</span>
              <span className="tabular-nums">-{formatVnd(discount)}</span>
            </div>
          ) : null}
          {showShipping ? (
            deliveryMethod === "nhan_cua_hang" ? (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums text-slate-700">0đ (Nhận tại cửa hàng)</span>
              </div>
            ) : shippingFee != null ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>Phí vận chuyển tạm tính</span>
                  <span className="tabular-nums font-medium text-slate-700">{formatVnd(shippingFee)}</span>
                </div>
                {shippingDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
                    <span>Hỗ trợ phí ship</span>
                    <span className="tabular-nums">-{formatVnd(shippingDiscount)}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums font-medium text-amber-700">Chờ xác nhận</span>
              </div>
            )
          ) : null}
          <div className="border-t border-slate-200/90" />
          {deliveryMethod === "nhan_cua_hang" ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tiền thanh toán</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(Math.max(0, total - discount))}
              </span>
            </div>
          ) : shippingFee != null ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tạm tính</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(grandTotal)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Tiền hàng chưa gồm phí vận chuyển:</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(Math.max(0, total - discount))}
              </span>
            </div>
          )}
        </div>
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
