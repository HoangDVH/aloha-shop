"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Gift, Heart, Home, Sparkles, Building2, UserCheck } from "lucide-react";

type QuaTangNavDropdownProps = {
  active?: boolean;
  onNavigate?: () => void;
};

// Chuẩn thiết kế tối giản, sang trọng: 1 bảng màu thương hiệu đồng nhất
const GIFT_NAV_ITEMS = [
  {
    href: "/qua-tang/nguoi-thuong",
    label: "Dành cho Nàng (20/10)",
    sub: "Chậu sen đá, hồng môn ngọt ngào & tinh tế",
    isHighlight: true, // Điểm nhấn duy nhất cho dịp 20/10
    icon: Heart,
  },
  {
    href: "/qua-tang/gia-dinh",
    label: "Gia Đình & Mẹ",
    sub: "Cây Bình An, Hạnh Phúc — bình an & trường thọ",
    icon: Home,
  },
  {
    href: "/qua-tang/khai-truong",
    label: "Khai Trương & Thăng Chức",
    sub: "Cây Kim Tiền, Phát Tài vượng khí tài lộc",
    icon: Sparkles,
  },
  {
    href: "/qua-tang/ban-lam-viec",
    label: "Bàn Làm Việc & Đồng Nghiệp",
    sub: "Tiểu cảnh mini, sen đá thư giãn góc làm việc",
    icon: UserCheck,
  },
  {
    href: "/qua-tang/doanh-nghiep",
    label: "Quà Tặng Doanh Nghiệp (B2B)",
    sub: "In logo chậu, khắc tag gỗ, cung ứng số lượng lớn",
    icon: Building2,
  },
];

export function QuaTangNavDropdown({ active, onNavigate }: QuaTangNavDropdownProps) {
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
        href="/#goi-y-qua-tang"
        onClick={(e) => {
          setOpen(false);
          onNavigate?.();
          if (typeof window !== "undefined" && window.location.pathname === "/") {
            const target = document.getElementById("goi-y-qua-tang");
            if (target) {
              e.preventDefault();
              target.scrollIntoView({ behavior: "smooth" });
              window.history.pushState(null, "", "/#goi-y-qua-tang");
            }
          }
        }}
        className={`group relative inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-[15px] xl:px-3.5 xl:text-[15.5px] rounded-xl border transition-all duration-150 select-none cursor-pointer active:scale-95 ${
          active || open
            ? "font-bold text-[var(--aloha-green)] bg-emerald-50 border-emerald-200/90 shadow-2xs"
            : "font-semibold text-neutral-800 hover:text-[var(--aloha-green)] hover:bg-neutral-100/70 border-transparent"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="shrink-0 text-[var(--aloha-green)] group-hover:scale-110 transition-transform">
          <Gift size={16} />
        </span>
        <span>Quà tặng</span>
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          className={`shrink-0 opacity-70 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--aloha-green)]" : ""
          }`}
          aria-hidden="true"
        />
        <span
          className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300 ease-out bg-[var(--aloha-green)] ${
            active || open ? "w-4/5 opacity-100 shadow-xs" : "w-0 opacity-0 group-hover:w-3/5 group-hover:opacity-80"
          }`}
          aria-hidden="true"
        />
      </Link>

      {/* Dropdown Panel — Chuẩn Minimalism cao cấp */}
      {open ? (
        <div
          className="absolute left-0 top-full z-[80] pt-2 animate-in fade-in zoom-in-95 duration-150"
          style={{ width: "340px" }}
        >
          <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-2 shadow-2xl ring-1 ring-black/5">
            <div className="px-3 py-2 border-b border-stone-100 mb-1">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Gợi ý quà tặng theo đối tượng
              </span>
            </div>

            <div className="space-y-0.5">
              {GIFT_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      setOpen(false);
                      onNavigate?.();
                      if (item.href.startsWith("/#")) {
                        const hashId = item.href.replace("/#", "");
                        if (typeof window !== "undefined" && window.location.pathname === "/") {
                          const target = document.getElementById(hashId);
                          if (target) {
                            e.preventDefault();
                            target.scrollIntoView({ behavior: "smooth" });
                            window.history.pushState(null, "", item.href);
                          }
                        }
                      }
                    }}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition duration-150 hover:bg-emerald-50/70"
                  >
                    {/* Icon đồng nhất: Tông trung tính tinh tế, hover sáng xanh Aloha */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100/90 text-stone-600 transition-colors group-hover:bg-emerald-100 group-hover:text-[var(--aloha-green)]">
                      <Icon size={17} strokeWidth={1.8} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-bold text-stone-800 transition-colors group-hover:text-[var(--aloha-green)] truncate">
                          {item.label}
                        </span>
                        {/* Chỉ giữ 1 điểm nhấn duy nhất cho dịp 20/10 */}
                        {item.isHighlight ? (
                          <span className="shrink-0 rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[9.5px] font-bold text-rose-700 leading-none">
                            20/10
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11.5px] text-stone-500 truncate mt-0.5 group-hover:text-stone-600">
                        {item.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-2 border-t border-stone-100 pt-2 px-2 pb-1">
              <Link
                href="/#goi-y-qua-tang"
                onClick={(e) => {
                  setOpen(false);
                  onNavigate?.();
                  if (typeof window !== "undefined" && window.location.pathname === "/") {
                    const target = document.getElementById("goi-y-qua-tang");
                    if (target) {
                      e.preventDefault();
                      target.scrollIntoView({ behavior: "smooth" });
                      window.history.pushState(null, "", "/#goi-y-qua-tang");
                    }
                  }
                }}
                className="block text-center text-xs font-bold text-[var(--aloha-green)] hover:underline py-1"
              >
                Xem tất cả gợi ý quà tặng →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
