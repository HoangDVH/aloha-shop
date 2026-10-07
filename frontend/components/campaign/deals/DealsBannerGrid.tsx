"use client";

import Link from "next/link";
import { HeroBanner, type HeroSlide } from "@/components/HeroBanner";
import type { CampaignBannerUI } from "@/lib/campaign/campaignApi";
import { dealsHref } from "@/lib/campaign/dealsTabs";
import { useVoucherModal } from "@/lib/campaign/useVoucherModal";

const ALOHA_ZALO_URL = "https://zalo.me/0794901233";

/**
 * Phân loại hành động click cho từng banner trên trang Ưu đãi:
 * - Ảnh 1 (Banner 20/10): Bấm vào chuyển sang trang Zalo tư vấn (giống lúc bấm nút Zalo)
 * - Ảnh 2 (Banner 10/10): Bấm vào hiện popup Kho Voucher (giống lúc bấm nút Voucher trên header)
 */
function getBannerAction(b: CampaignBannerUI, index: number): "zalo" | "voucher" | "default" {
  const text = `${b.imageUrl || ""} ${b.mobileImageUrl || ""} ${b.href || ""} ${b.alt || ""}`.toLowerCase();

  // 1. Nhận diện theo hình ảnh / nội dung chiến dịch
  if (
    text.includes("2010") ||
    text.includes("20-10") ||
    text.includes("phụ nữ") ||
    text.includes("phu nu") ||
    text.includes("đặt quà") ||
    text.includes("dat qua") ||
    text.includes("zalo")
  ) {
    return "zalo";
  }

  if (
    text.includes("1010") ||
    text.includes("10-10") ||
    text.includes("voucher") ||
    text.includes("chào mừng") ||
    text.includes("chao mung")
  ) {
    return "voucher";
  }

  // 2. Mặc định theo thứ tự: ảnh 1 = Zalo, ảnh 2 = Popup Voucher
  if (index === 0) return "zalo";
  if (index === 1) return "voucher";

  return "default";
}

function toSlide(b: CampaignBannerUI, index: number, onOpenVoucher: () => void): HeroSlide {
  const action = getBannerAction(b, index);

  if (action === "zalo") {
    return {
      src: b.imageUrl,
      mobileSrc: b.mobileImageUrl,
      alt: b.alt || "Mừng ngày Phụ nữ Việt Nam 20/10 — Nhắn ALOHA đặt quà qua Zalo",
      href: ALOHA_ZALO_URL,
      target: "_blank",
      rel: "noopener noreferrer",
      cta: "Nhắn Zalo đặt quà",
    };
  }

  if (action === "voucher") {
    return {
      src: b.imageUrl,
      mobileSrc: b.mobileImageUrl,
      alt: b.alt || "Chào mừng 10/10 — Kho Voucher ưu đãi",
      href: "/uu-dai?tab=voucher",
      cta: "Nhận voucher ưu đãi",
      onClick: (e) => {
        e.preventDefault();
        onOpenVoucher();
      },
    };
  }

  return {
    src: b.imageUrl,
    mobileSrc: b.mobileImageUrl,
    alt: b.alt || "Ưu đãi chiến dịch",
    href: dealsHref(b.href),
  };
}

function SideBanner({
  banner,
  index,
  onOpenVoucher,
}: {
  banner: CampaignBannerUI;
  index: number;
  onOpenVoucher: () => void;
}) {
  const action = getBannerAction(banner, index);
  const href = action === "zalo" ? ALOHA_ZALO_URL : action === "voucher" ? "/uu-dai?tab=voucher" : dealsHref(banner.href);
  const target = action === "zalo" ? "_blank" : undefined;
  const rel = action === "zalo" ? "noopener noreferrer" : undefined;
  const handleClick =
    action === "voucher"
      ? (e: React.MouseEvent) => {
          e.preventDefault();
          onOpenVoucher();
        }
      : undefined;

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      onClick={handleClick}
      className="relative block aspect-[2/1] overflow-hidden rounded-xl bg-[#f7faf5] lg:aspect-auto lg:h-full lg:w-full min-h-0 cursor-pointer"
    >
      <picture className="block h-full w-full">
        {banner.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.imageUrl}
          alt={banner.alt || (action === "zalo" ? "Tư vấn Zalo" : action === "voucher" ? "Nhận voucher" : "Ưu đãi")}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </picture>
    </Link>
  );
}

/**
 * Cụm banner đầu trang Ưu đãi: banner chính (từ 2 ảnh thì tự trượt) + tối đa 2 banner phụ
 * (desktop cột phải, mobile hàng dưới).
 * - Bấm ảnh 1 (20/10) -> mở Zalo Aloha
 * - Bấm ảnh 2 (10/10) -> mở popup Kho Voucher
 */
export function DealsBannerGrid({ banners }: { banners: CampaignBannerUI[] }) {
  const { openModal } = useVoucherModal();

  const mains = banners
    .filter((b) => b.kind === "main" && b.imageUrl)
    .map((b, i) => toSlide(b, i, openModal));

  const sides = banners.filter((b) => b.kind === "side" && b.imageUrl).slice(0, 2);
  const hero = <HeroBanner leading={mains} heading={false} />;

  if (!sides.length) {
    return <div className="deals-banner-grid overflow-hidden sm:rounded-3xl lg:aspect-[8/3]">{hero}</div>;
  }
  return (
    <div className="deals-banner-grid lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] lg:gap-3 lg:items-stretch">
      {/* 8fr/3fr: banner chính 8:3 (1600×600) và 2 banner phụ 2:1 (1600×800) cao bằng nhau. */}
      <div className="min-w-0 overflow-hidden sm:rounded-2xl lg:w-full lg:aspect-[8/3]">{hero}</div>
      {/* absolute: chiều cao hàng chỉ theo banner chính 8:3; nếu cột phụ góp chiều cao, banner chính bị kéo cao và cắt hai bên. */}
      <div className="px-3 pt-2 sm:px-0 lg:relative lg:pt-0">
        <div className="grid grid-cols-2 gap-2 lg:absolute lg:inset-0 lg:grid-cols-1 lg:grid-rows-2 lg:gap-3">
          {sides.map((b, i) => (
            <SideBanner key={b.id} banner={b} index={i} onOpenVoucher={openModal} />
          ))}
        </div>
      </div>
    </div>
  );
}
