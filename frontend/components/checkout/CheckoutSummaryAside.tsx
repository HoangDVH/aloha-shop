"use client";

import { ChevronRight, Ticket } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { OrderPaymentSummary } from "./OrderPaymentSummary";
import type { Delivery } from "./checkoutTypes";
import { usePendingValue } from "@/lib/usePendingValue";

type Props = {
  delivery: Delivery;
  total: number;
  totalPending?: boolean;
  priceScopeKey?: string;
  discount?: number;
  /** Giảm do giá flash so với giá thường (`total` là tiền hàng giá thường). */
  flashDiscount?: number;
  volumeDiscount?: number;
  /** Giá trước KM − giá web: chỉ hiển thị, không trừ thêm (`total` đã là giá web). */
  anchorDiscount?: number;
  wholesaleDiscount?: number;
  appliedTitle?: string;
  voucherPromo?: { discountType?: string; discountValue?: number } | null;
  onOpenPromotion?: () => void;
  shippingFee: number | null;
  shippingDiscount?: number;
  shippingPromotionTitle?: string;
  shippingPromotionHint?: string;
  freeShipApplied?: boolean;
  shippingLoading: boolean;
  grandTotal: number;
  error: string;
  orderBlockedReason: string;
  minimumNoticeShown?: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onPlaceOrder: () => void;
};

/**
 * Cột phải desktop: ưu đãi + chi tiết TT + Đặt hàng.
 * Mobile: ưu đãi (+ lỗi nếu có).
 */
export function CheckoutSummaryAside({
  delivery,
  total,
  totalPending = false,
  priceScopeKey = "",
  discount = 0,
  flashDiscount = 0,
  volumeDiscount = 0,
  anchorDiscount = 0,
  wholesaleDiscount = 0,
  appliedTitle,
  voucherPromo,
  onOpenPromotion,
  shippingFee,
  shippingDiscount = 0,
  shippingPromotionTitle,
  shippingPromotionHint,
  freeShipApplied = false,
  shippingLoading,
  grandTotal,
  error,
  orderBlockedReason,
  minimumNoticeShown = false,
  canSubmit,
  submitting,
  onPlaceOrder,
}: Props) {
  const promotion = usePendingValue({ discount, appliedTitle }, totalPending, priceScopeKey);
  const visibleDiscount = promotion?.discount ?? 0;
  const pricePending = totalPending || (delivery === "giao_tan_noi" && shippingLoading);
  const displayAction = usePendingValue({ canSubmit, orderBlockedReason }, pricePending, priceScopeKey);
  const amountText = formatVnd;

  return (
    <aside className="space-y-2 sm:space-y-4 lg:sticky lg:top-24 lg:self-start">
      <button
        type="button"
        aria-busy={totalPending}
        onClick={onOpenPromotion}
        className="flex w-full items-center justify-between bg-white px-4 py-3 sm:py-3.5 sm:rounded-[var(--aloha-radius-lg)] sm:shadow-[var(--aloha-shadow)] sm:ring-1 sm:ring-black/[0.04] transition hover:bg-slate-50 cursor-pointer text-left"
      >
          <div className={`flex min-h-10 items-center gap-2.5 transition-opacity motion-reduce:transition-none ${totalPending ? "opacity-60" : "opacity-100"}`}>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-[var(--aloha-price)] shrink-0 sm:h-8 sm:w-8 sm:rounded-full sm:bg-[var(--aloha-green-light)] sm:text-[var(--aloha-green)]">
              <Ticket size={17} />
            </div>
            <div>
              <span className="text-[13px] sm:text-sm font-bold text-stone-900">
                {visibleDiscount > 0 ? `Đã giảm ${amountText(visibleDiscount)}` : "Ưu đãi từ shop"}
              </span>
                <span className="block min-h-4 text-[11px] text-[var(--aloha-green)] font-semibold truncate max-w-[200px]">
                  {promotion?.appliedTitle}
                </span>
            </div>
          </div>
        <div className="flex items-center gap-1">
          {visibleDiscount > 0 ? (
            <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-[var(--aloha-price)]">
              -{amountText(visibleDiscount)}
            </span>
          ) : (
            <span className="text-xs sm:text-sm font-medium text-[var(--aloha-green)]">
              Nhập ưu đãi
            </span>
          )}
          <ChevronRight size={16} className="text-stone-400" />
        </div>
      </button>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 lg:hidden">
          {error}
        </p>
      ) : null}

      {/* Chi tiết thanh toán / Tóm tắt đơn hàng dùng chung cho mobile và desktop. */}
      <OrderPaymentSummary total={total} totalPending={totalPending} priceScopeKey={priceScopeKey} discount={discount}
        flashDiscount={flashDiscount} volumeDiscount={volumeDiscount} anchorDiscount={anchorDiscount} wholesaleDiscount={wholesaleDiscount}
        delivery={delivery} shippingFee={shippingFee} shippingDiscount={shippingDiscount}
        shippingPromotionTitle={shippingPromotionTitle} freeShipApplied={freeShipApplied}
        shippingLoading={shippingLoading} grandTotal={grandTotal}>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {!error && !minimumNoticeShown && displayAction?.orderBlockedReason ? (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-2 text-xs text-amber-900 flex items-start gap-1.5 leading-tight">
            <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
            <span>{displayAction.orderBlockedReason}</span>
          </div>
        ) : null}

        <button
          type="button"
          disabled={submitting || pricePending}
          onClick={onPlaceOrder}
          className={`hidden lg:block mt-4 w-full rounded-full py-3.5 text-sm font-bold text-white transition active:scale-98 cursor-pointer ${
            displayAction && !displayAction.canSubmit
              ? "bg-amber-600 hover:bg-amber-700 shadow-xs"
              : "bg-[var(--aloha-green)] hover:bg-[var(--aloha-green-hover)] shadow-sm"
          }`}
        >
          {submitting ? "Đang gửi…" : displayAction && !displayAction.canSubmit ? minimumNoticeShown ? "Mua thêm để đủ điều kiện" : "Hoàn tất thông tin để đặt hàng" : "Đặt hàng"}
        </button>
      </OrderPaymentSummary>
    </aside>
  );
}
