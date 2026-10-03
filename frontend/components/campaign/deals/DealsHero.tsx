"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { useCountdown } from "@/lib/hooks/useCountdown";

export function DealsHero({ campaign, offsetMs }: { campaign: CampaignUI; offsetMs: number }) {
  const { hero, colors } = campaign.display;
  const target = campaign.phaseEndsAt ? Date.parse(campaign.phaseEndsAt) : null;
  const last = campaign.phase === "lastHours";
  const c = useCountdown(target, offsetMs);

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10 text-white"
      style={{
        background: `linear-gradient(135deg, ${colors.primary || "#A8001E"} 0%, ${colors.accent || "#C8102E"} 100%)`,
      }}
    >
      {/* Glow trang trí */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-black/10 blur-2xl" />

      <div className="relative z-10 max-w-xl space-y-4">
        {/* Tiêu đề */}
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
          {hero.title || campaign.name}
        </h1>

        {/* Mô tả */}
        {hero.subtitle && (
          <p className="text-sm sm:text-base text-white/85 leading-snug">
            {hero.subtitle}
          </p>
        )}

        {/* Đồng hồ đếm ngược */}
        {target && !c.done ? (
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-white/80 text-xs">
              <Flame size={13} className="fill-amber-300 text-amber-300" />
              {last ? "Còn:" : "Kết thúc sau:"}
            </span>
            <div className="flex items-center gap-1 font-black tabular-nums">
              {Number(c.d) > 0 && (
                <>
                  <span className="rounded-md bg-black/30 px-2 py-1 text-sm">{c.d}<span className="text-[10px] font-normal ml-0.5">N</span></span>
                  <span className="opacity-60">:</span>
                </>
              )}
              <span className="rounded-md bg-black/30 px-2 py-1 text-sm">{c.h}<span className="text-[10px] font-normal ml-0.5">H</span></span>
              <span className="opacity-60">:</span>
              <span className="rounded-md bg-black/30 px-2 py-1 text-sm">{c.m}<span className="text-[10px] font-normal ml-0.5">M</span></span>
              <span className="opacity-60">:</span>
              <span className="rounded-md bg-black/30 px-2 py-1 text-sm text-amber-300">{c.s}<span className="text-[10px] font-normal ml-0.5">S</span></span>
            </div>
          </div>
        ) : null}

        {/* Nút CTA */}
        <div className="pt-1">
          <Link
            href="/uu-dai?tab=deal-hot"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-black shadow-md transition hover:bg-amber-50 active:scale-95"
            style={{ color: colors.primary || "#C8102E" }}
          >
            <Flame size={15} className="fill-current" />
            Xem ưu đãi
          </Link>
        </div>
      </div>
    </section>
  );
}
