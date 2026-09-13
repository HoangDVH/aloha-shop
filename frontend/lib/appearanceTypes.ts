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
