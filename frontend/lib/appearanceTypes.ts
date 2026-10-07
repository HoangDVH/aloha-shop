export type AppearanceBlock = {
  id: string;
  type: string;
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

export type PopupBannerItem = {
  id?: string;
  title?: string;
  imageUrl: string;
  ctaHref?: string;
  ctaLabel?: string;
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
  /** Mỗi lần khách mở web (phiên mới) đều tự bật lại, bỏ qua frequencyDays/showOncePerCampaign. */
  everyVisit?: boolean;
  startAt?: string;
  endAt?: string;
  pages?: PopupPages;
  audience?: PopupAudience;
  reopenBadge?: boolean;
  /** Danh sách banner cho slider/carousel xoay vòng Shopee */
  items?: PopupBannerItem[];
  autoplaySeconds?: number;
};

export type PopupPages = "home" | "home_deals" | "all";
export type PopupAudience = "all" | "new" | "returning";

export type AppearanceTheme = {
  siteName: string;
  logoUrl: string;
  primaryColor: string;
  headerBg: string;
  fontFamily?: AppearanceFontFamily;
  faviconUrl?: string;
  seo?: AppearanceSeo;
  popup?: AppearancePopup;
  footer: {
    address: string;
    phone: string;
    email: string;
    zalo: string;
  };
};
