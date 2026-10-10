"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Users } from "lucide-react";

const items = [
  { href: "/tuyen-ctv", label: "Tuyển cộng tác viên", description: "Kiếm thêm thu nhập cùng Aloha", icon: Users },
  { href: "/dang-ky-si", label: "Đăng ký sỉ", description: "Giá sỉ và chính sách cho đại lý", icon: Building2 },
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

  return (
    <div ref={root} className={mobile ? "relative rounded-2xl border border-slate-100 bg-white shadow-sm" : "relative shrink-0"}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(value => !value)}
        className={`${mobile ? "flex w-full justify-between p-3.5 text-sm" : "inline-flex min-h-[38px] gap-1.5 whitespace-nowrap rounded-xl border px-2 py-2 text-[13.5px] xl:text-[14px]"} items-center font-semibold transition-colors ${active || open ? "border-emerald-200 bg-emerald-50 text-[var(--aloha-green)]" : "border-transparent text-neutral-800 hover:bg-neutral-100/70 hover:text-[var(--aloha-green)]"}`}>
        <span>Tuyển cộng tác viên và sỉ</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={id} className={mobile ? "border-t border-slate-100 p-1" : "absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg"}>
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
