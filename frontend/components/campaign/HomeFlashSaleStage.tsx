"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { stageChips } from "@/lib/campaign/flashSlots";
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

function CountdownBox({ children }: { children: string }) {
  return (
    <span className="min-w-[1.4rem] rounded-[4px] bg-slate-900 px-1 py-[3px] text-center leading-none text-white">
      {children}
    </span>
  );
}

/**
 * Tiêu đề Flash Sale trang chủ kiểu Shopee: một dòng nền trắng, chữ đỏ, đồng hồ ô đen.
 * Tên đợt sale nằm ở banner chính và trang Ưu đãi, ở đây luôn là "Flash Sale".
 */
export function HomeFlashSaleStage({ className = "" }: { className?: string }) {
  const { campaign, offsetMs } = useCampaignView();
  const now = useNow(offsetMs);
  const chips =
    campaign && now != null ? stageChips(campaign.slots, campaign.phase, now, Date.parse(campaign.endAt)) : [];

  const openKey = chips.find((c) => c.status === "open")?.key ?? null;
  const openSlot = (campaign?.slots || []).find((s) => s.key === openKey);
  const nowMs = Date.now() + offsetMs;
  const endTarget = getSlotEndTargetMs(openSlot, nowMs);
  const cd = useCountdown(endTarget, offsetMs);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 shadow-2xs ring-1 ring-black/5 sm:px-4 sm:py-2.5 ${className}`}
    >
      <Link
        href="/uu-dai?tab=flash-sale"
        className="flex min-w-0 items-center gap-2.5 sm:gap-3"
        title="Xem tất cả Flash Sale"
      >
        <h2 className="flex items-center gap-1 whitespace-nowrap text-[17px] font-black uppercase italic leading-none tracking-tight text-[#CE2D37] sm:text-xl">
          <Zap className="h-4 w-4 fill-current sm:h-5 sm:w-5" aria-hidden />
          Flash Sale
        </h2>
        {openSlot && endTarget && !cd.done ? (
          <span
            className="flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-slate-900 sm:text-xs"
            aria-label={`Kết thúc sau ${cd.h} giờ ${cd.m} phút ${cd.s} giây`}
          >
            <CountdownBox>{cd.h}</CountdownBox>
            <span aria-hidden>:</span>
            <CountdownBox>{cd.m}</CountdownBox>
            <span aria-hidden>:</span>
            <CountdownBox>{cd.s}</CountdownBox>
          </span>
        ) : null}
      </Link>

      <Link
        href="/uu-dai?tab=flash-sale"
        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-[#CE2D37] hover:underline sm:text-sm"
        title="Xem tất cả khung giờ flash sale"
      >
        Xem tất cả
        <ChevronRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
