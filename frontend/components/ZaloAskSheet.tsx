"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { ZaloAskProduct } from "@/lib/zaloAsk";

/** Bảng hướng dẫn tư vấn SP qua Zalo: câu hỏi đã chép sẵn, khách mở Zalo rồi dán + gửi. */
export function ZaloAskSheet({
  product,
  text,
  copied,
  href,
  onCopy,
  onClose,
}: {
  product: ZaloAskProduct;
  text: string;
  copied: boolean;
  href: string;
  onCopy: () => void;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zalo-ask-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 sm:rounded-3xl sm:p-5 ${
          show ? "translate-y-0" : "translate-y-6"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0068FF] text-[11px] font-black text-white" aria-hidden>
            Zalo
          </span>
          <h2 id="zalo-ask-title" className="flex-1 text-base font-black text-slate-900">
            Tư vấn sản phẩm qua Zalo
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-black/[0.04]">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold text-slate-800">{product.name}</p>
            {product.price && product.price > 0 ? (
              <p className="mt-0.5 text-sm font-black text-[#E53935]">{formatVnd(product.price)}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Tin nhắn soạn sẵn</span>
            <button
              type="button"
              onClick={onCopy}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                copied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
              {copied ? "Đã sao chép" : "Sao chép"}
            </button>
          </div>
          <p className="mt-1.5 select-all whitespace-pre-line break-all rounded-xl border border-dashed border-slate-300 bg-white p-2.5 text-[12.5px] leading-snug text-slate-700">
            {text}
          </p>
        </div>

        <ol className="mt-3 space-y-1 text-[13px] text-slate-700">
          <li>
            <b>1.</b> Bấm <b>Mở Zalo</b> bên dưới
          </li>
          <li>
            <b>2.</b> Nhấn giữ ô nhập tin nhắn → chọn <b>Dán</b>
            <span className="hidden sm:inline"> (máy tính: Ctrl+V)</span>
          </li>
          <li>
            <b>3.</b> Bấm <b>Gửi</b> — shop sẽ thấy ngay ảnh và tên sản phẩm bạn hỏi
          </li>
        </ol>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (!copied) onCopy();
            onClose();
          }}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#0068FF] text-[15px] font-black text-white shadow-[0_6px_16px_rgba(0,104,255,0.35)] transition active:scale-[0.98]"
        >
          Mở Zalo
        </a>
      </div>
    </div>
  );
}
