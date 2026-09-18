"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * URL legacy kiểu /?SP=TNM2L hoặc /?sp=TNM2L → /sp/TNM2L
 * (một số client/KV cũ gắn query trên trang chủ thay vì path PDP).
 */
export function HomeSpQueryRedirect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const raw = String(sp.get("SP") || sp.get("sp") || sp.get("ma") || "").trim();
    if (!raw) return;
    const ma = raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    if (!ma) return;
    router.replace(`/sp/${encodeURIComponent(ma)}`);
  }, [router, sp]);

  return null;
}
