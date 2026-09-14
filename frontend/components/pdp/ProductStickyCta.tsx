"use client";

import { formatVnd } from "@/lib/api";

type Props = {
  price: number;
  needPick: boolean;
  soldOut: boolean;
  purchaseDisabled: boolean;
  onAddCart: () => void;
  onBuyNow: () => void;
};

/** Thanh CTA cố định đáy màn hình (mobile) trên trang chi tiết SP. */
export function ProductStickyCta({
  price,
  needPick,
  soldOut,
  purchaseDisabled,
  onAddCart,
  onBuyNow,
}: Props) {
  return (
    <div className="shop-sticky-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aloha-line)] bg-white/95 px-3 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[var(--aloha-price)]">
            {formatVnd(price)}
          </p>
          {needPick ? (
            <p className="truncate text-[11px] text-amber-700">Chọn thuộc tính</p>
          ) : soldOut ? (
            <p className="truncate text-[11px] text-red-600">Hết hàng</p>
          ) : null}
        </div>
        {/* gap rõ + không dính cạnh — tránh bị gộp thành 1 khối trên mobile */}
        <div className="flex shrink-0 items-center" style={{ gap: 10 }}>
          <button
            type="button"
            disabled={purchaseDisabled}
            onClick={onAddCart}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--aloha-green-light)] px-3.5 text-xs font-bold text-[var(--aloha-green-mid)] disabled:opacity-40"
          >
            Thêm giỏ
          </button>
          <button
            type="button"
            disabled={purchaseDisabled}
            onClick={onBuyNow}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            Mua ngay
          </button>
        </div>
      </div>
    </div>
  );
}
