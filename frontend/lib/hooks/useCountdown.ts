"use client";

import { useEffect, useState } from "react";

export type CountdownParts = { d: string; h: string; m: string; s: string; done: boolean; ms: number };

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function splitCountdown(ms: number): CountdownParts {
  const left = Math.max(0, ms);
  const totalSec = Math.floor(left / 1000);
  return {
    d: pad(Math.floor(totalSec / 86400)),
    h: pad(Math.floor((totalSec % 86400) / 3600)),
    m: pad(Math.floor((totalSec % 3600) / 60)),
    s: pad(totalSec % 60),
    done: left <= 0,
    ms: left,
  };
}

/** Cuối ngày hôm nay theo giờ máy (flash sale cũ không có chiến dịch). */
export function endOfTodayMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Đếm ngược tới `target` (ms epoch hoặc hàm trả về mốc). `serverOffsetMs` = serverNow − Date.now()
 * để bù đồng hồ máy khách lệch. Interval được dọn khi unmount.
 */
export function useCountdown(
  target: number | (() => number) | null | undefined,
  serverOffsetMs = 0
): CountdownParts {
  const resolve = () => {
    if (target == null) return 0;
    const t = typeof target === "function" ? target() : target;
    return t - (Date.now() + serverOffsetMs);
  };
  const [parts, setParts] = useState<CountdownParts>(() => splitCountdown(0));
  const key = typeof target === "function" ? "fn" : String(target ?? "");
  useEffect(() => {
    const tick = () => setParts(splitCountdown(resolve()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serverOffsetMs]);
  return parts;
}
