"use client";

import { useEffect } from "react";

/** Chuyển người dùng sang trang SP; bot Facebook vẫn đọc OG trên /sp/[ma]. */
export function ShareRedirect({ href }: { href: string }) {
  useEffect(() => {
    if (!href) return;
    // Ngay lập tức — không delay (Strict Mode dễ clearTimeout trước khi chạy).
    window.location.replace(href);
  }, [href]);
  return null;
}
