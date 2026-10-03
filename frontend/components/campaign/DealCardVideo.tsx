"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Video xem trước trên ảnh thẻ: chỉ máy có chuột, chạy khi rê vào (tắt tiếng, không tải trước).
 * Điện thoại giữ ảnh tĩnh để không tốn dung lượng; video xem ở dải "Xem cây thật".
 */
export function DealCardVideo({ src, hovering }: { src: string; hovering: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [canHover, setCanHover] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setCanHover(Boolean(mq?.matches) && !reduce);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (hovering) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hovering, canHover]);

  if (!src || !canHover) return null;
  return (
    <video
      ref={ref}
      src={hovering || ready ? src : undefined}
      muted
      loop
      playsInline
      preload="none"
      onLoadedData={() => setReady(true)}
      className={`pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover transition-opacity duration-300 ${
        hovering && ready ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    />
  );
}
