/** Shape appearance storefront — draft/published. */

export type AppearanceBlockType =
  | "hero"
  | "banner_carousel"
  | "feature_strip"
  | "product_section"
  | "article_section"
  | "rich_text"
  | "spacer"
  | "category_highlight";

export type AppearanceBlock = {
  id: string;
  type: AppearanceBlockType;
  enabled: boolean;
  props: Record<string, unknown>;
};

export type NavCustomItem = {
  id: string;
  label: string;
  href: string;
  position: "before" | "after" | number;
  enabled: boolean;
  openInNewTab?: boolean;
};

export type NavConfig = {
  hiddenCategoryPaths: string[];
  customItems: NavCustomItem[];
};

export type AppearanceFontFamily = "system" | "be_vietnam" | "nunito" | "roboto";

export type AppearanceSeo = {
  title: string;
  description: string;
  ogImageUrl?: string;
  productTitleTemplate?: string;
  productDescriptionTemplate?: string;
  categoryTitleTemplate?: string;
  categoryDescriptionTemplate?: string;
  enableProductJsonLd?: boolean;
  enableOrgJsonLd?: boolean;
  googleSiteVerification?: string;
};

export type AppearancePopup = {
  enabled: boolean;
  campaignId: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  couponCode: string;
  delaySeconds: number;
  frequencyDays: number;
  showOncePerCampaign: boolean;
};

export type AppearanceTheme = {
  siteName: string;
  logoUrl: string;
  primaryColor: string;
  headerBg: string;
  fontFamily: AppearanceFontFamily;
  faviconUrl: string;
  seo: AppearanceSeo;
  popup: AppearancePopup;
  footer: {
    address: string;
    phone: string;
    email: string;
    zalo: string;
  };
};

export type AppearanceLayout = {
  version: number;
  updatedAt: string;
  blocks: AppearanceBlock[];
  nav: NavConfig;
  theme: AppearanceTheme;
};

export type AppearanceHistoryEntry = {
  id: string;
  at: string;
  by: string;
  note: string;
  snapshot: AppearanceLayout;
};

export type AppearanceDoc = {
  _id: "storefront";
  draft: AppearanceLayout;
  published: AppearanceLayout;
  publishedAt?: string | null;
  publishedPrevious?: AppearanceLayout | null;
  updatedBy?: string | null;
  history?: AppearanceHistoryEntry[];
  scheduledPublishAt?: string | null;
};

export const APPEARANCE_COL = "aloha_shop_appearance";
export const APPEARANCE_ID = "storefront" as const;
export const APPEARANCE_HISTORY_MAX = 20;

export const FONT_PRESETS: { id: AppearanceFontFamily; label: string; css: string }[] = [
  {
    id: "system",
    label: "Hệ thống",
    css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "be_vietnam",
    label: "Be Vietnam Pro",
    css: '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "nunito",
    label: "Nunito",
    css: 'Nunito, ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "roboto",
    label: "Roboto",
    css: 'Roboto, ui-sans-serif, system-ui, sans-serif',
  },
];

export function defaultPopup(): AppearancePopup {
  return {
    enabled: false,
    campaignId: "promo",
    title: "Giảm giá đặc biệt",
    body: "Nhập mã bên dưới khi thanh toán — áp dụng cho đơn trên web.",
    imageUrl: "",
    ctaLabel: "Dùng mã ngay",
    ctaHref: "/tim",
    couponCode: "ALOHA10",
    delaySeconds: 3,
    frequencyDays: 7,
    showOncePerCampaign: true,
  };
}

export function defaultSeo(): AppearanceSeo {
  return {
    title: "ALOHA THẾ GIỚI CHẬU CÂY",
    description:
      "Mua chậu cây & cây cảnh tại ALOHA THẾ GIỚI CHẬU CÂY — TP.HCM. Xanh mát, dễ chọn, giao nhanh.",
    ogImageUrl: "",
    productTitleTemplate: "[Tên sản phẩm] | [Giá] · [Tên cửa hàng]",
    productDescriptionTemplate:
      "[Tên sản phẩm] — Giá [Giá]. Mua tại [Tên cửa hàng].",
    categoryTitleTemplate: "[Tên danh mục] · [Tên cửa hàng]",
    categoryDescriptionTemplate:
      "Khám phá [Tên danh mục] đa dạng, chất lượng tại [Tên cửa hàng].",
    enableProductJsonLd: true,
    enableOrgJsonLd: true,
    googleSiteVerification: "",
  };
}
