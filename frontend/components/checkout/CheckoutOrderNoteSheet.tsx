"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = { note: string; onSave: (value: string) => void; onClose: () => void };

export function CheckoutOrderNoteSheet({ note, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(note);
  const titleId = useId();
  const inputId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.current?.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 220, easing: "ease-out" });
    }
    // Track the visible viewport so the Save button stays above the mobile keyboard.
    const viewport = window.visualViewport;
    const resize = () => {
      if (overlay.current && viewport) {
        overlay.current.style.height = `${viewport.height}px`;
        overlay.current.style.top = `${viewport.offsetTop}px`;
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    textarea.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<div ref={overlay} className="fixed inset-x-0 top-0 z-[150] flex h-dvh items-end bg-black/45 lg:hidden"
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="flex max-h-[85%] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key === "Tab") {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, textarea'));
          if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
        }
      }}>
      <header className="relative flex min-h-14 shrink-0 items-center justify-center px-12">
        <h2 id={titleId} className="text-base font-bold text-slate-900">Ghi chú đơn hàng</h2>
        <button type="button" aria-label="Đóng ghi chú" onClick={onClose} className="absolute right-2 flex h-11 w-11 items-center justify-center text-slate-700"><X size={21} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4">
        <label htmlFor={inputId} className="sr-only">Ghi chú cho cả đơn hàng (không bắt buộc)</label>
        <textarea ref={textarea} id={inputId} maxLength={255} value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Cung cấp thêm thông tin về đơn hàng cho người bán (không bắt buộc)"
          className="block h-[min(26dvh,220px)] min-h-24 w-full resize-none rounded-xl border-0 bg-[#f3f3f4] p-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[var(--aloha-green)]" />
        <p className="py-2 text-right text-xs tabular-nums text-slate-400" aria-live="polite">{draft.length}/255</p>
      </div>
      <footer className="shrink-0 px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => { onSave(draft); onClose(); }} className="min-h-12 w-full rounded-lg bg-[var(--aloha-green)] text-sm font-bold text-white">Lưu</button>
      </footer>
    </div>
  </div>, document.body);
}
