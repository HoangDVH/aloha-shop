"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Info } from "lucide-react";
import type { MysteryInfo } from "@/lib/voucherFormat";

/** Dòng nhỏ trên vé túi mù: mức đã bóc, hoặc nút xem tỉ lệ trúng công khai từng mức. */
export function MysteryOdds({ mystery }: { mystery: MysteryInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (mystery.drawnPercent) {
    return (
      <p className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-bold text-amber-700">
        <Gift size={12} strokeWidth={2.6} aria-hidden />
        Bạn đã bóc được giảm {mystery.drawnPercent}%
      </p>
    );
  }

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-amber-700">
      <span>May mắn tới {mystery.max}%</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 hover:text-amber-900 cursor-pointer"
      >
        <Info size={11} aria-hidden />
        Tỉ lệ
      </button>
      {open ? (
        <span
          role="dialog"
          aria-label="Tỉ lệ trúng túi mù"
          className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-amber-200 bg-white p-2.5 text-[11px] font-medium text-slate-700 shadow-lg"
        >
          <span className="mb-1 block font-bold text-slate-900">Tỉ lệ trúng mỗi lần bóc</span>
          {mystery.tiers.map((t) => (
            <span key={t.percent} className="flex justify-between">
              <span>Giảm {t.percent}%</span>
              <span className="tabular-nums text-slate-500">{t.chance}%</span>
            </span>
          ))}
          <span className="mt-1 block text-[10px] text-slate-400">Mỗi tài khoản bóc 1 lần, mức trúng lưu vào ví.</span>
        </span>
      ) : null}
    </span>
  );
}
