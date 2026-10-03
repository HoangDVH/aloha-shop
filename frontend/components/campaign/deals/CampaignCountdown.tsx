"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { splitCountdown, useCountdown } from "@/lib/hooks/useCountdown";

const DAY_MS = 86_400_000;

function Box({ value, urgent }: { value: string; urgent: boolean }) {
  return (
    <span
      className={`inline-flex h-8 min-w-8 items-center justify-center overflow-hidden rounded-md px-1.5 text-sm font-black tabular-nums text-white shadow-sm [perspective:200px] sm:h-9 sm:min-w-9 sm:text-base ${
        urgent ? "bg-[#E53935]" : "bg-[#3B1F2B]"
      }`}
    >
      <span key={value} className="aloha-flip inline-block">
        {value}
      </span>
    </span>
  );
}

/** "Kết thúc sau 18 ngày : 05 : 12 : 30" kiểu sàn; dưới 24 giờ chuyển đỏ, hết giờ thì ẩn. */
export function CampaignCountdown({ endsAt, offsetMs, label = "Kết thúc sau" }: { endsAt: string; offsetMs: number; label?: string }) {
  const target = Date.parse(endsAt);
  const ticked = useCountdown(Number.isFinite(target) ? target : null, offsetMs);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!Number.isFinite(target) || !mounted) return <div className="h-9" aria-hidden />;
  const c = ticked.ms > 0 ? ticked : splitCountdown(target - (Date.now() + offsetMs));
  if (c.done) return null;
  const urgent = c.ms < DAY_MS;
  const days = Number(c.d);
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" role="timer" aria-live="off">
      <span
        className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide sm:text-[13px] ${
          urgent ? "text-[#E53935]" : "text-[#5B2A3C]"
        }`}
      >
        <Clock size={15} className={urgent ? "animate-pulse" : ""} aria-hidden />
        {urgent ? "Sắp kết thúc" : label}
      </span>
      <span className="flex items-center gap-1 text-[#3B1F2B]" aria-label={`${days} ngày ${c.h} giờ ${c.m} phút ${c.s} giây`}>
        {days > 0 ? (
          <>
            <Box value={String(days)} urgent={urgent} />
            <span className="mr-0.5 text-xs font-bold">ngày</span>
          </>
        ) : null}
        <Box value={c.h} urgent={urgent} />
        <span className="font-black">:</span>
        <Box value={c.m} urgent={urgent} />
        <span className="font-black">:</span>
        <Box value={c.s} urgent={urgent} />
      </span>
    </div>
  );
}
