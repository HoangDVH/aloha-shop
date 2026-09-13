"use client";

import { Ticket } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { shopShowCheckoutShipping } from "@/lib/checkoutFlags";
import type { Delivery } from "./checkoutTypes";

type Props = {
  delivery: Delivery;
  total: number;
  shippingFee: number;
  shippingLoading: boolean;
  grandTotal: number;
  error: string;
  orderBlockedReason: string;
  canSubmit: boolean;
  submitting: boolean;
  agree: boolean;
  onAgreeChange: (v: boolean) => void;
  onPlaceOrder: () => void;
};

/**
 * Cột phải desktop: ưu đãi + chi tiết TT + Đặt hàng.
 * Mobile: ưu đãi (+ lỗi nếu có); tick đồng ý nằm ở sticky dưới tổng thanh toán.
 */
export function CheckoutSummaryAside({
  delivery,
  total,
  shippingFee,
  shippingLoading,
  grandTotal,
  error,
  orderBlockedReason,
  canSubmit,
  submitting,
  agree,
  onAgreeChange,
  onPlaceOrder,
}: Props) {
  const showShip = shopShowCheckoutShipping();

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <button
        type="button"
        onClick={() => window.alert("Ưu đãi sẽ sớm có — cảm ơn bạn đã chờ!")}
        className="flex w-full items-center justify-between rounded-[var(--aloha-radius-lg)] bg-white px-4 py-3 shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04]"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--aloha-ink)]">
          <Ticket size={18} className="text-[var(--aloha-green)]" />
          Ưu đãi
        </span>
        <span className="text-sm text-[var(--aloha-muted)]">Nhập ưu đãi ›</span>
      </button>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 lg:hidden">
          {error}
        </p>
      ) : null}

      {/* Desktop: chi tiết thanh toán đầy đủ */}
      <section className="hidden rounded-[var(--aloha-radius-lg)] bg-white p-5 shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] lg:block">
        <h2 className="mb-3 text-base font-extrabold text-[var(--aloha-ink)]">
          Chi tiết thanh toán
        </h2>
        <div className="space-y-2.5 text-[15px] text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền hàng</span>
            <span className="tabular-nums">{formatVnd(total)}</span>
          </div>
          {showShip && delivery === "giao_tan_noi" ? (
            <div className="flex items-center justify-between gap-3">
              <span>Phí vận chuyển</span>
              <span className="tabular-nums">
                {shippingLoading
                  ? "..."
                  : shippingFee > 0
                    ? formatVnd(shippingFee)
                    : "—"}
              </span>
            </div>
          ) : null}
          <div className="border-t border-slate-200/90" />
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền thanh toán</span>
            <span className="text-base font-bold tabular-nums text-[var(--aloha-price)]">
              {formatVnd(grandTotal)}
            </span>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => onAgreeChange(e.target.checked)}
            className="mt-0.5 accent-[var(--aloha-green)]"
          />
          <span>Tôi đồng ý với các Điều kiện giao dịch chung của website</span>
        </label>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {!error && orderBlockedReason ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {orderBlockedReason}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={onPlaceOrder}
          className="mt-4 w-full rounded-full bg-[var(--aloha-green)] py-3.5 text-sm font-bold text-white transition hover:bg-[var(--aloha-green-mid)] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Đang đặt hàng…" : "Đặt hàng"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
          {showShip
            ? "Đặt hàng lưu đơn trên web. Hóa đơn KiotViet chỉ tạo sau khi chuyển khoản thành công hoặc nhân viên xác nhận thanh toán."
            : "Đặt hàng COD — cửa hàng xử lý giao trên KiotViet. Bạn thanh toán khi nhận hàng."}
        </p>
      </section>
    </aside>
  );
}
