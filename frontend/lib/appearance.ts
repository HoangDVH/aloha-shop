import { shopApiBase } from "./api";
import type { AppearanceBlock, NavConfig, AppearanceTheme } from "./appearanceTypes";

export type PublicAppearance = {
  theme: AppearanceTheme;
  blocks: AppearanceBlock[];
  nav: NavConfig;
  version: number;
  publishedAt: string | null;
};

const FALLBACK_BLOCKS: AppearanceBlock[] = [
  {
    id: "seed_hero",
    type: "hero",
    enabled: true,
    props: { useDefaultBanners: true },
  },
  {
    id: "seed_feature",
    type: "feature_strip",
    enabled: true,
    props: { variant: "why_aloha" },
  },
  {
    id: "seed_hot",
    type: "product_section",
    enabled: true,
    props: {
      title: "Sản phẩm bán chạy",
      source: "ban_chay",
      limit: 15,
      sort: "ban_chay",
    },
  },
  {
    id: "seed_cay",
    type: "product_section",
    enabled: true,
    props: {
      title: "Cây thành phẩm",
      source: "category",
      categoryId: 686422,
      categoryName: "CÂY THÀNH PHẨM TRỒNG SẴN",
      categorySlug: "cay-thanh-pham-trong-san",
      nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN",
      nhomSlug: "cay-thanh-pham-trong-san",
      nhomName: "CÂY THÀNH PHẨM TRỒNG SẴN",
      limit: 15,
      sort: "ban_chay",
    },
  },
  {
    id: "seed_articles",
    type: "article_section",
    enabled: true,
    props: {
      title: "Bài viết mới",
      limit: 3,
    },
  },
];

export function fallbackAppearance(): PublicAppearance {
  return {
    theme: {
      siteName: "ALOHA Thế Giới Chậu Cây",
      logoUrl: "/brand/logo-header-on-theme.png?v=1",
      primaryColor: "#3D6B3A",
      headerBg: "#3D6B3A",
      fontFamily: "system",
      faviconUrl: "/brand/logo-icon.png",
      seo: {
        title: "ALOHA Thế Giới Chậu Cây",
        description:
          "Mua chậu cây & cây cảnh tại ALOHA Thế Giới Chậu Cây — TP.HCM. Xanh mát, dễ chọn, giao nhanh.",
      },
      popup: {
        enabled: false,
        campaignId: "welcome",
        title: "Chào mừng đến ALOHA",
        body: "Xem cây cảnh & chậu đẹp — giao nhanh TP.HCM.",
        imageUrl: "",
        ctaLabel: "Xem sản phẩm",
        ctaHref: "/tim",
        couponCode: "",
        delaySeconds: 4,
        frequencyDays: 7,
        showOncePerCampaign: true,
      },
      footer: {
        address: "90/2 Nguyễn Phúc Chu, Phường Tân Bình, Thành phố Hồ Chí Minh",
        phone: "079 490 1233",
        email: "alohathegioichaucay01@gmail.com",
        zalo: "079 490 1233",
      },
    },
    blocks: FALLBACK_BLOCKS,
    nav: { hiddenCategoryPaths: [], customItems: [] },
    version: 0,
    publishedAt: null,
  };
}

export async function fetchAppearance(): Promise<PublicAppearance> {
  try {
    const url = `${shopApiBase()}/api/shop/appearance`;
    // Cache ngắn 30s — giảm SSR dưới tải; publish giao diện tối đa trễ ~30s
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return fallbackAppearance();
    const data = await res.json();
    if (!Array.isArray(data?.blocks)) return fallbackAppearance();
    return {
      theme: data.theme || fallbackAppearance().theme,
      blocks: data.blocks,
      nav: data.nav || { hiddenCategoryPaths: [], customItems: [] },
      version: Number(data.version) || 0,
      publishedAt: data.publishedAt || null,
    };
  } catch {
    return fallbackAppearance();
  }
}
