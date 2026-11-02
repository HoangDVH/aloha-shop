"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { DealsShareModal } from "./DealsShareModal";
import { useHydrated } from "@/lib/useHydratedQuery";

export type DealsShareButtonVariant = "banner" | "fab" | "pill";

export function DealsShareButton({
  campaign,
  variant = "banner",
  className = "",
}: {
  campaign?: CampaignUI | null;
  variant?: DealsShareButtonVariant;
  className?: string;
}) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [scrolledPast, setScrolledPast] = useState(false);

  // Hiển thị nút FAB khi người dùng cuộn qua banner (> 280px)
  useEffect(() => {
    if (variant !== "fab") return;
    const onScroll = () => {
      setScrolledPast(window.scrollY > 280);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  if (!hydrated) return null;

  // 1. NÚT NỔI (FAB) - Tự động hiện khi cuộn trang
  if (variant === "fab") {
    if (!scrolledPast) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chia sẻ trang ưu đãi này"
          title="Chia sẻ trang ưu đãi"
          className={`fixed left-3.5 bottom-20 z-30 sm:left-6 sm:bottom-6 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-lg shadow-rose-950/15 ring-1 ring-rose-200/80 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 animate-in fade-in zoom-in-75 ${className}`}
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <Share2 size={18} className="text-rose-600" />
          </span>
        </button>
        {open && <DealsShareModal campaign={campaign} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // 2. NÚT PILL (Chân trang hoặc thanh tác vụ)
  if (variant === "pill") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-rose-200/90 bg-white/95 backdrop-blur-xs px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-rose-300 hover:bg-white hover:text-rose-600 hover:shadow-sm active:scale-[0.98] select-none ${className}`}
        >
          <Share2
            size={15}
            className="text-rose-500 shrink-0 transition-colors duration-200 group-hover:text-rose-600"
          />
          <span>Chia sẻ ưu đãi</span>
        </button>
        {open && <DealsShareModal campaign={campaign} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // 3. NÚT TRÊN BANNER (Mặc định)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chia sẻ chương trình ưu đãi"
        className={`group inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-semibold text-stone-800 shadow-md backdrop-blur-md transition-all duration-200 hover:bg-white hover:scale-105 hover:shadow-lg active:scale-95 select-none ${className}`}
      >
        <Share2
          size={14}
          className="text-rose-600 transition-transform duration-200 group-hover:rotate-12"
        />
        <span className="hidden xs:inline">Chia sẻ</span>
        <span className="xs:hidden">Share</span>
      </button>
      {open && <DealsShareModal campaign={campaign} onClose={() => setOpen(false)} />}
    </>
  );
}
