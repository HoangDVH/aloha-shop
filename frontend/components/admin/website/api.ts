/** Shared fetch for Website bán hàng admin. */
export async function websiteApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as any)?.message || (data as any)?.error || `HTTP ${res.status}`
    );
  }
  return data as T;
}

export type AppearanceBlock = {
  id: string;
  type: string;
  enabled: boolean;
  props: Record<string, unknown>;
};

export type NavConfig = {
  hiddenCategoryPaths: string[];
  customItems: {
    id: string;
    label: string;
    href: string;
    position: "before" | "after" | number;
    enabled: boolean;
    openInNewTab?: boolean;
  }[];
};

export type AppearanceFontFamily = "system" | "be_vietnam" | "nunito" | "roboto";

export type AppearanceTheme = {
  siteName: string;
  logoUrl: string;
  primaryColor: string;
  headerBg: string;
  fontFamily?: AppearanceFontFamily;
  faviconUrl?: string;
  seo?: { title: string; description: string };
  popup?: {
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

export type AppearanceHistoryMeta = {
  id: string;
  at: string;
  by: string;
  note: string;
};

export const FONT_OPTIONS: { id: AppearanceFontFamily; label: string }[] = [
  { id: "system", label: "Hệ thống" },
  { id: "be_vietnam", label: "Be Vietnam Pro" },
  { id: "nunito", label: "Nunito" },
  { id: "roboto", label: "Roboto" },
];
