import type { AppearanceLayout } from "./types.js";
import { defaultPopup, defaultSeo } from "./types.js";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Khớp hardcode trang chủ shop hiện tại — parity khi chưa chỉnh. */
export function buildDefaultAppearanceLayout(): AppearanceLayout {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    theme: {
      siteName: "ALOHA Thế Giới Chậu Cây",
      logoUrl: "/brand/logo-header-on-theme.png?v=1",
      primaryColor: "#3D6B3A",
      headerBg: "#3D6B3A",
      fontFamily: "system",
      faviconUrl: "/brand/logo-icon.png",
      seo: defaultSeo(),
      popup: defaultPopup(),
      footer: {
        address: "90/2 Nguyễn Phúc Chu, Phường Tân Bình, Thành phố Hồ Chí Minh",
        phone: "079 490 1233",
        email: "alohathegioichaucay01@gmail.com",
        zalo: "079 490 1233",
      },
    },
    nav: {
      hiddenCategoryPaths: [],
      customItems: [],
    },
    blocks: [
      {
        id: id("hero"),
        type: "hero",
        enabled: true,
        props: {
          useDefaultBanners: true,
          slides: [],
        },
      },
      {
        id: id("feature"),
        type: "feature_strip",
        enabled: true,
        props: { variant: "why_aloha" },
      },
      {
        id: id("hot"),
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
        id: id("cay"),
        type: "product_section",
        enabled: true,
        props: {
          title: "Cây thành phẩm",
          source: "category",
          categoryId: 686422,
          categoryName: "CÂY THÀNH PHẨM TRỒNG SẴN",
          categorySlug: "cay-thanh-pham-trong-san",
          // legacy (tương thích block cũ)
          nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN",
          nhomSlug: "cay-thanh-pham-trong-san",
          nhomName: "CÂY THÀNH PHẨM TRỒNG SẴN",
          limit: 15,
          sort: "ban_chay",
        },
      },
      {
        id: id("articles"),
        type: "article_section",
        enabled: true,
        props: {
          title: "Bài viết mới",
          limit: 3,
        },
      },
    ],
  };
}
