"use client";

import Link from "next/link";
import { HeroBanner, type HeroSlide } from "@/components/HeroBanner";
import type { CampaignBannerUI } from "@/lib/campaign/campaignApi";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { dealsHref } from "@/lib/campaign/dealsTabs";

function toSlide(b: CampaignBannerUI): HeroSlide {
  return { src: b.imageUrl, mobileSrc: b.mobileImageUrl, alt: b.alt || "Ưu đãi chiến dịch", href: dealsHref(b.href) };
}

function SideBanner({ banner }: { banner: CampaignBannerUI }) {
  return (
    <Link
      href={dealsHref(banner.href)}
      className="relative block aspect-[2/1] overflow-hidden rounded-xl bg-[#f7faf5] lg:aspect-auto lg:h-full lg:w-full min-h-0"
    >
      <picture className="block h-full w-full">
        {banner.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.imageUrl}
          alt={banner.alt || "Ưu đãi"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </picture>
    </Link>
  );
}

/**
 * Cụm banner trang chủ: slide chiến dịch đứng đầu carousel; có banner phụ thì chia 1 lớn + 2 nhỏ
 * (desktop cột phải, mobile hàng dưới). Hết chiến dịch → banner chính giãn full như cũ.
 */
export function HomeBannerGrid({ slides }: { slides?: HeroSlide[] }) {
  const { campaign } = useCampaignView();
  const banners = campaign?.display.banners || [];
  const leading = banners.filter((b) => b.kind === "main").map(toSlide);
  const sides = banners.filter((b) => b.kind === "side").slice(0, 2);
  const hero = <HeroBanner slides={slides} leading={leading} />;
  if (!sides.length) return hero;
  return (
    <div className="home-banner-grid lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] lg:gap-3 lg:px-4 lg:pt-3 lg:items-stretch">
      {/* 8fr/3fr: banner chính 8:3 (1600×600) và 2 banner phụ 2:1 (1600×800) cao bằng nhau. */}
      <div className="min-w-0 overflow-hidden lg:rounded-xl lg:w-full lg:aspect-[8/3]">{hero}</div>
      {/* absolute: chiều cao hàng chỉ theo banner chính 8:3; nếu cột phụ góp chiều cao, banner chính bị kéo cao và cắt hai bên. */}
      <div className="px-4 pt-2 lg:relative lg:px-0 lg:pt-0">
        <div className="grid grid-cols-2 gap-2 lg:absolute lg:inset-0 lg:grid-cols-1 lg:grid-rows-2 lg:gap-3">
          {sides.map((b) => (
            <SideBanner key={b.id} banner={b} />
          ))}
        </div>
      </div>
    </div>
  );
}
