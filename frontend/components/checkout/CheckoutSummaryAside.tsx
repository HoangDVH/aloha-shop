"use client";

import { Ticket } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { shopShowCheckoutShipping } from "@/lib/checkoutFlags";
import { SmartFreeshipBar } from "@/components/cart/SmartFreeshipBar";
import type { Delivery } from "./checkoutTypes";

type Props = {
  delivery: Delivery;
  total: number;
  discount?: number;
  /** Giảm do giá flash so với giá thường (`total` là tiền hàng giá thường). */
  flashDiscount?: number;
  /** Giá trước KM − giá web: chỉ hiển thị, không trừ thêm (`total` đã là giá web). */
  anchorDiscount?: number;
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
  discount = 0,
  flashDiscount = 0,
  anchorDiscount = 0,
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
  canSubmit,
  submitting,
  onPlaceOrder,
}: Props) {
  const showShip = shopShowCheckoutShipping();
  const goodsAfter = Math.max(0, total - flashDiscount - discount);
  const saved = anchorDiscount + flashDiscount + discount + (showShip ? shippingDiscount : 0);

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      {delivery === "giao_tan_noi" ? (
        <div className="lg:hidden">
          <SmartFreeshipBar currentAmount={goodsAfter} variant="compact" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpenPromotion}
        className="flex w-full items-center justify-between rounded-[var(--aloha-radius-lg)] bg-white px-4 py-3 shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] transition hover:bg-slate-50 cursor-pointer text-left"
      >
        {discount > 0 ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)] shrink-0">
              <Ticket size={18} />
            </div>
            <div>
              <span className="text-sm font-bold text-[var(--aloha-ink)]">
                Đã giảm {formatVnd(discount)}
              </span>
              {appliedTitle ? (
                <span className="block text-[11px] text-[var(--aloha-green)] font-semibold truncate max-w-[200px]">
                  {appliedTitle}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--aloha-ink)]">
            <Ticket size={18} className="text-[var(--aloha-green)]" />
            Ưu đãi
          </span>
        )}
        <span className="text-sm font-medium text-[var(--aloha-green)]">
          {discount > 0 ? "Xem/Đổi ›" : "Nhập ưu đãi ›"}
        </span>
      </button>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 lg:hidden">
          {error}
        </p>
      ) : null}

      {/* Desktop: chi tiết thanh toán đầy đủ */}
      <section className="rounded-[var(--aloha-radius-lg)] bg-white p-5 shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] hidden lg:block">
        <h2 className="mb-3 text-base font-extrabold text-[var(--aloha-ink)]">
          Chi tiết thanh toán
        </h2>
        {delivery === "giao_tan_noi" ? (
          <SmartFreeshipBar currentAmount={goodsAfter} variant="compact" className="mb-3.5" />
        ) : null}
        <div className="space-y-2.5 text-[15px] text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền hàng</span>
            <span className="tabular-nums">{formatVnd(total + anchorDiscount)}</span>
          </div>
          {anchorDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
              <span>Giảm giá sản phẩm</span>
              <span className="tabular-nums">-{formatVnd(anchorDiscount)}</span>
            </div>
          ) : null}
          {flashDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
              <span>Giảm Flash Sale</span>
              <span className="tabular-nums">-{formatVnd(flashDiscount)}</span>
            </div>
          ) : null}
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
              <span>Voucher shop</span>
              <span className="tabular-nums">-{formatVnd(discount)}</span>
            </div>
          ) : null}
          {showShip ? (
            delivery === "nhan_cua_hang" ? (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums text-slate-700">0đ (Nhận tại cửa hàng)</span>
              </div>
            ) : shippingLoading ? (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums text-slate-400">Đang tính…</span>
              </div>
            ) : shippingFee != null ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>Phí vận chuyển tạm tính</span>
                  {freeShipApplied && shippingFee === 0 ? (
                    <span className="tabular-nums font-medium text-emerald-700">0đ (Miễn phí vận chuyển)</span>
                  ) : (
                    <span className="tabular-nums font-medium text-slate-700">{formatVnd(shippingFee)}</span>
                  )}
                </div>
                {shippingDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
                    <span className="min-w-0 truncate" title={shippingPromotionTitle}>
                      {shippingPromotionTitle || "Hỗ trợ phí ship"}
                    </span>
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

          {/* Dòng tổng theo Section 7.2 */}
          {delivery === "nhan_cua_hang" ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tiền thanh toán</span>
              <span className="text-base font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(goodsAfter)}
              </span>
            </div>
          ) : shippingFee != null ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tạm tính</span>
              <span className="text-base font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(grandTotal)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700 leading-snug">Tiền hàng chưa gồm phí vận chuyển:</span>
              <span className="text-base font-bold tabular-nums text-[var(--aloha-price)]">
                {formatVnd(goodsAfter)}
              </span>
            </div>
          )}
          {saved > 0 ? (
            <p className="rounded-lg bg-[var(--aloha-green-light)] px-3 py-1.5 text-center text-xs font-bold text-[var(--aloha-green-mid)]">
              Bạn đã tiết kiệm {formatVnd(saved)}
            </p>
          ) : null}
        </div>

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
          className="mt-4 w-full rounded-full bg-[var(--aloha-green)] py-3.5 text-sm font-bold text-white transition hover:bg-[var(--aloha-green-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Đang gửi…" : "Đặt hàng"}
        </button>
      </section>
    </aside>
  );
}
