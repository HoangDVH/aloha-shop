"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Đặt trên <html> khi ảnh nhỏ đang hiện để các nút nổi khác (bong bóng voucher) tự nhường chỗ. */
export const POPUP_BADGE_ATTR = "data-popup-badge";

/** Ảnh nhỏ ở góc sau khi khách đóng popup — bấm để mở lại ưu đãi. */
export function PopupReopenBadge({
  imageUrl,
  label,
  onOpen,
  onHide,
}: {
  imageUrl: string;
  label: string;
  onOpen: () => void;
  onHide: () => void;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(POPUP_BADGE_ATTR, "1");
    return () => root.removeAttribute(POPUP_BADGE_ATTR);
  }, []);

  return (
    <div className="fixed bottom-20 left-3 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300 lg:bottom-6 lg:left-6">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Mở lại: ${label}`}
          className="block h-16 w-16 rounded-2xl bg-white/95 p-1 shadow-[0_6px_18px_rgba(0,0,0,0.22)] ring-1 ring-rose-200 transition hover:scale-105 lg:h-20 lg:w-20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-contain" draggable={false} />
        </button>
        <button
          type="button"
          onClick={onHide}
          aria-label="Ẩn ưu đãi"
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow ring-2 ring-white transition hover:bg-slate-900"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
