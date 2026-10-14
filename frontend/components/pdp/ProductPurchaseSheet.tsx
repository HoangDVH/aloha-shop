"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, X, Truck, Ticket, Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { CountdownText } from "@/components/campaign/CountdownText";

export interface ProductPurchaseSheetProps {
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  voucherBadge?: string;
  voucherBadges?: { label: string; type: "shipping" | "goods" }[];
  campaignSale?: {
    isSale: boolean;
    title?: string;
    subtitle?: string;
    endsAt?: string;
    offsetMs?: number;
  };
  pending: boolean;
  disabled: boolean;
  status: string;
  selection: string;
  qty: number;
  maxQty: number;
  onQty: (qty: number) => void;
  onClose: () => void;
  onBuy: () => void;
  preOrder: boolean;
  children: ReactNode;
  summary?: ReactNode;
}

export function ProductPurchaseSheet({
  name,
  image,
  price,
  originalPrice,
  discountPercent = 0,
  voucherBadge,
  voucherBadges,
  campaignSale,
  pending,
  disabled,
  status,
  selection,
  qty,
  maxQty,
  onQty,
  onClose,
  onBuy,
  preOrder,
  children,
  summary,
}: ProductPurchaseSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const submitted = useRef(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [image]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    return () => {
      el.close();
      document.body.style.overflow = before;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-lg mx-auto overflow-hidden rounded-t-[24px] border-0 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[90dvh] flex-col overflow-hidden">
        {/* Header SP: Ảnh + Giá + Khuyến mãi + Đã chọn (chuẩn TikTok Shop) */}
        <div className="flex shrink-0 items-start gap-3.5 px-4 pb-3 pt-4 border-b border-stone-100/90">
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-stone-50 flex items-center justify-center">
            {image && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={name}
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-xs font-bold text-stone-400">
                ALOHA
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Dòng giá & badge giảm giá */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {discountPercent > 0 ? (
                <span className="rounded bg-[#FE2C55] px-1.5 py-0.5 text-xs font-black text-white">
                  -{discountPercent}%
                </span>
              ) : null}
              <p
                aria-live="polite"
                className="text-xl sm:text-2xl font-black tracking-tight text-[#FE2C55]"
              >
                {pending ? "Đang cập nhật…" : formatVnd(price)}
              </p>
              {/* Ticket icon chuẩn TikTok Shop */}
              {campaignSale?.isSale ? (
                <span className="inline-flex shrink-0 items-center text-[#FE2C55]" title="Ưu đãi áp dụng">
                  <svg
                    className="h-3.5 w-4.5 shrink-0"
                    viewBox="0 0 18 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path d="M1 3C1 1.89543 1.89543 1 3 1H15C16.1046 1 17 1.89543 17 3V5C16.1716 5 15.5 5.67157 15.5 6.5C15.5 7.32843 16.1716 8 17 8V11C17 12.1046 16.1046 13 15 13H3C1.89543 13 1 12.1046 1 11V8C1.82843 8 2.5 7.32843 2.5 6.5C2.5 5.67157 1.82843 5 1 5V3Z" />
                    <path d="M6 6.5L7.5 8L11.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
            </div>

            {/* Giá gốc gạch ngang */}
            {originalPrice && originalPrice > price ? (
              <p className="mt-0.5 text-xs text-stone-400 line-through">
                {formatVnd(originalPrice)}
              </p>
            ) : null}

            {/* Badges: Hiển thị đúng 2 voucher đang có sẵn (chuẩn TikTok Shop) */}
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {voucherBadges && voucherBadges.length > 0 ? (
                voucherBadges.slice(0, 2).map((v, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                      v.type === "shipping"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                        : "bg-rose-50 text-[#ff2442] border-rose-200/70"
                    }`}
                  >
                    {v.type === "shipping" ? (
                      <Truck size={10} strokeWidth={2.5} />
                    ) : (
                      <Ticket size={10} strokeWidth={2.5} />
                    )}
                    <span>{v.label}</span>
                  </span>
                ))
              ) : voucherBadge ? (
                <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-[#ff2442] border border-rose-200/70">
                  <Ticket size={10} strokeWidth={2.5} />
                  <span>{voucherBadge}</span>
                </span>
              ) : null}
            </div>

            {/* Biến thể đang chọn */}
            <p className="mt-1.5 text-xs font-medium text-stone-600 line-clamp-1">
              {selection ? `【${selection}】` : "Vui lòng chọn phân loại"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chọn sản phẩm"
            className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thanh Flash Sale nếu đang có ưu đãi (chuẩn TikTok Shop) */}
        {campaignSale && campaignSale.isSale ? (
          <div className="mx-4 mt-2.5 flex h-10 items-center justify-between rounded-xl bg-gradient-to-r from-[#FF1E44] via-[#FE2C55] to-[#FF4E00] px-3.5 text-white shadow-xs">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-tight">
              <Zap size={15} className="fill-white text-white shrink-0" />
              <span>{campaignSale.title || "Flash Sale"}</span>
            </div>
            {campaignSale.endsAt ? (
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold">
                <span className="text-white/90">Kết thúc sau</span>
                <CountdownText
                  target={Date.parse(campaignSale.endsAt)}
                  offsetMs={campaignSale.offsetMs ?? 0}
                  className="font-mono font-black tracking-tight text-white tabular-nums text-xs sm:text-[13px]"
                />
              </div>
            ) : (
              <span className="text-[11px] sm:text-xs font-bold text-white/95">
                {campaignSale.subtitle || "Ưu đãi có hạn"}
              </span>
            )}
          </div>
        ) : null}

        {/* Thân popup cuộn chọn Options (chuẩn TikTok Shop 3 cột) */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6 pt-3">
          {children}

          {/* Chọn số lượng */}
          <div className="mt-5 flex items-center justify-between gap-4 border-t border-stone-100 pt-4">
            <label htmlFor={`${titleId}-qty`} className="text-sm font-bold text-stone-900">
              Số lượng
            </label>
            <div className="flex items-center rounded-lg bg-stone-100 p-0.5">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={qty <= 1}
                onClick={() => onQty(qty - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-700 hover:bg-white disabled:text-stone-300 disabled:hover:bg-transparent transition"
              >
                <Minus size={15} />
              </button>
              <input
                id={`${titleId}-qty`}
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                step={1}
                value={qty}
                onChange={(e) =>
                  onQty(Math.min(maxQty, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                }
                className="h-8 w-11 bg-transparent text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={qty >= maxQty}
                onClick={() => onQty(qty + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-700 hover:bg-white disabled:text-stone-300 disabled:hover:bg-transparent transition"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {status ? (
            <p role="status" className="mt-2.5 text-xs text-stone-500">
              {status}
            </p>
          ) : null}

          {summary ? (
            <div className="mt-4">{summary}</div>
          ) : null}
        </div>

        {/* Nút Mua ngay to bo tròn đáy màn hình chuẩn TikTok Shop */}
        <div className="shrink-0 border-t border-stone-100 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (submitted.current) return;
              submitted.current = true;
              onBuy();
            }}
            className="flex min-h-[50px] w-full flex-col items-center justify-center rounded-full bg-[#ff2442] hover:bg-[#e01e38] px-5 py-2 text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
          >
            <span className="text-base font-extrabold leading-tight">
              {preOrder ? "Đặt trước ngay" : "Mua ngay"}
            </span>
            {!pending && !disabled && (
              <span className="mt-0.5 text-xs font-medium opacity-90">
                {formatVnd(price * qty)}
              </span>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
