"use client";

import type { ReactNode } from "react";
import { formatVnd } from "@/lib/api";
import { formatAppliedVoucherTitle } from "@/lib/voucherFormat";
import { shopShowCheckoutShipping } from "@/lib/checkoutFlags";
import { SmartFreeshipBar } from "@/components/cart/SmartFreeshipBar";
import { usePendingValue } from "@/lib/usePendingValue";
import { PriceUpdateIndicator } from "./PriceUpdateIndicator";
import type { Delivery } from "./checkoutTypes";

type Props = {
  total: number;
  totalPending?: boolean;
  priceScopeKey?: string;
  discount?: number;
  voucherTitle?: string;
  voucherPromo?: {
    title?: string;
    discountType?: "percentage" | "fixed";
    discountValue?: number;
    discountAmount?: number;
    code?: string;
    minLeadDays?: number;
  } | null;
  flashDiscount?: number;
  volumeDiscount?: number;
  anchorDiscount?: number;
  wholesaleDiscount?: number;
  delivery?: Delivery;
  shippingFee?: number | null;
  shippingDiscount?: number;
  shippingPromotionTitle?: string;
  freeShipApplied?: boolean;
  shippingLoading?: boolean;
  grandTotal: number;
  cart?: boolean;
  showFreeshipProgress?: boolean;
  children?: ReactNode;
};

