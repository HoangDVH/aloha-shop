"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { formatVnd } from "@/lib/api";

type Props = {
  open: boolean;
  total: number;
  productNames?: string[];
  onAgree: () => void;
  onClose: () => void;
  submitting?: boolean;
};

/**
 * Modal xác nhận COD đặt trước (kiểu sàn):
 * bấm Đặt hàng → đọc lý do giao chậm → Đồng ý mới tạo đơn / đẩy KV.
 */
export function PreOrderCodConfirmModal({
  open,
  total,
  productNames = [],
  onAgree,
  onClose,
  submitting = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!mounted || !open) return null;

  const names = productNames.filter(Boolean).slice(0, 4);

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preorder-cod-title"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
          Xác nhận trước khi đặt
        </p>
        <h3
          id="preorder-cod-title"
          className="mt-1 text-lg font-extrabold text-[var(--aloha-ink)]"
        >
          Đơn đặt trước — thanh toán khi nhận hàng
        </h3>

        <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
          <p className="font-bold">Vì sao giao chậm?</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px]">
            <li>
              Một hoặc nhiều sản phẩm trong đơn hiện <strong>hết tồn</strong> —
              shop cần nhập hàng / chuẩn bị lại trước khi giao.
            </li>
            <li>
              Thời gian giao phụ thuộc khi hàng về kho —{" "}
              <strong>không giao ngay</strong> như đơn còn hàng.
            </li>
          </ul>
        </div>

        {names.length ? (
          <div className="mt-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Sản phẩm đặt trước:</p>
            <ul className="mt-1 space-y-0.5">
              {names.map((n) => (
                <li key={n} className="line-clamp-1">
                  · {n}
                </li>
              ))}
              {productNames.length > names.length ? (
                <li>· … và {productNames.length - names.length} SP khác</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <p className="mt-3 text-sm text-slate-700">
          Tổng thanh toán ước tính:{" "}
          <strong className="text-[var(--aloha-price)]">{formatVnd(total)}</strong>
        </p>

        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Bấm <strong>Đồng ý & đặt hàng</strong> nghĩa là bạn đã hiểu và đồng ý
          điều kiện trên.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={submitting}
            onClick={onAgree}
            className="flex-1 rounded-full bg-[var(--aloha-green)] py-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Đang đặt hàng…" : "Đồng ý & đặt hàng"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 rounded-full border border-[var(--aloha-line)] py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
