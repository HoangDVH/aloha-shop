"use client";

import { useEffect } from "react";

/** Chuyển người dùng sang trang SP; bot Facebook vẫn đọc OG trên /sp/[ma]. */
export function ShareRedirect({ href }: { href: string }) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      window.location.replace(href);
    }, 80);
    return () => window.clearTimeout(t);
  }, [href]);
  return null;
}
