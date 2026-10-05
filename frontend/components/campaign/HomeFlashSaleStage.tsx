"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame, Zap } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { FLASH_STAGE_BG, flashStageText, stageChips } from "@/lib/campaign/flashSlots";
import { useCountdown } from "@/lib/hooks/useCountdown";

function getSlotEndTargetMs(slot: { start: string; end: string } | undefined, nowMs: number): number | null {
  if (!slot) return null;
  const d = new Date(nowMs + 7 * 3600_000);
  const [endH, endM] = slot.end.split(":").map(Number);
  const [startH] = slot.start.split(":").map(Number);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  let endUtc = Date.UTC(y, m, day, endH || 0, endM || 0) - 7 * 3600_000;
  if ((endH || 0) < (startH || 0) && d.getUTCHours() >= (startH || 0)) {
    endUtc += 86_400_000;
  }
  return endUtc;
}

/**
 * Giờ hiện tại theo server, chỉ có sau khi mount (tránh lệch HTML server/client).
 * Cập nhật đúng đầu mỗi phút (khung giờ tính theo phút) để chip đổi trạng thái ngay lúc mở / đóng khung.
 */
function useNow(offsetMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now() + offsetMs;
      setNow(n);
      t = setTimeout(tick, 60_000 - (n % 60_000) + 50);
    };
    tick();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(t);
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [offsetMs]);
  return now;
}

/** Dải "Sân khấu Flash Sale": Tối ưu chuẩn Shopee Minimal Header trên cả Mobile & Desktop. */
export function HomeFlashSaleStage({ className = "" }: { className?: string }) {
  const { campaign, offsetMs } = useCampaignView();
  const now = useNow(offsetMs);
  const text = flashStageText(campaign?.display.flashStage);
  const chips =
    campaign && now != null ? stageChips(campaign.slots, campaign.phase, now, Date.parse(campaign.endAt)) : [];

  const openKey = chips.find((c) => c.status === "open")?.key ?? null;
  const openSlot = (campaign?.slots || []).find((s) => s.key === openKey);
  const nowMs = Date.now() + offsetMs;
  const endTarget = getSlotEndTargetMs(openSlot, nowMs);
  const cd = useCountdown(endTarget, offsetMs);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl px-3 py-2.5 sm:px-5 sm:py-3 shadow-sm text-white flex items-center justify-between gap-3 sm:gap-5 ${className}`}
      style={{ background: FLASH_STAGE_BG }}
    >
      {/* BÊN TRÁI: ICON + TIÊU ĐỀ + BADGE + ĐỒNG HỒ ĐẾM NGƯỢC (CHUẨN SHOPEE) */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <Link
          href="/uu-dai?tab=flash-sale"
          className="flex h-7.5 w-7.5 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-xs transition-transform hover:scale-105"
          title="Xem tất cả Flash Sale"
        >
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 fill-[#CE2D37] text-[#CE2D37]" />
        </Link>

        <Link
          href="/uu-dai?tab=flash-sale"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0 group"
          title="Xem tất cả Flash Sale"
        >
          <h2 className="text-[13.5px] sm:text-base lg:text-lg font-black uppercase tracking-wide text-white leading-tight whitespace-nowrap group-hover:underline">
            <span className="sm:hidden">Flash Sale</span>
            <span className="hidden sm:inline">{text.title}</span>
          </h2>

          {text.badge ? (
            <span className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[9.5px] sm:text-xs font-black uppercase text-[#92400E] shadow-xs">
              {text.badge}
            </span>
          ) : null}
        </Link>

        {/* ĐỒNG HỒ ĐẾM NGƯỢC CHUẨN SHOPEE */}
        {openSlot && endTarget && !cd.done ? (
          <Link
            href="/uu-dai?tab=flash-sale"
            className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl bg-black/25 backdrop-blur-xs border border-white/15 px-2 py-1 text-white hover:bg-black/35 transition-colors shrink-0"
            title="Đang diễn ra flash sale"
          >
            <Flame size={13} className="fill-[#FFD54F] text-[#FFD54F] shrink-0 animate-pulse" />
            <div className="flex items-center gap-0.5 text-[11px] sm:text-xs font-black tabular-nums">
              <span className="rounded bg-black/40 px-1 py-0.5 leading-none">{cd.h}</span>
              <span className="text-white/80">:</span>
              <span className="rounded bg-black/40 px-1 py-0.5 leading-none">{cd.m}</span>
              <span className="text-white/80">:</span>
              <span className="rounded bg-black/40 px-1 py-0.5 leading-none">{cd.s}</span>
            </div>
          </Link>
        ) : null}
      </div>

      {/* BÊN PHẢI: NÚT XEM TẤT CẢ */}
      <Link
        href="/uu-dai?tab=flash-sale"
        className="inline-flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm font-bold text-white/95 hover:text-white hover:underline whitespace-nowrap shrink-0 pl-1"
        title="Xem tất cả khung giờ flash sale"
      >
        <span>Xem tất cả</span>
        <ChevronRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
