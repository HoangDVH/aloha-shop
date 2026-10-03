"use client";

import { useCountdown } from "@/lib/hooks/useCountdown";

/**
 * Đếm ngược hh:mm:ss (kèm "x ngày" khi còn ≥ 1 ngày). Số chạy từng giây bị ẩn khỏi trình đọc màn hình;
 * bản đọc chỉ đổi theo phút để không đọc liên tục.
 */
export function CountdownText({
  target,
  offsetMs,
  className = "",
  boxClass = "",
}: {
  target: number | null;
  offsetMs: number;
  className?: string;
  boxClass?: string;
}) {
  const c = useCountdown(target, offsetMs);
  if (target == null) return null;
  const days = Number(c.d);
  const spoken = days > 0 ? `${days} ngày ${Number(c.h)} giờ` : `${Number(c.h)} giờ ${Number(c.m)} phút`;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <span className="sr-only" aria-live="off">
        còn {spoken}
      </span>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {days > 0 ? <span className={boxClass}>{days}N</span> : null}
        <span className={boxClass}>{c.h}</span>:<span className={boxClass}>{c.m}</span>:
        <span className={boxClass}>{c.s}</span>
      </span>
    </span>
  );
}
