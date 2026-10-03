"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { CalendarClock } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { dealsHref } from "@/lib/campaign/dealsTabs";
import { CampaignCountdown } from "./CampaignCountdown";
import { DealsShare } from "./DealsShare";

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

/** Link banner trỏ về chính trang tổng quan thì không bọc thẻ a (bấm không làm gì, tránh nhảy trang). */
function bannerHref(href: string): string | null {
  const to = dealsHref(href)?.trim() || "";
  if (!to || /^\/uu-dai\/?(\?src=[^&]*)?$/.test(to)) return null;
  return to;
}

/** Banner chiến dịch đầu trang ưu đãi (ảnh riêng cho điện thoại nếu có) + dải đếm ngược. */
export function DealsBanner({ campaign, offsetMs }: { campaign: CampaignUI; offsetMs: number }) {
  const { banners, hero, colors } = campaign.display;
  const main = banners.find((b) => b.kind === "main" && b.imageUrl);
  const alt = main?.alt || hero.title || campaign.name;
  const mobileSrc = main?.mobileImageUrl || "";

  const picture = main ? (
    <picture>
      {mobileSrc ? <source media="(max-width: 767px)" srcSet={mobileSrc} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={main.imageUrl}
        alt={alt}
        width={1600}
        height={600}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  ) : null;
  const href = main ? bannerHref(main.href) : null;
  const deadline = hero.deadline?.trim() || "";
  const title = hero.title || campaign.name;

  return (
    <section aria-label="Banner chương trình" className="-mx-3 sm:mx-0">
      <div
        className={`relative overflow-hidden bg-[#F8DCE6] sm:rounded-3xl ${mobileSrc ? "aspect-[9/5] md:aspect-[8/3]" : "aspect-[8/3]"}`}
      >
        {picture ? (
          href ? (
            <Link href={href} className="block h-full w-full">
              {picture}
            </Link>
          ) : (
            picture
          )
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center px-4 text-center"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}
          >
            <p className="text-xl font-black uppercase tracking-tight text-white drop-shadow sm:text-4xl">{hero.title || campaign.name}</p>
            {hero.subtitle ? <p className="mt-2 text-sm font-medium text-white/90 sm:text-base">{hero.subtitle}</p> : null}
          </div>
        )}
        <Petals />
      </div>
      <div className="relative z-10 mx-3 -mt-4 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_6px_20px_rgba(194,24,91,0.12)] ring-1 ring-black/[0.04] sm:mx-6 sm:-mt-6 sm:px-5 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="line-clamp-1 min-w-0 flex-1 text-[13px] font-black uppercase tracking-tight text-[var(--campaign-primary)] sm:text-base">
              {title}
            </h1>
            <span className="sm:hidden">
              <DealsShare title={title} />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CampaignCountdown endsAt={campaign.endAt} offsetMs={offsetMs} />
            <span className="hidden sm:block">
              <DealsShare title={title} />
            </span>
          </div>
        </div>
        {deadline ? (
          <p className="mt-2 flex items-start gap-1.5 border-t border-dashed border-[#F8BBD0] pt-2 text-[12px] font-semibold leading-snug text-[#880E4F] sm:text-[13px]">
            <CalendarClock size={15} className="mt-px shrink-0 text-[var(--campaign-primary)]" aria-hidden />
            <span>{deadline}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
