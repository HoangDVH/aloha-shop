"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Popup ứng tuyển: toàn màn hình trên điện thoại, hộp giữa màn hình trên máy tính.
 * Đóng chỉ ẩn đi (không unmount) để khách lỡ tay đóng vẫn giữ được thông tin đã nhập.
 */
export function ApplyDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[80] items-stretch justify-center sm:items-center sm:p-6 ${open ? "flex" : "hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={!open}
    >
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-[#0b141a]/55" aria-label="Đóng" onClick={onClose} />
      <div className="relative z-[1] h-full w-full overflow-y-auto bg-[#F1F6EE] p-5 sm:h-auto sm:max-h-[92svh] sm:max-w-3xl sm:rounded-2xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-[var(--aloha-green-dark)] sm:text-2xl">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
