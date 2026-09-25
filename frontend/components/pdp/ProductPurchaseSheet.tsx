"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, X } from "lucide-react";
import { formatVnd } from "@/lib/api";

export function ProductPurchaseSheet({ name, image, price, pending, disabled, status, selection, qty, maxQty, onQty, onClose, onBuy, preOrder, children }: {
  name: string; image?: string; price: number; pending: boolean; disabled: boolean;
  status: string; selection: string; qty: number; maxQty: number; onQty: (qty: number) => void;
  onClose: () => void; onBuy: () => void; preOrder: boolean; children: ReactNode;
}) {
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
    return () => { el.close(); document.body.style.overflow = before; };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-[28px] border-0 bg-white p-0 text-stone-900 backdrop:bg-black/50">
    <div className="flex max-h-[90dvh] flex-col">
      <div className="flex shrink-0 items-start gap-4 px-5 pb-4 pt-6">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-stone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && !imageFailed ? <img src={image} alt={name} onError={() => setImageFailed(true)} className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center text-xs text-stone-400">ALOHA</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="text-2xl font-bold tracking-tight text-[#e91e50]">{pending ? "Đang cập nhật giá…" : formatVnd(price)}</p>
          <h2 id={titleId} className="mt-1 line-clamp-2 text-sm text-stone-700">{name}</h2>
          <p className="mt-2 text-xs text-stone-500">{selection}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chọn sản phẩm" className="-mr-2 -mt-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500"><X size={23} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-2">
        {children}
        <div className="mt-7 flex items-center justify-between gap-4">
          <label htmlFor={`${titleId}-qty`} className="font-semibold">Số lượng</label>
          <div className="flex items-center rounded-lg bg-stone-100">
            <button type="button" aria-label="Giảm số lượng" disabled={qty <= 1} onClick={() => onQty(qty - 1)} className="flex h-11 w-11 items-center justify-center disabled:text-stone-300"><Minus size={19} /></button>
            <input id={`${titleId}-qty`} type="number" inputMode="numeric" min={1} max={maxQty} step={1} value={qty}
              onChange={e => onQty(Math.min(maxQty, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
              className="h-8 w-12 border-x border-stone-200 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" aria-label="Tăng số lượng" disabled={qty >= maxQty} onClick={() => onQty(qty + 1)} className="flex h-11 w-11 items-center justify-center disabled:text-stone-300"><Plus size={19} /></button>
          </div>
        </div>
        <p role="status" className="mt-3 text-sm text-stone-500">{status}</p>
      </div>
      <div className="shrink-0 border-t border-stone-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={disabled} onClick={() => { if (submitted.current) return; submitted.current = true; onBuy(); }}
          className="flex min-h-14 w-full flex-col items-center justify-center rounded-full bg-[#ff2855] px-5 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-40">
          <span className="text-base font-bold">{preOrder ? "Đặt trước ngay" : "Mua ngay"}</span>
          {!pending && !disabled && <span className="mt-0.5 text-xs">{formatVnd(price * qty)} · {qty} sản phẩm</span>}
        </button>
      </div>
    </div>
  </dialog>;
}
