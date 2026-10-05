"use client";

import { useEffect, useState, useMemo } from "react";
import { Crown, Gift, PartyPopper, Sparkles, Trophy } from "lucide-react";
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

/** Hook tạo hiệu ứng số nhảy hồi hộp (Number Ticker: min -> target). */
function useNumberTicker(target: number, min: number, active: boolean): number {
  const [current, setCurrent] = useState(min);

  useEffect(() => {
    if (!active) {
      setCurrent(min);
      return;
    }
    if (min >= target) {
      setCurrent(target);
      return;
    }

    const duration = 650; // ms
    const steps = Math.max(1, target - min);
    const intervalTime = Math.max(40, Math.floor(duration / steps));
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount++;
      const val = min + stepCount;
      if (val >= target) {
        setCurrent(target);
        clearInterval(timer);
      } else {
        setCurrent(val);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [target, min, active]);

  return current;
}

/** Mưa pháo hoa giấy Confetti bung tỏa rực rỡ chuẩn Shopee. */
function ConfettiRain() {
  const particles = useMemo(() => {
    const colors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#F43F5E", "#FBBF24"];
    return Array.from({ length: 26 }).map((_, i) => {
      const left = Math.floor((i * 100) / 26) + (i % 3) * 2;
      const size = 6 + (i % 4) * 2;
      const color = colors[i % colors.length];
      const delay = (i % 6) * 0.08;
      const duration = 1.2 + (i % 5) * 0.15;
      const isRound = i % 3 === 0;
      return { id: i, left, size, color, delay, duration, isRound };
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -top-8 overflow-hidden z-20" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -top-3 animate-in fade-in"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: p.isRound ? `${p.size}px` : `${p.size * 1.6}px`,
            backgroundColor: p.color,
            borderRadius: p.isRound ? "50%" : "2px",
            animation: `aloha-confetti-fall ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s infinite`,
            transform: `rotate(${p.id * 24}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes aloha-confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.6);
            opacity: 1;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(320px) rotate(420deg) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/** Màn đang bóc: túi quà rung lắc dồn dập, phồng to tạo kịch tính. */
export function MysteryOpening({ mystery }: { mystery: MysteryInfo }) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / OPENING_MS) * 100));
      setProgress(pct);
      if (pct >= 100) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="py-6 relative overflow-hidden" aria-live="polite">
      {/* Tia sao lấp lánh xung quanh túi quà */}
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <Sparkles className="absolute -top-2 -left-2 h-6 w-6 text-amber-400 animate-pulse" />
        <Sparkles className="absolute -bottom-1 -right-2 h-5 w-5 text-rose-400 animate-bounce" />

        {/* Khối túi quà 3D rung lắc dồn dập */}
        <div className="aloha-bag-shake-intense relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-2xl shadow-orange-600/40 ring-4 ring-amber-300/40">
          <Gift size={52} strokeWidth={1.8} className="drop-shadow-md" />
          <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-rose-600 shadow-lg ring-2 ring-rose-200">
            ?
          </span>
        </div>
      </div>

      <p className="mt-5 text-base font-black uppercase tracking-tight text-slate-900 animate-pulse">
        Đang mở túi quà may mắn…
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        Giảm ngẫu nhiên từ <span className="text-rose-600 font-bold">{mystery.min}%</span> đến{" "}
        <span className="text-rose-600 font-bold">{mystery.max}%</span>
      </p>

      {/* Thanh đo hồi hộp lướt nhanh */}
      <div className="mx-auto mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/** Phần đầu modal sau khi bóc: Hào quang xoay + Mưa Confetti + Số nhảy + Huy hiệu trúng thưởng. */
export function MysteryRevealHeader({ mystery }: { mystery: MysteryInfo }) {
  const targetPct = mystery.drawnPercent || mystery.min;
  const currentPct = useNumberTicker(targetPct, mystery.min, true);
  const chance = mystery.tiers.find((t) => t.percent === targetPct)?.chance;
  const top = targetPct >= mystery.max;

  return (
    <div aria-live="polite" className="relative pt-2 pb-1">
      {/* 1. Mưa pháo hoa giấy Confetti rơi khắp modal */}
      <ConfettiRain />

      {/* 2. Tia hào quang mặt trời xoay tròn vàng rực (Sunburst Rays) */}
      <div className="relative mx-auto mb-2 flex h-16 w-16 items-center justify-center">
        <div className="aloha-sunburst-rays" />

        {/* Khối icon cúp / pháo bông nảy lên ở tâm hào quang */}
        <div
          className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl aloha-reveal-pop ${
            top
              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 shadow-orange-600/40 aloha-jackpot-glow"
              : "bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-700/30"
          }`}
        >
          {top ? (
            <Trophy size={30} strokeWidth={2.2} className="drop-shadow-sm text-amber-100" />
          ) : (
            <PartyPopper size={28} strokeWidth={2.2} className="drop-shadow-sm" />
          )}
        </div>
      </div>

      {/* 3. Huy hiệu trúng mức cao nhất (chỉ hiện khi trúng max tier) */}
      {top && (
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 px-3 py-0.5 text-[11px] font-black uppercase text-white shadow-sm aloha-jackpot-glow animate-pulse">
          <Crown size={12} className="text-amber-200 fill-amber-200" />
          <span>KỶ LỤC! MỨC CAO NHẤT</span>
        </div>
      )}

      {/* 4. Con số % to rõ ràng */}
      <div className="my-1 flex items-center justify-center gap-1.5">
        <span className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">GIẢM</span>
        <span className="aloha-reveal-pop tabular-nums bg-gradient-to-r from-[#C8102E] via-[#E11D48] to-orange-500 bg-clip-text text-5xl sm:text-6xl font-black tracking-tight text-transparent drop-shadow-xs leading-none">
          {currentPct}%
        </span>
      </div>

      {/* 5. Dòng chứng nhận đã lưu ngắn gọn */}
      <p className="text-xs font-semibold text-slate-500 mt-0.5">
        Đã lưu vào ví voucher
      </p>
    </div>
  );
}
