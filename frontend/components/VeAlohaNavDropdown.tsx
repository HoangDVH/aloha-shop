"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Heart,
  Briefcase,
  Sparkles,
  Coffee,
  Factory,
  ArrowRight,
  Gift,
  Leaf,
} from "lucide-react";

interface VeAlohaNavDropdownProps {
  active: boolean;
  onNavigate?: () => void;
}

export function VeAlohaNavDropdown({ active, onNavigate }: VeAlohaNavDropdownProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLinkClick = () => {
    setOpen(false);
    if (onNavigate) onNavigate();
  };

  return (
    <div
      className="relative flex h-full shrink-0 items-stretch"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href="/ve-aloha"
        onClick={handleLinkClick}
        className={`group relative inline-flex h-full shrink-0 items-center justify-center gap-1 whitespace-nowrap px-2 text-[15px] xl:px-2.5 xl:text-[16px] ${
          active || open
            ? "font-bold text-[var(--aloha-green)]"
            : "font-semibold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <span>Về Aloha</span>
        <span className="hidden items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 xl:inline-flex">
          20/10
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          className={`shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--aloha-green)]" : "text-slate-400 group-hover:text-[var(--aloha-green)]"
          }`}
          aria-hidden
        />
        <span
          className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] transition-opacity ${
            active || open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-hidden
        />
      </Link>

      {/* Flyout Panel */}
      {open && (
        <div
          role="menu"
          aria-label="Về Aloha Dropdown"
          className="absolute left-1/2 top-full z-[80] w-[640px] -translate-x-1/2 pt-2 transition-all animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="overflow-hidden rounded-2xl border border-[var(--aloha-line)] bg-white/98 shadow-2xl backdrop-blur-md">
            <div className="grid grid-cols-12 divide-x divide-stone-100">
              {/* Cột trái: Phân luồng cảm xúc */}
              <div className="col-span-7 p-4">
                {/* Quà cá nhân 20/10 */}
                <div className="mb-3.5">
                  <div className="flex items-center gap-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-rose-600">
                    <Heart size={13} className="fill-rose-500 text-rose-500" />
                    <span>Gửi Trao Tâm Tình (Dịp 20/10)</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <Link
                      href="/ve-aloha#qua-tang-ca-nhan"
                      onClick={handleLinkClick}
                      className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition hover:bg-stone-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 group-hover:text-[var(--aloha-green)]">
                          Bộ sưu tập Quà Tặng Độc Bản
                        </p>
                        <p className="text-xs text-stone-500 line-clamp-1">
                          Cây Bình An, Hồng Môn, Hạnh Phúc, Sen Đá & thiệp tay
                        </p>
                      </div>
                      <ArrowRight size={13} className="shrink-0 text-stone-300 group-hover:text-[var(--aloha-green)]" />
                    </Link>
                  </div>
                </div>

                {/* Quà doanh nghiệp */}
                <div className="mb-3.5 border-t border-stone-100 pt-3">
                  <div className="flex items-center gap-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    <Briefcase size={13} />
                    <span>Quà Doanh Nghiệp (B2B)</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <Link
                      href="/ve-aloha#qua-tang-doanh-nghiep"
                      onClick={handleLinkClick}
                      className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition hover:bg-stone-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 group-hover:text-[var(--aloha-green)]">
                          Giải Pháp Tri Ân Nhân Viên & Đối Tác
                        </p>
                        <p className="text-xs text-stone-500 line-clamp-1">
                          In logo lên chậu, khắc tag gỗ, đóng gói sang trọng
                        </p>
                      </div>
                      <ArrowRight size={13} className="shrink-0 text-stone-300 group-hover:text-[var(--aloha-green)]" />
                    </Link>
                  </div>
                </div>

                {/* Câu chuyện & Xưởng */}
                <div className="border-t border-stone-100 pt-3">
                  <div className="flex items-center gap-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <Leaf size={13} />
                    <span>Câu Chuyện & Xưởng Sản Xuất</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <Link
                      href="/ve-aloha#gia-tri-cot-loi"
                      onClick={handleLinkClick}
                      className="group flex items-center gap-2 rounded-xl p-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[var(--aloha-green)]"
                    >
                      <Sparkles size={14} className="text-amber-500 shrink-0" />
                      <span>5 Giá Trị Cốt Lõi</span>
                    </Link>
                    <Link
                      href="/ve-aloha#nang-luc-cung-ung"
                      onClick={handleLinkClick}
                      className="group flex items-center gap-2 rounded-xl p-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[var(--aloha-green)]"
                    >
                      <Factory size={14} className="text-blue-500 shrink-0" />
                      <span>Xưởng 2.000+ Mẫu</span>
                    </Link>
                    <Link
                      href="/ve-aloha#tam-nhin-phat-trien"
                      onClick={handleLinkClick}
                      className="group col-span-2 flex items-center gap-2 rounded-xl p-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[var(--aloha-green)]"
                    >
                      <Coffee size={14} className="text-emerald-600 shrink-0" />
                      <span>Aloha Green Bistro 🍃 (Mô hình Cà phê cảnh quan)</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Cột phải: Visual Card nổi bật */}
              <div className="col-span-5 flex flex-col justify-between bg-[#FDFBF7] p-4">
                <div>
                  <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/nav-illustrations/nav-hong-mon.png"
                      alt="Quà tặng 20/10 tại Aloha"
                      className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
                    />
                    <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      Dịp 20/10
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-800 leading-snug">
                    Trao gửi món quà xanh độc bản
                  </h4>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    Hoa mau tàn, cây xanh ở lại lớn lên cùng tấm chân tình bạn gửi trao.
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-stone-200/50">
                  <Link
                    href="/ve-aloha"
                    onClick={handleLinkClick}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--aloha-green)] py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-dark)]"
                  >
                    <span>Khám phá trọn vẹn</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
