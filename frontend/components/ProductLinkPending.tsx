"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Render inside Link so feedback follows its actual navigation, including failures. */
export function ProductLinkPending({ overlay = false }: { overlay?: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-label="Đang mở sản phẩm"
      className={overlay
        ? "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px]"
        : "pointer-events-none ml-1 inline-flex align-middle"}
    >
      <Loader2 className={overlay ? "h-7 w-7 animate-spin text-[var(--aloha-green)]" : "h-4 w-4 animate-spin text-[var(--aloha-green)]"} aria-hidden />
    </span>
  );
}
