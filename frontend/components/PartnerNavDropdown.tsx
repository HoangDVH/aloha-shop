"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Users } from "lucide-react";

const items = [
  { href: "/dang-ky-si", label: "Đăng ký sỉ", description: "Giá sỉ và chính sách cho đại lý", icon: Building2 },
  { href: "/tuyen-ctv", label: "Tuyển cộng tác viên", description: "Kiếm thêm thu nhập cùng Aloha", icon: Users },
] as const;

export function PartnerNavDropdown({ pathname, onNavigate, mobile = false }: {
  pathname: string;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const id = mobile ? "mobile-partner-links" : "desktop-partner-links";

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
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
            <p className="text-sm font-bold text-[var(--aloha-ink)]">Tuyển sỉ và cộng tác viên</p>
            <p className="text-xs text-slate-500">Giá sỉ & chính sách CTV cho đối tác</p>
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
          <div id={id} className="border-t border-slate-100 bg-stone-50/50 p-2 space-y-1">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => { setOpen(false); onNavigate(); }}
                className="flex items-center justify-between rounded-xl p-2.5 text-neutral-800 transition-colors hover:bg-white active:bg-white"
              >
                <div>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={root} className="relative shrink-0"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(value => !value)}
        className={`inline-flex min-h-[38px] gap-1.5 whitespace-nowrap rounded-xl border px-2 py-2 text-[13.5px] xl:text-[14px] items-center font-semibold transition-colors ${active || open ? "border-emerald-200 bg-emerald-50 text-[var(--aloha-green)]" : "border-transparent text-neutral-800 hover:bg-neutral-100/70 hover:text-[var(--aloha-green)]"}`}>
        <span>Tuyển sỉ và cộng tác viên</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={id} className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg">
          {items.map(item => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => { setOpen(false); onNavigate(); }}
              className="flex items-center gap-3 rounded-xl p-3 text-neutral-800 transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none aria-[current=page]:bg-emerald-50">
              <item.icon size={20} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
              <span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.description}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
