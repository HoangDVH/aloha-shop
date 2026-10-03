"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { FLASH_STAGE_BG, FLASH_STAGE_DEFAULT, stageChips, type StageChip } from "@/lib/campaign/flashSlots";

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

function Chip({ chip }: { chip: StageChip }) {
  const open = chip.status === "open";
  return (
    <Link
      href={`/uu-dai?tab=flash-sale&slot=${encodeURIComponent(chip.key)}`}
      aria-current={open ? "true" : undefined}
      title={chip.label ? `${chip.time} · ${chip.label}` : undefined}
      className={`flex flex-1 lg:flex-initial min-w-[72px] sm:min-w-[92px] flex-col items-center justify-center rounded-xl sm:rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2 text-center transition-all select-none ${
        open
          ? "bg-white text-[#CE2D37] shadow-sm scale-[1.02]"
          : "bg-white/10 hover:bg-white/15 text-white backdrop-blur-xs border border-white/10"
      }`}
    >
      <span className={`text-sm sm:text-base font-black leading-tight ${open ? "text-[#CE2D37]" : "text-white"}`}>{chip.time}</span>
      <span className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 whitespace-nowrap ${open ? "font-bold text-[#CE2D37]/90" : "font-medium text-white/80"}`}>
        {chip.text}
      </span>
    </Link>
  );
}

/** Dải "Sân khấu Flash Sale": chữ do admin đặt trong chiến dịch, khung giờ lấy từ chiến dịch đang chạy. */
export function HomeFlashSaleStage({ className = "" }: { className?: string }) {
  const { campaign, offsetMs } = useCampaignView();
  const now = useNow(offsetMs);
  const stage = campaign?.display.flashStage;
  const text = stage ? { ...stage, title: stage.title.trim() || FLASH_STAGE_DEFAULT.title } : FLASH_STAGE_DEFAULT;
  const chips =
    campaign && now != null ? stageChips(campaign.slots, campaign.phase, now, Date.parse(campaign.endAt)) : [];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4 ${className}`}
      style={{ background: FLASH_STAGE_BG }}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex h-11 w-11 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white shadow-xs">
          <Zap className="h-6 w-6 sm:h-7 sm:w-7 fill-[#CE2D37] text-[#CE2D37]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h2 className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black uppercase tracking-wide text-white leading-tight">
              {text.title}
            </h2>
            {text.badge ? (
              <span className="inline-flex shrink-0 items-center rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase text-[#92400E] shadow-xs">
                {text.badge}
              </span>
            ) : null}
          </div>
          {text.subtitle ? (
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-normal text-white/85 sm:text-white/90 leading-snug">{text.subtitle}</p>
          ) : null}
        </div>
      </div>

      {chips.length ? (
        <nav
          aria-label="Khung giờ flash sale"
          className="flex w-full lg:w-auto items-center gap-2 sm:gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 py-0.5"
        >
          {chips.slice(0, 6).map((c) => (
            <Chip key={c.key} chip={c} />
          ))}
        </nav>
      ) : null}
    </div>
  );
}
