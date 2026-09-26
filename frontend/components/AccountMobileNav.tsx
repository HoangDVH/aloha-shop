"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, LogOut, X } from "lucide-react";

export function AccountMobileNav<T extends string>({ value, items, onChange, onLogout, logoutPending }: {
  value: T;
  items: { id: T; label: string; icon: ReactNode }[];
  onChange: (value: T) => void;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = items.find(item => item.id === value) || items[0];

  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    node.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      node.close();
      if (!desktop.matches) trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return <nav aria-label="Menu tài khoản" className="space-y-3 lg:hidden">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-[var(--aloha-ink)]">Tài khoản</h2>
      <button type="button" disabled={logoutPending} onClick={onLogout}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-600">
        <LogOut size={15} /> Đăng xuất
      </button>
    </div>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="account-mobile-menu"
      onClick={() => setOpen(true)}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--aloha-line)] bg-white px-4 py-3 text-left text-sm font-semibold text-[var(--aloha-ink)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]">
      <span className="shrink-0 text-[var(--aloha-green)]">{current.icon}</span>
      <span className="min-w-0 flex-1">{current.label}</span>
      <ChevronDown size={18} className="shrink-0 text-slate-400" />
    </button>
    <dialog ref={dialog} id="account-mobile-menu" aria-labelledby="account-mobile-menu-title"
      onCancel={() => setOpen(false)}
      onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) setOpen(false);
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-0 text-[var(--aloha-ink)] shadow-2xl backdrop:bg-black/40">
      <div className="px-4 pt-3" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="account-mobile-menu-title" className="text-lg font-bold">Chọn mục tài khoản</h2>
          <button type="button" aria-label="Đóng menu tài khoản" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500"><X size={20} /></button>
        </div>
        <div className="space-y-2">
          {items.map(item => <button key={item.id} type="button" aria-current={value === item.id ? "page" : undefined}
            onClick={() => { setOpen(false); onChange(item.id); }}
            className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${value === item.id ? "bg-[var(--aloha-green-light)] text-[var(--aloha-green)]" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
            <span className="shrink-0">{item.icon}</span><span className="flex-1">{item.label}</span>
            {value === item.id && <Check size={18} aria-hidden="true" />}
          </button>)}
        </div>
      </div>
    </dialog>
  </nav>;
}
