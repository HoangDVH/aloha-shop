"use client";

import { LoaderCircle } from "lucide-react";
import { useDelayedPending } from "@/lib/usePendingValue";

export function PriceUpdateIndicator({ pending, compact = false }: { pending: boolean; compact?: boolean }) {
  const visible = useDelayedPending(pending);
  return <span role="status" aria-live="polite" aria-atomic="true"
    className={`inline-flex h-5 shrink-0 items-center justify-end gap-1 text-[10px] font-normal text-slate-500 ${compact ? "w-4" : "w-[96px]"}`}>
    <span aria-hidden={!visible} className={`inline-flex items-center gap-1 ${visible ? "visible" : "invisible"}`}>
      <LoaderCircle size={12} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      <span className={compact ? "sr-only" : ""}>Đang cập nhật</span>
    </span>
  </span>;
}
