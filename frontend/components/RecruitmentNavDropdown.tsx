"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Building2, ChevronDown, ChevronRight, Users } from "lucide-react";

type RecruitmentNavDropdownProps = {
  active?: boolean;
  onNavigate?: () => void;
};

const RECRUITMENT_ITEMS = [
  {
    href: "/tuyen-dung",
    label: "Nhân viên",
    sub: "Cơ hội việc làm & gia nhập đội ngũ Aloha",
    badge: "Việc làm",
    icon: Briefcase,
  },
  {
    href: "/tuyen-ctv",
    label: "Tuyển cộng tác viên",
    sub: "Bán hàng online hoa hồng hấp dẫn, không cần vốn",
    badge: "CTV",
    icon: Users,
  },
  {
    href: "/dang-ky-si",
    label: "Đăng ký sỉ",
    sub: "Chính sách giá sỉ & chiết khấu đại lý (B2B)",
    badge: "Đại lý",
    icon: Building2,
  },
] as const;

export function RecruitmentNavDropdown({ active, onNavigate }: RecruitmentNavDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href="/tuyen-dung"
        onClick={() => {
          setOpen(false);
          onNavigate?.();
        }}
        aria-haspopup="true"
        aria-expanded={open}
        className={`group relative inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-[15px] xl:px-3.5 xl:text-[15.5px] rounded-xl transition-all duration-150 select-none cursor-pointer active:scale-95 ${
          active
            ? "font-bold text-[var(--aloha-green)] bg-emerald-50/80 hover:bg-emerald-100/70 active:bg-emerald-100"
            : "font-semibold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)] hover:bg-slate-100/70 active:bg-slate-200/70"
        }`}
      >
        <span>Tuyển dụng</span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={`opacity-70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span
          className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300 ease-out bg-[var(--aloha-green)] ${
            active
              ? "w-4/5 opacity-100 shadow-xs"
              : "w-0 opacity-0 group-hover:w-3/5 group-hover:opacity-80"
          }`}
          aria-hidden
        />
      </Link>

      {open ? (
        <div className="absolute right-0 top-full z-[80] pt-1.5" onMouseEnter={handleMouseEnter}>
          <div
            className="w-80 overflow-hidden rounded-2xl border border-[var(--aloha-line)] bg-white p-2 shadow-[0_16px_36px_-12px_rgba(27,94,32,0.22)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150"
            role="menu"
            aria-label="Cơ hội tuyển dụng và hợp tác"
          >
            <div className="px-3 py-1.5 border-b border-stone-100 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                Cơ hội việc làm & Hợp tác
              </p>
            </div>
            <div className="space-y-1">
              {RECRUITMENT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-emerald-50/60 active:bg-emerald-100/70 cursor-pointer"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)] group-hover:bg-[#1C4C40] group-hover:text-white transition-colors shadow-2xs">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-[var(--aloha-ink)] group-hover:text-[#1C4C40] transition-colors">
                          {item.label}
                        </span>
                        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9.5px] font-bold text-stone-600 group-hover:bg-emerald-100 group-hover:text-[#1C4C40] transition-colors">
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-stone-500 leading-snug line-clamp-1">
                        {item.sub}
                      </p>
                    </div>
                    <ChevronRight
                      size={15}
                      className="mt-1 shrink-0 text-stone-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
