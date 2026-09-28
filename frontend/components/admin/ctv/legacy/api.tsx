import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Percent,
  Sparkles,
  Users,
} from "lucide-react";

export type HubTab =
  | "hom-nay"
  | "dat-phan-tram"
  | "ctv-dac-biet"
  | "duyet-ctv"
  | "ky-thang"
  | "canh-bao";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!res.ok)
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `HTTP ${res.status}`
    );
  return data as T;
}

export function formatVnd(n?: number | null) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

export function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type ProductRateRow = {
  ma: string;
  ten?: string;
  gia?: number;
  anh?: string;
  ctvCommissionRate?: number | null;
  effectiveRate: number;
  rateSource: "product" | "shop" | "excluded";
};

export const TABS: { id: HubTab; label: string; icon: React.ReactNode }[] = [
  { id: "hom-nay", label: "Việc hôm nay", icon: <Sparkles size={14} /> },
  { id: "dat-phan-tram", label: "Đặt % hoa hồng", icon: <Percent size={14} /> },
  { id: "ctv-dac-biet", label: "CTV đặc biệt", icon: <Users size={14} /> },
  { id: "duyet-ctv", label: "Duyệt CTV", icon: <Users size={14} /> },
  { id: "ky-thang", label: "Kỳ tháng", icon: <CalendarDays size={14} /> },
  { id: "canh-bao", label: "Cảnh báo", icon: <AlertTriangle size={14} /> },
];

export type LegacyProps = {
  /** Ép tab khi nhúng từ CtvAdminShell */
  forcedTab?: HubTab;
  /** Ẩn header/tabs ngoài — chỉ nội dung tab */
  hideChrome?: boolean;
};
