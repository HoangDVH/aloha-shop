"use client";

import { Gift, Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { ShopOrder, ShopOrderDetail } from "@/lib/orders";

/** Nhãn "Quà tặng" / "Flash Sale" dưới tên sản phẩm trong đơn. */
export function OrderLineTags({ d }: { d: ShopOrderDetail }) {
  if (d.isGift) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-[#FFF1E6] px-1.5 py-0.5 text-[10px] font-bold text-[#C8102E]">
        <Gift size={11} aria-hidden /> Quà tặng{d.gift?.giftFor ? ` kèm ${d.gift.giftFor}` : ""} · 0đ
      </span>
    );
  }
  if (!d.flash) return null;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-[#C8102E]">
      <Zap size={11} aria-hidden className="fill-[#C8102E]" /> Flash Sale
      <span className="font-normal text-slate-400 line-through">{formatVnd(d.flash.listPrice)}</span>
    </span>
  );
}

/** Tiền hàng theo giá thường (để các dòng giảm cộng lại đúng tổng). */
export function orderListSubtotal(order: ShopOrder): number | null {
  if (order.subtotal == null) return null;
  return order.subtotal + (order.flashSavings || 0) + (order.anchorSavings || 0);
}

/** "Giảm giá sản phẩm" + "Giảm Flash Sale" + "Voucher shop" của đơn đã lưu. */
export function OrderGoodsSavings({ order }: { order: ShopOrder }) {
  return (
    <>
      {order.anchorSavings ? (
        <div className="flex justify-between font-semibold text-[var(--aloha-price)]">
          <span>Giảm giá sản phẩm</span>
          <span>-{formatVnd(order.anchorSavings)}</span>
        </div>
      ) : null}
      {order.flashSavings ? (
        <div className="flex justify-between font-semibold text-[var(--aloha-price)]">
          <span>Giảm Flash Sale</span>
          <span>-{formatVnd(order.flashSavings)}</span>
        </div>
      ) : null}
      {order.discount ? (
        <div className="flex justify-between font-semibold text-[var(--aloha-price)]">
          <span>Voucher shop</span>
          <span>-{formatVnd(order.discount)}</span>
        </div>
      ) : null}
    </>
  );
}

/** Tổng "Bạn đã tiết kiệm" = giá trước KM + flash + voucher + hỗ trợ ship, cùng số với lúc checkout. */
export function OrderSavedTotal({ order }: { order: ShopOrder }) {
  const saved =
    (order.anchorSavings || 0) + (order.flashSavings || 0) + (order.discount || 0) + (order.shippingDiscount || 0);
  if (saved <= 0) return null;
  return (
    <p className="rounded-lg bg-[var(--aloha-green-light)] px-3 py-1.5 text-center text-xs font-bold text-[var(--aloha-green-mid)]">
      Bạn đã tiết kiệm {formatVnd(saved)}
    </p>
  );
}
