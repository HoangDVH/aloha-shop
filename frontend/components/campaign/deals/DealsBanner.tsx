"use client";

import type { CSSProperties, ReactNode } from "react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { DealsBannerGrid } from "./DealsBannerGrid";

/** Vị trí / nhịp rơi cố định (không random) để server và client render giống nhau. */
const PETALS: { left: number; delay: number; dur: number; size: number }[] = [
  { left: 6, delay: 0, dur: 9, size: 12 },
  { left: 18, delay: 3.2, dur: 11, size: 9 },
  { left: 31, delay: 1.4, dur: 10, size: 11 },
  { left: 47, delay: 5.1, dur: 12, size: 8 },
  { left: 62, delay: 2.3, dur: 9.5, size: 12 },
  { left: 74, delay: 6.4, dur: 11.5, size: 10 },
  { left: 86, delay: 0.8, dur: 10.5, size: 9 },
  { left: 94, delay: 4.2, dur: 12.5, size: 11 },
];

function Petals() {
  return (
    <span className="aloha-petals pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="aloha-petal"
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** Banner chiến dịch đầu trang ưu đãi (banner chính tự trượt + banner phụ) + `below` (ô lối tắt). */
export function DealsBanner({ campaign, below }: { campaign: CampaignUI; below?: ReactNode }) {
  const { banners, hero, colors } = campaign.display;
  const hasMain = banners.some((b) => b.kind === "main" && b.imageUrl);

  return (
    <section aria-label="Banner chương trình" className="-mx-3 sm:mx-0">
      {hasMain ? (
        <div className="relative">
          <DealsBannerGrid banners={banners} />
          <Petals />
        </div>
      ) : (
        <div className="relative aspect-[8/3] overflow-hidden bg-[#F8DCE6] sm:rounded-3xl">
          <div
            className="flex h-full flex-col items-center justify-center px-4 text-center"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}
          >
            <p className="text-xl font-black uppercase tracking-tight text-white drop-shadow sm:text-4xl">{hero.title || campaign.name}</p>
            {hero.subtitle ? <p className="mt-2 text-sm font-medium text-white/90 sm:text-base">{hero.subtitle}</p> : null}
          </div>
          <Petals />
        </div>
      )}
      {below}
      <h1 className="sr-only">{hero.title || campaign.name}</h1>
    </section>
  );
}
