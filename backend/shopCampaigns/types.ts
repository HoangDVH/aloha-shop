export const CAMPAIGNS_COL = "aloha_shop_campaigns";
export const VOUCHER_WALLET_COL = "aloha_shop_voucher_wallet";
export const FLASH_COUNTERS_COL = "aloha_shop_flash_counters";
export const CAMPAIGN_STATS_COL = "aloha_shop_campaign_stats";

export const CAMPAIGN_ERROR_CODES = [
  "retail_only",
  "sold_out",
  "claim_limit",
  "not_claimed",
  "price_changed",
  "campaign_paused",
] as const;
export type CampaignErrorCode = (typeof CAMPAIGN_ERROR_CODES)[number];

/** Khung giờ bán giá sale theo giờ Việt Nam; `overnight` khi giờ kết thúc sang ngày hôm sau. */
export type CampaignSlot = {
  key: string;
  start: string;
  end: string;
  overnight?: boolean;
  /** Chữ dưới giờ trên sân khấu Flash Sale khi khung chưa mở (vd "Hỗ trợ ship 30K"). */
  label?: string;
};

/** `qty` quà cho mỗi sản phẩm mua; `quota` = tổng suất quà, đếm riêng từng quà. */
export type CampaignGift = { ma: string; qty: number; quota: number };
export const MAX_GIFTS_PER_PRODUCT = 5;

export type CampaignProduct = {
  ma: string;
  /** 0 = không giảm giá (chỉ quà / deal). */
  salePrice: number;
  /** Giá trước KM chỉ để hiện gạch ngang khi không có giá sale; không bao giờ dùng để tính tiền. */
  compareAtPrice?: number;
  quota: number;
  perCustomerLimit: number;
  slotKey?: string;
  gifts?: CampaignGift[];
  /** Bản lưu cũ (1 quà) — chỉ đọc qua `productGifts`. */
  gift?: CampaignGift;
  dealHot?: boolean;
  paused?: boolean;
};

export function productGifts(p: Pick<CampaignProduct, "gift" | "gifts">): CampaignGift[] {
  if (p.gifts?.length) return p.gifts;
  return p.gift ? [p.gift] : [];
}

export type CampaignLink = { label: string; href: string };

export type CampaignBanner = {
  id: string;
  kind: "main" | "side";
  imageUrl: string;
  mobileImageUrl?: string;
  href: string;
  alt?: string;
};

export type CampaignTile = { icon: string; label: string; href: string };

export type CampaignDisplay = {
  colors: { primary: string; accent: string; cream: string };
  announcement: { text: string; href?: string };
  headerPill: { text: string; href?: string };
  banners: CampaignBanner[];
  hero: {
    title: string;
    subtitle: string;
    benefits: string[];
    tags: string[];
    /** Dải "Đặt trước … để giao kịp …" trên trang ưu đãi; trống thì ẩn. */
    deadline?: string;
    primaryCta?: CampaignLink;
    secondaryCta?: CampaignLink;
  };
  tiles: CampaignTile[];
  welcome: { enabled: boolean; title: string; body: string };
  /** Dải "Sân khấu Flash Sale" trên trang chủ; thiếu thì dùng chữ mặc định. */
  flashStage?: { title: string; badge: string; subtitle: string };
};

export type CampaignInfo = {
  name: string;
  slug: string;
  startAt: string;
  endAt: string;
  teaserDays: number;
  testOnly: boolean;
};

export type CampaignContent = {
  info: CampaignInfo;
  products: CampaignProduct[];
  slots: CampaignSlot[];
  voucherIds: string[];
  display: CampaignDisplay;
};

export type CampaignStatus = "draft" | "published" | "paused" | "archived";

export type CampaignDoc = {
  _id: string;
  draft: CampaignContent;
  published: CampaignContent | null;
  revision: number;
  status: CampaignStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  preset?: string;
  hasOrders?: boolean;
  /** Lý do quản lý đã xác nhận (giá dưới vốn) cho đúng `revision` được hẹn giờ. */
  scheduleConfirm?: { revision: number; reason: string } | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type CampaignPhase = "upcoming" | "teaser" | "live" | "lastHours" | "ended";

/** Nhãn ưu đãi server gắn cho sản phẩm (không lưu DB). */
export type CampaignPromo = {
  campaignId: string;
  kind: "flash" | "teaser" | "gift" | "deal";
  salePrice: number | null;
  listPrice: number;
  /** Giá gạch ngang (> listPrice) khi chiến dịch đang chạy và SP không có giá sale; khách vẫn trả listPrice. */
  compareAtPrice: number | null;
  endsAt: string;
  slotKey: string | null;
  slotOpen: boolean;
  opensAt: string | null;
  remaining: number | null;
  soldPct: number | null;
  /** Số cây đã bán thật (flash: theo suất giá sale; giá gạch: theo đơn giá web). */
  soldQty: number | null;
  giftLabel: string | null;
  /** `image` / `value` (giá web của quà) / `left` (suất quà còn lại) chỉ có khi đọc được dữ liệu thật. */
  gifts: { ma: string; name: string; qty: number; image?: string; value?: number; left?: number }[];
  perCustomerLimit: number;
};

export type AdminResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; error: string; fields?: FieldError[] };

export type FieldError = { path: string; message: string };

export function isAdminFail<T>(r: AdminResult<T>): r is Extract<AdminResult<T>, { ok: false }> {
  return r.ok === false;
}
