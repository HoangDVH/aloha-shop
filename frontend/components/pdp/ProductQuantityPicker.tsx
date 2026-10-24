"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Check } from "lucide-react";
import { formatTonDisplay, stockMax } from "@/lib/cart";
import { useToast } from "@/components/Toast";

export function ProductPreOrderDiscountBar({
  purchaseDisabled,
}: {
  purchaseDisabled: boolean;
}) {
  const toast = useToast();
  const [deliverySpeed, setDeliverySpeed] = useState<"standard" | "delayed_3d">(() => {
    if (typeof window !== "undefined") {
      try {
        const s = sessionStorage.getItem("aloha_delivery_speed");
        if (s === "delayed_3d") return "delayed_3d";
      } catch {}
    }
    return "standard";
  });

  useEffect(() => {
    const onSpeedChanged = (e: any) => {
      const speed = e?.detail?.speed || (typeof window !== "undefined" ? sessionStorage.getItem("aloha_delivery_speed") : null);
      if (speed === "delayed_3d" || speed === "standard") {
        setDeliverySpeed(speed);
      }
    };
    window.addEventListener("aloha-delivery-speed-changed", onSpeedChanged);
    return () => window.removeEventListener("aloha-delivery-speed-changed", onSpeedChanged);
  }, []);

  const handleTogglePreOrderDiscount = () => {
    const nextSpeed = deliverySpeed === "delayed_3d" ? "standard" : "delayed_3d";
    try {
      sessionStorage.setItem("aloha_delivery_speed", nextSpeed);
      sessionStorage.setItem("aloha_delivery_speed_user_explicit", "true");
      window.dispatchEvent(new CustomEvent("aloha-delivery-speed-changed", { detail: { speed: nextSpeed } }));
    } catch {}
    setDeliverySpeed(nextSpeed);
    if (nextSpeed === "delayed_3d") {
      toast.push("Đã chọn nhận hàng sau 3 ngày · Giảm ngay 10% tiền hàng!");
    } else {
      toast.push("Đã chuyển về giao ngay tiêu chuẩn");
    }
  };

  if (purchaseDisabled) return null;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={deliverySpeed === "delayed_3d"}
      onClick={handleTogglePreOrderDiscount}
      className={`group w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 transition cursor-pointer select-none active:scale-[0.99] border ${
        deliverySpeed === "delayed_3d"
          ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-600/25 shadow-2xs"
          : "border-stone-200 bg-white hover:border-emerald-500 text-slate-800 shadow-2xs"
      }`}
      title={
        deliverySpeed === "delayed_3d"
          ? "Đang chọn ưu đãi giảm 10% đặt trước · Bấm để hủy"
          : "Bấm tick chọn để nhận ưu đãi giảm 10% khi nhận hàng sau 3 ngày"
      }
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Ô vuông Checkbox chuẩn */}
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md transition border ${
            deliverySpeed === "delayed_3d"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
              : "border-stone-300 bg-white group-hover:border-emerald-500 shadow-2xs"
          }`}
        >
          {deliverySpeed === "delayed_3d" && (
            <Check size={11} className="stroke-[3.5]" />
          )}
        </span>

        {/* Nội dung thanh ưu đãi */}
        <div className="leading-tight truncate text-xs sm:text-sm">
          {deliverySpeed === "delayed_3d" ? (
            <span className="font-bold text-emerald-900 truncate">
              Đặt hàng trước nhận hàng sau 3 ngày:{" "}
              <span className="font-semibold text-emerald-700">(Đã giảm 10%)</span>
            </span>
          ) : (
            <span className="font-medium text-slate-700 truncate">
              Đặt hàng trước nhận hàng sau 3 ngày:{" "}
              <span className="font-bold text-rose-600">Giảm ngay 10%</span>
            </span>
          )}
        </div>
      </div>

      {/* Tag trạng thái bên phải */}
      <span
        className={`shrink-0 ml-2 text-xs font-semibold transition leading-none ${
          deliverySpeed === "delayed_3d"
            ? "text-emerald-700 font-bold"
            : "text-slate-400 group-hover:text-emerald-700"
        }`}
      >
        {deliverySpeed === "delayed_3d" ? "✓ Đã áp dụng" : "Bấm chọn ›"}
      </span>
    </button>
  );
}

export function ProductQuantityPicker({
  purchaseDisabled,
  qty,
  setQty,
  allowBackorder,
  liveTon,
  unit = "",
  isPreOrder = false,
  hidePreorderBar = false,
}: {
  purchaseDisabled: boolean;
  qty: number;
  setQty: Dispatch<SetStateAction<number>>;
  allowBackorder?: boolean;
  liveTon: number;
  unit?: string;
  isPreOrder?: boolean;
  hidePreorderBar?: boolean;
}) {
  const maxStock = stockMax(liveTon);
  const isOutOfStock = maxStock === 0;

  return (
    <div className="space-y-2.5">
      {/* Dòng 1: Chọn số lượng mua và hiển thị tình trạng tồn kho */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
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

        {/* Thông tin tồn kho chuẩn mực */}
        {isOutOfStock ? (
          <span className="text-xs font-semibold text-amber-700">
            Hàng đặt trước
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

      {/* Dòng 2: Thanh Ưu Đãi Đặt Trước 10% (trên mobile hiển thị dưới picker, trên desktop đưa vào Hộp Ưu Đãi Hợp Nhất) */}
      {!hidePreorderBar && (
        <div className="lg:hidden">
          <ProductPreOrderDiscountBar purchaseDisabled={purchaseDisabled} />
        </div>
      )}
    </div>
  );
}
