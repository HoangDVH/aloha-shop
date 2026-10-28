import { WEB_BADGE_LABELS, WEB_BADGE_VALUES, type WebBadge } from "@/lib/webBadge";

export type Row = {
  ma: string;
  ten: string;
  anh: string;
  nhom: string;
  nhomPath: string;
  gia: number;
  ton: number;
  hienThiWeb: boolean;
  webPin?: number;
  webBadge?: string;
};

export function fmtVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")} ₫`;
}

export const VISIBLE_OPTIONS = [
  { value: "1", label: "Đang hiển thị" },
  { value: "0", label: "Đang ẩn" },
];

export const BADGE_OPTIONS = [
  { value: "", label: "Chưa gắn" },
  ...WEB_BADGE_VALUES.map((v) => ({ value: v, label: WEB_BADGE_LABELS[v] })),
];

export const BADGE_FILTER_OPTIONS = [
  { value: "auto", label: "Chưa gắn nhãn" },
  ...WEB_BADGE_VALUES.map((v) => ({ value: v, label: WEB_BADGE_LABELS[v] })),
];

export type BadgeFilter = "all" | "auto" | WebBadge;

export type AudienceType = "common" | "si_noi_bat" | "si_uu_dai";

export const AUDIENCE_TABS = [
  { id: "common" as const, label: "Danh sách chung (Khách lẻ)" },
  { id: "si_noi_bat" as const, label: "Khách sỉ – Nổi bật" },
  { id: "si_uu_dai" as const, label: "Khách sỉ – Ưu đãi" },
];
