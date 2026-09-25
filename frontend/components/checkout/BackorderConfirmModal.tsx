"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ImageIcon, ShieldCheck, X } from "lucide-react";
import { formatVnd } from "@/lib/api";

export type PolicyConfirmLine = {
  ma: string;
  ten: string;
  qty: number;
  dvt?: string;
  anh?: string;
};

function PolicyProductImage({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200/70 bg-white sm:h-14 sm:w-14">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={56} height={56} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : <ImageIcon size={22} className="text-stone-300" aria-hidden />}
    </span>
  );
}

/**
 * Xác nhận trước khi đặt — áp dụng mọi đơn.
 * Đồng ý mới tạo đơn web và đẩy đơn đặt hàng KiotViet.
 */
export function PreOrderCodConfirmModal({
  open,
  total,
  lines = [],
  onAgree,
  onClose,
  submitting = false,
  error = "",
}: {
  open: boolean;
  total: number;
  lines?: PolicyConfirmLine[];
  onAgree: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, submitting, onClose]);

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-policy-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[600px] flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:max-h-[calc(100dvh-48px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              <ShieldCheck size={15} className="text-[var(--aloha-green)]" aria-hidden />
              Chính sách Aloha
            </p>
            <h3
              id="order-policy-title"
              className="mt-2 text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-[28px]"
            >
              Xác nhận đặt hàng
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={submitting}
            onClick={onClose}
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-800 disabled:opacity-40"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
          <p className="rounded-2xl border border-[#e9e3d6] bg-[#faf8f2] px-4 py-4 text-[15px] leading-7 text-stone-700 sm:px-5">
            ALOHA sẽ kiểm tra sản phẩm và gửi hình ảnh thực tế cho bạn xác nhận
            trước khi đóng gói. Sau khi bạn xác nhận hình ảnh thực tế, ALOHA gửi
            hướng dẫn thanh toán trước toàn bộ đơn hàng hoặc đặt cọc tối thiểu
            bằng phí ship. Bạn có đồng ý chính sách này và tiếp tục đặt hàng
            không?
          </p>

          {lines.length ? (
            <ul className="divide-y divide-stone-200/60 rounded-2xl border border-stone-200/70 bg-stone-50/70 px-3 sm:px-4">
              {lines.map((line) => (
                <li
                  key={line.ma}
                  className="flex items-center gap-2.5 py-2.5"
                >
                  <PolicyProductImage src={line.anh} />
                  <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-5 text-stone-800 sm:text-sm">
                    {line.ten}
                  </span>
                  <span className="max-w-24 shrink-0 rounded-lg border border-stone-200/60 bg-white px-2 py-1 text-[11px] font-medium tabular-nums text-stone-600 sm:text-xs">
                    × {line.qty}
                    {line.dvt ? ` ${line.dvt}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

        </div>
          <div className="grid shrink-0 grid-cols-[1fr_1.4fr] gap-3 border-t border-stone-100 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-6">
          <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
            <span className="text-sm text-stone-500 sm:text-base">
              Tổng tiền ước tính
            </span>
            <span className="text-xl font-bold tracking-tight tabular-nums text-[var(--aloha-price)] sm:text-2xl">
              {formatVnd(total)}
            </span>
          </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-12 rounded-xl border border-stone-200 bg-white text-base font-semibold text-stone-600 transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onAgree}
              className="min-h-12 rounded-xl bg-[var(--aloha-green)] text-base font-semibold text-white shadow-sm transition hover:bg-[var(--aloha-green-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? "Đang gửi…" : "Đồng ý"}
            </button>
          </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
