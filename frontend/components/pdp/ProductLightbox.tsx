"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
};

/** Xem ảnh phóng to — nền sáng kiểu sàn TMĐT (không viền đen). */
export function ProductLightbox({ open, src, alt, onClose }: Props) {
  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#f5f5f5]/95 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] rounded-full bg-white p-2 text-slate-600 shadow-md ring-1 ring-black/10 hover:bg-slate-50"
        onClick={onClose}
        aria-label="Đóng"
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full rounded-lg bg-white object-contain shadow-lg ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
