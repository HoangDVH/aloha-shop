"use client";

import type { CSSProperties, ReactNode } from "react";
import type { CampaignBannerUI, CampaignUI } from "@/lib/campaign/campaignApi";
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

/** Banner mặc định của chiến dịch nếu backend chưa cấu hình ảnh main */
const DEFAULT_DEALS_BANNERS: CampaignBannerUI[] = [
  {
    id: "banner_2010_default",
    kind: "main",
    imageUrl: "/banners/banner-2010-desktop.webp",
    mobileImageUrl: "/banners/banner-2010-mobile.webp",
    alt: "Mừng ngày Phụ nữ Việt Nam 20/10 — Nhắn ALOHA đặt quà",
    href: "https://zalo.me/0794901233",
  },
  {
    id: "banner_1010_default",
    kind: "main",
    imageUrl: "/banners/banner-1010-desktop.webp",
    alt: "Chào mừng 10/10 — Kho Voucher ưu đãi",
    href: "/uu-dai?tab=voucher",
  },
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
  const { banners, hero } = campaign.display;
  const hasMain = banners.some((b) => b.kind === "main" && b.imageUrl);
  const effectiveBanners = hasMain ? banners : DEFAULT_DEALS_BANNERS;

  return (
    <section aria-label="Banner chương trình" className="-mx-3 sm:mx-0">
      <div className="relative">
        <DealsBannerGrid banners={effectiveBanners} />
        <Petals />
      </div>
      {below}
      <h1 className="sr-only">{hero.title || campaign.name}</h1>
    </section>
  );
}
