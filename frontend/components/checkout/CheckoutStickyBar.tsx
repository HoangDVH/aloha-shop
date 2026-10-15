"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { useStickyBarHeight } from "@/lib/floatingStack";
import { usePendingValue } from "@/lib/usePendingValue";
import { PriceUpdateIndicator } from "./PriceUpdateIndicator";
import { formatVnd } from "@/lib/api";

type Props = {
  total: number;
  totalPending?: boolean;
  goodsPending?: boolean;
  priceScopeKey?: string;
  discount?: number;
  volumeDiscount?: number;
  flashDiscount?: number;
  productDiscount?: number;
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
  totalPending = false,
  goodsPending = totalPending,
  priceScopeKey = "",
  discount = 0,
  volumeDiscount = 0,
  flashDiscount = 0,
  productDiscount = 0,
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
  const confirmed = usePendingValue({ total, discount, volumeDiscount, flashDiscount, productDiscount,
    grandTotal, shippingFee, shippingDiscount, canSubmit, orderBlockedReason }, totalPending, `${priceScopeKey}:${deliveryMethod}`);
  const displayCanSubmit = totalPending ? confirmed?.canSubmit ?? true : canSubmit;
  const displayBlockedReason = totalPending ? confirmed?.orderBlockedReason : orderBlockedReason;
  const hasDisplayValue = !totalPending || Boolean(confirmed);
  if (totalPending) {
    total = confirmed?.total ?? 0;
    discount = confirmed?.discount ?? 0;
    volumeDiscount = confirmed?.volumeDiscount ?? 0;
    flashDiscount = confirmed?.flashDiscount ?? 0;
    productDiscount = confirmed?.productDiscount ?? 0;
    grandTotal = confirmed?.grandTotal ?? 0;
    shippingFee = confirmed?.shippingFee ?? null;
    shippingDiscount = confirmed?.shippingDiscount ?? 0;
  }
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailId = useId();
  const amount = deliveryMethod === "nhan_cua_hang" || shippingFee == null ? Math.max(0, total - discount) : grandTotal;
  const amountText = (value: number) => hasDisplayValue ? formatVnd(value) : "—";
  const voucherDiscount = Math.max(0, discount - volumeDiscount - flashDiscount - productDiscount);
  const totalLabel = deliveryMethod === "nhan_cua_hang" ? "Tổng thanh toán" : shippingFee == null ? "Tiền hàng (chưa gồm ship)" : "Tổng tạm tính";
  const stickyRef = useStickyBarHeight<HTMLDivElement>();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = (
    <div
      ref={stickyRef}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--aloha-line)] bg-white px-3 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.1)] lg:hidden"
      style={{ position: "fixed" }}
    >
      <div className="mx-auto max-w-7xl space-y-2.5">
        {detailsOpen ? <div id={detailId} aria-busy={totalPending} className="max-h-[40dvh] space-y-1.5 overflow-y-auto text-[13px] text-slate-500">
          <div data-price-region="goods" aria-busy={goodsPending} className={`space-y-1.5 transition-opacity motion-reduce:transition-none ${goodsPending ? "opacity-60" : "opacity-100"}`}>
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền hàng</span>
            <span className="tabular-nums">{amountText(total)}</span>
          </div>
          {productDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Giảm giá sản phẩm</span><span>-{amountText(productDiscount)}</span></div>}
          {volumeDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Giảm theo số lượng</span><span>-{amountText(volumeDiscount)}</span></div>}
          {flashDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Giảm Flash Sale</span><span>-{amountText(flashDiscount)}</span></div>}
          {voucherDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
              <span>Voucher tiền hàng</span>
              <span className="tabular-nums">-{amountText(voucherDiscount)}</span>
            </div>
          ) : null}
          </div>
          <div data-price-region="shipping" aria-busy={totalPending} className={`transition-opacity motion-reduce:transition-none ${totalPending ? "opacity-60" : "opacity-100"}`}>
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
                  <span className="tabular-nums font-medium text-slate-700">{amountText(shippingFee)}</span>
                </div>
                {shippingDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-3 text-[var(--aloha-price)] font-semibold">
                    <span>Hỗ trợ phí ship</span>
                    <span className="tabular-nums">-{amountText(shippingDiscount)}</span>
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
          </div>
          <div className="border-t border-slate-200/90" />
          {deliveryMethod === "nhan_cua_hang" ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tiền thanh toán</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {amountText(Math.max(0, total - discount))}
              </span>
            </div>
          ) : shippingFee != null ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng tạm tính</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {amountText(grandTotal)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Tiền hàng chưa gồm phí vận chuyển:</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--aloha-price)]">
                {amountText(Math.max(0, total - discount))}
              </span>
            </div>
          )}
        </div> : null}
        {!displayCanSubmit && displayBlockedReason ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200/90 px-2.5 py-1.5 text-[11px] leading-tight text-amber-900 flex items-center gap-1.5 shadow-2xs">
            <span className="shrink-0 text-amber-600">⚠️</span>
            <span className="truncate">{displayBlockedReason}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <button type="button" aria-expanded={detailsOpen} aria-controls={detailId} onClick={() => setDetailsOpen(v => !v)} className="min-h-11 min-w-0 flex-1 text-left">
            <span className="flex min-h-5 items-center gap-1 text-[11px] text-slate-500">{totalLabel}<PriceUpdateIndicator pending={totalPending} compact /></span>
            <span aria-busy={totalPending} className={`block whitespace-nowrap text-base font-bold tabular-nums text-[var(--aloha-price)] transition-opacity motion-reduce:transition-none ${totalPending ? "opacity-60" : "opacity-100"}`}>{amountText(amount)}</span>
            <span className="block text-[11px] text-[var(--aloha-green)]">{detailsOpen ? "Thu gọn" : "Xem chi tiết"}</span>
          </button>
        <button
          type="button"
          disabled={submitting || totalPending}
          onClick={onPlaceOrder}
          className={`flex min-h-12 min-w-[110px] shrink-0 flex-col items-center justify-center rounded-xl px-4 py-3 text-white transition active:scale-95 shadow-xs cursor-pointer ${
            !displayCanSubmit
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-[var(--aloha-green)] hover:bg-[var(--aloha-green-hover)]"
          }`}
        >
          <span className="text-[14px] sm:text-[15px] font-extrabold leading-none">
            {submitting ? "Đang gửi…" : !displayCanSubmit ? "Cần thông tin" : "Đặt hàng"}
          </span>
        </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(bar, document.body);
}
