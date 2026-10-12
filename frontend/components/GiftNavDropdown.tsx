"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { GiftCategoryLinks } from "./GiftCategoryLinks";

export function GiftNavDropdown({ pathname, onNavigate, mobile = false }: {
  pathname: string; onNavigate: () => void; mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = pathname === "/qua-tang" || pathname.startsWith("/qua-tang/");
  const id = mobile ? "mobile-gift-links" : "desktop-gift-links";
  const navigate = () => { setOpen(false); onNavigate(); };
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (mobile) {
    return (
      <div
        ref={root}
        className="relative w-full"
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(value => !value)}
          className={`flex w-full items-center justify-between p-3.5 text-left transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98] ${
            active || open ? "bg-emerald-50/50" : ""
          }`}
        >
          <div>
            <p className="text-sm font-bold text-[var(--aloha-ink)]">Gợi ý quà tặng</p>
            <p className="text-xs text-slate-500">Bộ sưu tập quà tặng cây cảnh & thiệp chúc</p>
          </div>
          <ChevronDown
            size={16}
            aria-hidden
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180 text-[var(--aloha-green)]" : ""
            }`}
          />
        </button>
        {open && (
          <div id={id} className="border-t border-slate-100 bg-stone-50/50 px-1 pb-3 pt-1">
            <GiftCategoryLinks onNavigate={navigate} mobile />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={root} className="relative shrink-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
        className={`inline-flex min-h-[38px] gap-1.5 whitespace-nowrap rounded-xl border px-2 py-2 text-[13.5px] xl:text-[14px] items-center font-semibold transition-colors ${active || open ? "border-emerald-200 bg-emerald-50 text-[var(--aloha-green)]" : "border-transparent text-neutral-800 hover:bg-neutral-100/70 hover:text-[var(--aloha-green)]"}`}>
        <span>Gợi ý quà tặng</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id={id} className="absolute left-0 top-full z-[80] mt-2 max-h-[calc(100dvh-13rem)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-lg">
        <GiftCategoryLinks onNavigate={navigate} />
      </div>}
    </div>
  );
}
