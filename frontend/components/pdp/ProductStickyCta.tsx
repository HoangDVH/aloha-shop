"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { useCart } from "@/lib/cart";

type Props = {
  price: number;
  pricePending?: boolean;
  needPick: boolean;
  preOrder?: boolean;
  purchaseDisabled: boolean;
  buyDisabled?: boolean;
  onAddCart: () => void;
  onBuyNow: () => void;
};

/** Thanh CTA cố định đáy màn hình (mobile) trên trang chi tiết SP. */
export function ProductStickyCta({
  price,
  pricePending = false,
  needPick,
  preOrder = false,
  purchaseDisabled,
  buyDisabled = purchaseDisabled,
  onAddCart,
  onBuyNow,
}: Props) {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aloha-line)] bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5">
        <Link
          href="/gio-hang"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--aloha-line)] bg-white text-[var(--aloha-ink)] transition hover:bg-[var(--aloha-cream)] active:scale-95"
          aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
        >
          <ShoppingCart size={19} strokeWidth={1.85} />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-terracotta,#EE6055)] px-1 text-[10px] font-black text-white ring-2 ring-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight text-[var(--aloha-price)]">
            {pricePending ? "Đang cập nhật…" : price > 0 ? formatVnd(price) : "Liên hệ báo giá"}
          </p>
          {needPick ? (
            <p className="truncate text-[11px] leading-tight text-amber-700">Chọn thuộc tính</p>
          ) : preOrder ? (
            <p className="truncate text-[11px] leading-tight text-amber-700">Đặt trước — chờ Aloha xác nhận</p>
          ) : null}
        </div>
        {/* gap rõ + không dính cạnh — tránh bị gộp thành 1 khối trên mobile */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={purchaseDisabled}
            onClick={onAddCart}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--aloha-green-light)] px-3 text-xs font-bold text-[var(--aloha-green-mid)] disabled:opacity-40 active:scale-95"
          >
            {preOrder ? "Đặt trước" : "Thêm giỏ"}
          </button>
          <button
            type="button"
            disabled={buyDisabled}
            onClick={onBuyNow}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-3.5 text-xs font-bold text-white shadow-sm disabled:opacity-40 active:scale-95"
          >
            {preOrder ? "Đặt ngay" : "Mua ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