/** One price breakdown for cart and checkout, at every viewport size. */
export function OrderPaymentSummary({ total: liveTotal, totalPending = false, discount: liveDiscount = 0,
  voucherTitle: liveVoucherTitle, voucherPromo: liveVoucherPromo,
  flashDiscount: liveFlash = 0, volumeDiscount: liveVolume = 0, anchorDiscount: liveAnchor = 0, wholesaleDiscount: liveWholesale = 0,
  delivery = "giao_tan_noi", shippingFee: liveShippingFee = null, shippingDiscount: liveShipDiscount = 0,
  shippingPromotionTitle: liveShipTitle, freeShipApplied: liveFreeShip = false, shippingLoading = false,
  grandTotal: liveGrandTotal, cart = false, showFreeshipProgress = true, children, priceScopeKey = "" }: Props) {
  const showShip = shopShowCheckoutShipping();
  const shippingPending = !cart && showShip && delivery === "giao_tan_noi" && (shippingLoading || totalPending);
  const pending = totalPending || shippingPending;
  const goods = usePendingValue({ total: liveTotal, discount: liveDiscount, flashDiscount: liveFlash,
    volumeDiscount: liveVolume, anchorDiscount: liveAnchor, wholesaleDiscount: liveWholesale,
    voucherTitle: liveVoucherTitle, voucherPromo: liveVoucherPromo }, totalPending, priceScopeKey);
  const { total, discount, flashDiscount, volumeDiscount, anchorDiscount, wholesaleDiscount, voucherTitle, voucherPromo } = goods || {
    total: 0, discount: 0, flashDiscount: 0, volumeDiscount: 0, anchorDiscount: 0, wholesaleDiscount: 0,
    voucherTitle: undefined, voucherPromo: null,
  };
  const shipping = usePendingValue({ shippingFee: liveShippingFee, shippingDiscount: liveShipDiscount,
    shippingPromotionTitle: liveShipTitle, freeShipApplied: liveFreeShip, grandTotal: liveGrandTotal },
    pending, `${priceScopeKey}:${delivery}`);
  const { shippingFee, shippingDiscount, shippingPromotionTitle, freeShipApplied, grandTotal } = shipping || {
    shippingFee: null, shippingDiscount: 0, shippingPromotionTitle: undefined, freeShipApplied: false, grandTotal: 0,
  };
  const goodsBeforeVoucher = Math.max(0, total - flashDiscount);
  const goodsAfter = Math.max(0, goodsBeforeVoucher - discount);
  const amountText = (value: number) => goods ? formatVnd(value) : "—";
  const appliedVoucherLabel = formatAppliedVoucherTitle(voucherPromo, voucherTitle);
  const savings = wholesaleDiscount + anchorDiscount + volumeDiscount + flashDiscount + discount + (showShip ? shippingDiscount : 0);
  const saved = usePendingValue(savings, pending, priceScopeKey) ?? 0;
  const fading = "transition-opacity duration-150 motion-reduce:transition-none";
  return (
      <section className="w-full bg-white px-4 py-3 sm:p-5 sm:rounded-[var(--aloha-radius-lg)] sm:shadow-[var(--aloha-shadow)] sm:ring-1 sm:ring-black/[0.04]">
        <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
          <h2 className="min-w-0 text-[15px] sm:text-base font-extrabold text-[var(--aloha-ink)]">Tóm tắt đơn hàng</h2>
          <PriceUpdateIndicator pending={pending} />
        </div>
        {showFreeshipProgress && delivery === "giao_tan_noi" ? (
          <div aria-busy={pending} className={`mb-3.5 min-h-20 ${fading} ${pending ? "opacity-60" : "opacity-100"}`}>
            {goods ? <SmartFreeshipBar currentAmount={goodsBeforeVoucher} appliedDiscount={shippingDiscount} variant="compact" /> : <div className="h-20 rounded-xl bg-slate-50" />}
          </div>
        ) : null}
        <div className="min-h-[240px] space-y-3 text-sm text-slate-600 [&_.tabular-nums]:shrink-0 [&_.tabular-nums]:whitespace-nowrap [&_.tabular-nums]:leading-5">
          <div data-price-region="goods" aria-busy={totalPending} className={`space-y-3 ${fading} ${totalPending ? "opacity-60" : "opacity-100"}`}>
          <div className="flex items-center justify-between gap-3">
            <span>Giá gốc sản phẩm</span>
            <span className="tabular-nums">{amountText(total + anchorDiscount + volumeDiscount + wholesaleDiscount)}</span>
          </div>
          {wholesaleDiscount > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 font-medium">Ưu đãi giá sỉ so với giá web</span>
              <span className="tabular-nums font-semibold text-emerald-700">-{amountText(wholesaleDiscount)}</span>
            </div>
          )}
          {anchorDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 font-medium">Giảm giá sản phẩm</span>
              <span className="tabular-nums font-semibold text-emerald-700">-{amountText(anchorDiscount)}</span>
            </div>
          ) : null}
          {volumeDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 font-medium">Giảm theo số lượng</span>
              <span className="tabular-nums font-semibold text-emerald-700">-{amountText(volumeDiscount)}</span>
            </div>
          ) : null}
          {flashDiscount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 font-medium">Giảm Flash Sale</span>
              <span className="tabular-nums font-semibold text-emerald-700">-{amountText(flashDiscount)}</span>
            </div>
          ) : null}
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-slate-600 font-medium" title={appliedVoucherLabel}>{appliedVoucherLabel}</span>
              <span className="tabular-nums font-semibold text-emerald-700">-{amountText(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 font-bold text-slate-800"><span>Tiền hàng sau ưu đãi</span><span className="tabular-nums">{amountText(goodsAfter)}</span></div>
          </div>
          <div data-price-region="shipping" aria-busy={shippingPending} className={`${fading} ${shippingPending ? "opacity-60" : "opacity-100"}`}>
          {cart ? <div className="flex items-start justify-between gap-3 text-xs text-slate-500"><span>Phí vận chuyển</span><span className="max-w-[60%] text-right">Tính tại bước xác nhận đơn</span></div> : showShip ? (
            delivery === "nhan_cua_hang" ? (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums text-slate-700">0đ (Nhận tại cửa hàng)</span>
              </div>
            ) : shippingPending && !shipping ? (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums text-slate-400">Đang tính…</span>
              </div>
            ) : shippingFee != null ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>Phí vận chuyển</span>
                  {freeShipApplied && shippingFee === 0 ? (
                    <span className="tabular-nums font-medium text-emerald-700">0đ (Miễn phí vận chuyển)</span>
                  ) : (
                    <span className="tabular-nums font-medium text-slate-700">{amountText(shippingFee)}</span>
                  )}
                </div>
                {shippingDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-600 font-medium" title={shippingPromotionTitle}>
                      {shippingPromotionTitle || "Hỗ trợ phí ship"}
                    </span>
                    <span className="tabular-nums font-semibold text-emerald-700">-{amountText(shippingDiscount)}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>Phí vận chuyển</span>
                <span className="tabular-nums font-medium text-slate-500">Chờ xác nhận</span>
              </div>
            )
          ) : null}

          </div>
          <div className="border-t border-slate-200/90" />

          <div data-price-region="total" aria-busy={pending} className={`${fading} ${pending ? "opacity-60" : "opacity-100"}`}>
            <div className="flex min-h-12 items-center justify-between gap-3">
              <span className="min-w-0 font-semibold text-slate-700">{delivery === "nhan_cua_hang" ? "Tổng thanh toán" : "Tổng tạm tính"}</span>
              <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums text-[var(--aloha-price)]">
                {pending && !shipping ? "—" : amountText(delivery === "nhan_cua_hang" || shippingFee == null ? goodsAfter : grandTotal)}
              </span>
            </div>
            <p className="mt-1 min-h-4 text-xs text-slate-400">{delivery === "nhan_cua_hang" ? "Nhận tại cửa hàng" : shippingFee == null ? "Chưa gồm phí vận chuyển" : "Đã gồm phí vận chuyển"}</p>
          </div>
          {saved > 0 ? (
            <p aria-busy={pending} className={`rounded-lg bg-[var(--aloha-green-light)] px-3 py-1.5 text-center text-xs font-bold text-[var(--aloha-green-mid)] ${fading} ${pending ? "opacity-60" : "opacity-100"}`}>
              Bạn đã tiết kiệm {amountText(saved)}
            </p>
          ) : null}
        </div>

        {children}
      </section>
  );
}
