"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { formatVnd } from "@/lib/api";

export type PolicyConfirmLine = {
  ma: string;
  ten: string;
  qty: number;
  dvt?: string;
};

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
        className="max-h-[calc(100dvh-24px)] w-full max-w-[600px] overflow-y-auto rounded-[30px] bg-white shadow-[0_28px_80px_rgba(15,32,18,0.22)] sm:max-h-[calc(100dvh-48px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5 sm:px-8 sm:pt-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--aloha-green)] sm:text-sm">
              Chính sách Aloha
            </p>
            <h3
              id="order-policy-title"
              className="mt-1 text-[26px] font-extrabold leading-tight text-[var(--aloha-ink)] sm:text-[32px]"
            >
              Xác nhận đặt hàng
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={submitting}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 px-5 pb-5 pt-4 sm:px-8 sm:pb-8">
          {lines.length ? (
            <ul className="max-h-44 divide-y divide-black/[0.04] overflow-auto rounded-2xl bg-[#f6f5f1] px-4 sm:px-5">
              {lines.map((line) => (
                <li key={line.ma} className="flex items-start justify-between gap-3 py-3.5">
                  <span className="min-w-0 text-base font-semibold leading-snug text-[var(--aloha-ink)] sm:text-lg">
                    {line.ten}
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-bold tabular-nums text-slate-600 shadow-sm">
                    × {line.qty}
                    {line.dvt ? ` ${line.dvt}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base text-slate-500 sm:text-lg">Tổng tiền ước tính</span>
            <span className="text-2xl font-extrabold tabular-nums text-[var(--aloha-price)] sm:text-[28px]">
              {formatVnd(total)}
            </span>
          </div>

          <p className="rounded-[22px] bg-[var(--aloha-green-light)] px-5 py-5 text-base leading-[1.7] text-[var(--aloha-ink)] sm:px-6 sm:py-6 sm:text-lg">
            Aloha sẽ kiểm tra sản phẩm và gửi hình ảnh cho bạn xác nhận trước khi đóng gói.
            Sau khi bạn xác nhận ảnh, Aloha gửi hướng dẫn thanh toán trước toàn bộ đơn, hoặc
            đặt cọc tối thiểu bằng phí ship. Bạn có đồng ý chính sách này và tiếp tục đặt hàng không?
          </p>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-14 rounded-full border border-[var(--aloha-line)] text-base font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onAgree}
              className="min-h-14 rounded-full bg-[var(--aloha-green)] text-base font-bold text-white shadow-[0_8px_20px_rgba(47,107,58,0.28)] transition hover:bg-[var(--aloha-green-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? "Đang gửi…" : "Đồng ý"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
