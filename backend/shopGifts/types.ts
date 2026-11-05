export interface GiftCollectionItem {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  recipientType: 'nguoi-thuong' | 'gia-dinh' | 'khai-truong' | 'ban-lam-viec' | 'doanh-nghiep' | string;
  image: string;
  quote: string;
  includedItems: string;
  linkedProductCodes: string[];
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const GIFT_COLLECTIONS_COL = 'aloha_gift_collections';
export const GIFT_NAV_CONFIG_COL = 'aloha_gift_nav_config';

export interface GiftNavCategoryItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: string;
  color: string;
  order: number;
  enabled: boolean;
}

export interface GiftNavConfig {
  headerTitle: string;
  headerSubtitle: string;
  b2bTitle: string;
  b2bSubtitle: string;
  b2bHref: string;
  b2bEnabled: boolean;
  categories: GiftNavCategoryItem[];
  updatedAt?: string;
}

export const DEFAULT_GIFT_NAV_CONFIG: GiftNavConfig = {
  headerTitle: "Chọn quà, gửi yêu thương",
  headerSubtitle: "Bạn muốn tặng ai, nhân dịp nào?",
  b2bTitle: "Quà tặng doanh nghiệp",
  b2bSubtitle: "Tư vấn quà tặng cho đối tác, khách hàng & đội ngũ",
  b2bHref: "/qua-tang/doanh-nghiep",
  b2bEnabled: true,
  categories: [
    {
      id: "nguoi-thuong",
      label: "Người thương",
      hint: "Một món quà nhỏ, gửi nhiều yêu thương",
      href: "/qua-tang/nguoi-thuong",
      icon: "Heart",
      color: "bg-rose-50 text-rose-600",
      order: 1,
      enabled: true,
    },
    {
      id: "gia-dinh",
      label: "Gia đình & Mẹ",
      hint: "Thêm sắc xanh cho tổ ấm",
      href: "/qua-tang/gia-dinh",
      icon: "House",
      color: "bg-orange-50 text-orange-600",
      order: 2,
      enabled: true,
    },
    {
      id: "khai-truong",
      label: "Khai trương & Thăng chức",
      hint: "Gửi lời chúc khởi đầu thuận lợi",
      href: "/qua-tang/khai-truong",
      icon: "Trophy",
      color: "bg-amber-50 text-amber-600",
      order: 3,
      enabled: true,
    },
    {
      id: "ban-lam-viec",
      label: "Bàn làm việc & Đồng nghiệp",
      hint: "Một góc xanh, thêm cảm hứng mỗi ngày",
      href: "/qua-tang/ban-lam-viec",
      icon: "Sprout",
      color: "bg-emerald-50 text-emerald-600",
      order: 4,
      enabled: true,
    },
  ],
};

