"use client";

import { useEffect, useState } from "react";
import { Gift, PartyPopper } from "lucide-react";
import type { MysteryInfo } from "@/lib/voucherFormat";

const OPENING_MS = 1600;

/** `true` sau khi túi đã rung xong; đổi voucher / mở lại modal thì bóc lại từ đầu. */
export function useMysteryRevealed(open: boolean, key: string | null): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    if (!open || !key) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setRevealed(true), reduce ? 250 : OPENING_MS);
    return () => clearTimeout(t);
  }, [open, key]);
  return revealed;
}

/** Màn đang bóc: túi quà rung, chưa lộ mức. */
export function MysteryOpening({ mystery }: { mystery: MysteryInfo }) {
  return (
    <div className="py-6" aria-live="polite">
      <div className="aloha-bag-shake relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl shadow-orange-600/30">
        <Gift size={52} strokeWidth={1.8} />
        <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-rose-600 shadow-md">
          ?
        </span>
      </div>
      <p className="mt-5 text-base font-black uppercase tracking-tight text-slate-900">Đang bóc túi mù…</p>
      <p className="mt-1 text-xs font-medium text-slate-500">
        Giảm ngẫu nhiên {mystery.min}% – {mystery.max}%
      </p>
    </div>
  );
}

/** Phần đầu modal sau khi bóc: mức trúng nảy lên + pháo giấy. */
export function MysteryRevealHeader({ mystery }: { mystery: MysteryInfo }) {
  const pct = mystery.drawnPercent || mystery.min;
  const chance = mystery.tiers.find((t) => t.percent === pct)?.chance;
  const top = pct >= mystery.max;
  return (
    <div aria-live="polite">
      <div className="relative mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-600/30 aloha-confetti-burst">
        <PartyPopper size={28} strokeWidth={2.2} />
      </div>
      <h3 id="claim-success-title" className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
        {top ? "Trúng mức cao nhất!" : "Chúc mừng bạn!"}
      </h3>
      <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-500">Bạn bóc được voucher</p>
      <p className="aloha-reveal-pop mt-1 bg-gradient-to-r from-[#C8102E] via-[#E11D48] to-orange-500 bg-clip-text text-5xl font-black tracking-tight text-transparent">
        GIẢM {pct}%
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        Đã lưu vào ví voucher{chance != null ? ` · tỉ lệ trúng mức này ${chance}%` : ""}
      </p>
    </div>
  );
}
