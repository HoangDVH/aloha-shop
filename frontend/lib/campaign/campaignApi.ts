import { exitPreview, previewNow, readPreview } from "./previewMode";
import type { MysteryInfo } from "../voucherFormat";

export type CampaignPhase = "upcoming" | "teaser" | "live" | "lastHours" | "ended";

export type CampaignSlotUI = { key: string; start: string; end: string; overnight?: boolean; label?: string };

export type CampaignBannerUI = {
  id: string;
  kind: "main" | "side";
  imageUrl: string;
  mobileImageUrl?: string;
  href: string;
  alt?: string;
};

export type CampaignDisplayUI = {
  colors: { primary: string; accent: string; cream: string };
  announcement: { text: string; href?: string };
  headerPill: { text: string; href?: string };
  banners: CampaignBannerUI[];
  hero: {
    title: string;
    subtitle: string;
    benefits: string[];
    tags: string[];
    deadline?: string;
    primaryCta?: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
  };
  tiles: { icon: string; label: string; href: string }[];
  welcome: { enabled: boolean; title: string; body: string };
  flashStage?: FlashStageText;
};

export type FlashStageText = { title: string; badge: string; subtitle: string };

export type CampaignUI = {
  id: string;
  name: string;
  slug: string;
  startAt: string;
  endAt: string;
  teaserDays: number;
  phase: CampaignPhase;
  phaseEndsAt: string | null;
  slots: CampaignSlotUI[];
  display: CampaignDisplayUI;
  products: { ma: string; slotKey: string | null; dealHot: boolean; hasGift: boolean }[];
  voucherIds: string[];
};

export type CampaignVoucherUI = {
  id: string;
  title: string;
  description: string;
  type: "auto" | "code";
  benefitType: "goods" | "shipping";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ">" | ">=";
  targetCustomer?: string;
  startDate?: string;
  endDate?: string;
  claimRequired: boolean;
  claimLimitTotal: number | null;
  claimedCount: number;
  claimStartDate: string | null;
  mystery?: MysteryInfo;
};

export type CampaignViewerUI = {
  loggedIn: boolean;
  /** Chưa từng mua thành công trên web (khách chưa đăng nhập = true). */
  newBuyer: boolean;
  retail: boolean;
  locked: boolean;
  canUse: boolean;
  lockReason: "retail_only" | "account_locked" | null;
  lockMessage: string | null;
};

export type CurrentCampaignResponse = {
  ok: boolean;
  serverNow: number;
  state: CampaignPhase | "paused" | "none";
  campaign: CampaignUI | null;
  vouchers: CampaignVoucherUI[];
  upcoming: CampaignUI | null;
  viewer?: CampaignViewerUI;
  /** Đang xem trước bản nháp (link admin); giá mua thật không đổi. */
  preview?: boolean;
  previewError?: string;
};

/** Giá, suất, lý do khoá đều do server tính; client chỉ hiển thị. */
export type CampaignPromoUI = {
  campaignId: string;
  kind: "flash" | "teaser" | "gift" | "deal";
  salePrice: number | null;
  listPrice: number;
  /** Giá trước KM để gạch ngang (> listPrice); khách vẫn trả listPrice. */
  compareAtPrice?: number | null;
  endsAt: string;
  slotKey: string | null;
  slotOpen: boolean;
  opensAt: string | null;
  remaining: number | null;
  soldPct: number | null;
  /** Số cây đã bán thật; thiếu ở bản API cũ. */
  soldQty?: number | null;
  giftLabel: string | null;
  /** Thiếu ở bản API cũ (cache CDN) — luôn đọc `gifts ?? []`. */
  gifts?: { ma: string; name: string; qty: number; image?: string; value?: number; left?: number }[];
  perCustomerLimit: number;
};

export type BestSellerUI = { ma: string; sold: number };

/** Top SP chiến dịch theo số bán thật (server đã bỏ SP bán quá ít). */
export async function fetchBestSellers(): Promise<BestSellerUI[]> {
  if (readPreview()) return [];
  try {
    const res = await fetch("/api/shop/campaigns/best-sellers", { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: BestSellerUI[] };
    return Array.isArray(data.items) ? data.items.filter((x) => x && x.ma && x.sold > 0) : [];
  } catch {
    return [];
  }
}

const EMPTY: CurrentCampaignResponse = {
  ok: true,
  serverNow: Date.now(),
  state: "none",
  campaign: null,
  vouchers: [],
  upcoming: null,
};

export async function fetchCurrentCampaign(): Promise<CurrentCampaignResponse & { offsetMs: number }> {
  const sentAt = Date.now();
  const preview = readPreview();
  const url = preview
    ? `/api/shop/campaigns/preview?token=${encodeURIComponent(preview.token)}&at=${encodeURIComponent(new Date(previewNow(preview)).toISOString())}`
    : "/api/shop/campaigns/current";
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (preview && res.status === 401) {
      exitPreview();
      const body = await res.json().catch(() => ({}));
      return { ...EMPTY, offsetMs: 0, previewError: body?.error || "Link xem trước đã hết hạn." };
    }
    if (!res.ok) return { ...EMPTY, offsetMs: 0 };
    const data = (await res.json()) as CurrentCampaignResponse;
    const receivedAt = Date.now();
    const offsetMs = Number(data.serverNow) ? data.serverNow - Math.round((sentAt + receivedAt) / 2) : 0;
    return { ...EMPTY, ...data, offsetMs };
  } catch {
    return { ...EMPTY, offsetMs: 0 };
  }
}

/** Lượt bấm banner chiến dịch (không chặn điều hướng). */
export function trackCampaignBanner(bannerId: string, event: "bannerClick" | "bannerView" = "bannerClick"): void {
  if (readPreview()) return;
  try {
    const body = JSON.stringify({ bannerId, event });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/shop/campaigns/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/shop/campaigns/track", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    /* thống kê không được làm hỏng điều hướng */
  }
}

export const isSellingPhase = (p?: CampaignPhase | null) => p === "live" || p === "lastHours";
export const isRunningPhase = (p?: CampaignPhase | null) => p === "teaser" || isSellingPhase(p);
