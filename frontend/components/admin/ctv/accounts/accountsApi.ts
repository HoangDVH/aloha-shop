export type ShopRole = "customer" | "ctv";
export type CtvStatus = "cho_duyet" | "active" | "khoa" | "tu_choi";

export type ShopAccount = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  roles: ShopRole[];
  ctvCode: string | null;
  ctvStatus: CtvStatus | null;
  active: boolean;
  authProviders: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  adminNote?: string | null;
  commissionRate?: number | null;
  zalo?: string | null;
  addressText?: string | null;
  referralChannel?: string | null;
  channelUrl?: string | null;
  referralSource?: string | null;
  hasBusinessExp?: boolean | null;
  businessExpNote?: string | null;
  businessExpYears?: number | null;
  ctvRejectReason?: string | null;
};

export type Stats = {
  total: number;
  customers: number;
  ctvTotal?: number;
  ctvActive: number;
  ctvPending: number;
  locked: number;
  ctvLocked?: number;
  customerLocked?: number;
};

export type TabId = "all" | "customer" | "ctv" | "active" | "pending" | "locked";
export type AccountsScope = "all" | "ctv" | "customers";

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
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}
