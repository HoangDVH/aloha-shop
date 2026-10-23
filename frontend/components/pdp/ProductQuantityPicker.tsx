"use client";
import type { Dispatch, SetStateAction } from "react";
import { formatTonDisplay, stockMax } from "@/lib/cart";

export function ProductQuantityPicker({
  purchaseDisabled,
  qty,
  setQty,
  allowBackorder,
  liveTon,
  unit = "",
  isPreOrder = false,
}: {
  purchaseDisabled: boolean;
  qty: number;
  setQty: Dispatch<SetStateAction<number>>;
  allowBackorder?: boolean;
  liveTon: number;
  unit?: string;
  isPreOrder?: boolean;
}) {
  const maxStock = stockMax(liveTon);
  const isOutOfStock = maxStock === 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 sm:gap-x-4">
      <span className="text-xs sm:text-sm font-semibold text-slate-700 shrink-0">
        Số lượng mua
      </span>

      {/* Stepper gọn gàng 32px theo chuẩn Shopee/TikTok Shop */}
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-200/90 bg-white shadow-2xs">
        <button
          type="button"
          aria-label="Giảm số lượng"
          className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-600 transition hover:bg-stone-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={purchaseDisabled || qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={
            purchaseDisabled || allowBackorder !== false
              ? 10000
              : Math.max(1, liveTon)
          }
          value={qty}
          onChange={(e) => {
            const n = Math.max(1, Number(e.target.value) || 1);
            if (purchaseDisabled) {
              setQty(1);
              return;
            }
            if (allowBackorder !== false) {
              setQty(Math.min(10000, Math.floor(n)));
              return;
            }
            setQty(Math.min(n, Math.max(1, liveTon)));
          }}
          className="h-8 w-11 border-x border-stone-200/90 bg-white text-center text-xs sm:text-sm font-bold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Tăng số lượng"
          className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-600 transition hover:bg-stone-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={
            purchaseDisabled || qty >= 10000 || (allowBackorder === false && qty >= liveTon)
          }
          onClick={() =>
            setQty((q) =>
              allowBackorder !== false
                ? Math.min(10000, q + 1)
                : Math.min(Math.max(1, liveTon), q + 1)
            )
          }
        >
          +
        </button>
      </div>

      {/* Tồn kho nằm ngay trên cùng hàng ngang, không rớt dòng */}
      {isOutOfStock ? (
        <span className="text-xs font-semibold text-amber-700">
          Sản phẩm đã hết hàng, cần đặt trước
        </span>
      ) : isPreOrder ? (
        <span className="text-xs font-medium text-amber-700">
          Cần đặt trước
        </span>
      ) : !purchaseDisabled && liveTon > 0 ? (
        <span className="text-xs text-slate-500">
          Còn <span className="font-semibold text-slate-700">{formatTonDisplay(liveTon)}</span> {unit ? unit.toLowerCase() : ""}
        </span>
      ) : null}
    </div>
  );
}
