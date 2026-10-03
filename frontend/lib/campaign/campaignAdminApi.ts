import type { CampaignDisplayUI, CampaignSlotUI } from "./campaignApi";

export type { CampaignSlotUI };

export type CampaignGiftAdmin = { ma: string; qty: number; quota: number };
export const MAX_GIFTS_PER_PRODUCT = 5;
export type CampaignProductAdmin = {
  ma: string;
  salePrice: number;
  /** Giá trước KM chỉ để gạch ngang; loại trừ với salePrice. */
  compareAtPrice?: number;
  quota: number;
  perCustomerLimit: number;
  slotKey?: string;
  gifts?: CampaignGiftAdmin[];
  /** Bản nháp cũ (1 quà) — đọc qua `rowGifts`, sửa qua `withGifts`. */
  gift?: CampaignGiftAdmin;
  dealHot?: boolean;
  paused?: boolean;
};

export function rowGifts(row: Pick<CampaignProductAdmin, "gift" | "gifts">): CampaignGiftAdmin[] {
  if (row.gifts?.length) return row.gifts;
  return row.gift ? [row.gift] : [];
}

/** Luôn bỏ `gift` cũ để server không dựng lại quà vừa xoá. */
export function withGifts(row: CampaignProductAdmin, gifts: CampaignGiftAdmin[]): CampaignProductAdmin {
  return { ...row, gift: undefined, gifts: gifts.length ? gifts : undefined };
}

export type CampaignContentAdmin = {
  info: { name: string; slug: string; startAt: string; endAt: string; teaserDays: number; testOnly: boolean };
  products: CampaignProductAdmin[];
  slots: CampaignSlotUI[];
  voucherIds: string[];
  display: CampaignDisplayUI;
};

export type CampaignStatusView = { tone: "green" | "amber" | "gray" | "red"; text: string; running: boolean };

export type CampaignSummary = {
  id: string;
  name: string;
  slug: string;
  startAt: string;
  endAt: string;
  status: "draft" | "published" | "paused" | "archived";
  statusView: CampaignStatusView;
  revision: number;
  scheduledAt: string | null;
  productCount: number;
  voucherCount: number;
  giftCount: number;
  hasUnpublishedChanges: boolean;
  updatedAt: string;
};

export type CampaignDocAdmin = {
  _id: string;
  draft: CampaignContentAdmin;
  published: CampaignContentAdmin | null;
  revision: number;
  status: CampaignSummary["status"];
  scheduledAt: string | null;
  hasOrders?: boolean;
};

export type FieldError = { path: string; message: string };
export type CheckIssue = { level: "error" | "confirm" | "warn"; path: string; message: string };
/** `nhomPath` thiếu ở API cũ — luôn đọc `?? ""`. */
export type ProductFacts = { ma: string; ten: string; listPrice: number; cost: number; stock: number; nhomPath?: string };

export type RunningData = {
  summary: { revenue: number; orders: number; flashSold: number; flashHeld: number; vouchersUsed: number };
  stats: { totals: Record<string, number>; reminds: Record<string, number>; banners: Record<string, number> };
  needsReview: { code: string; createdAt: string; total: number; buyer: string; paymentStatus: string }[];
  reconcile: { at: string; diffs: { id: string; held: number; expected: number }[]; fixed: number; source: string } | null;
};

export class CampaignAdminError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly fields?: FieldError[]) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new CampaignAdminError(data?.error || `Lỗi ${res.status}`, res.status, data?.code, data?.fields);
  }
  return data as T;
}

const BASE = "/api/shop/admin/campaigns";
const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(body) });
type ItemRes = { item: CampaignDocAdmin; summary: CampaignSummary };

export const campaignAdminApi = {
  list: () =>
    call<{ items: CampaignSummary[]; presets: { key: string; label: string }[]; canManage: boolean; serverNow: number }>(`${BASE}?all=0`),
  get: (id: string) => call<ItemRes>(`${BASE}/${id}`),
  create: (preset: string) => post<ItemRes>(BASE, { preset }),
  saveDraft: (id: string, content: CampaignContentAdmin, revision: number) =>
    call<ItemRes>(`${BASE}/${id}/draft`, { method: "PUT", body: JSON.stringify({ content, revision }) }),
  check: (id: string) => call<{ issues: CheckIssue[]; facts: Record<string, ProductFacts> }>(`${BASE}/${id}/check`),
  publish: (id: string, revision: number, reason?: string) => post<ItemRes>(`${BASE}/${id}/publish`, { revision, reason }),
  schedule: (id: string, revision: number, at: string | null, reason?: string) =>
    post<ItemRes>(`${BASE}/${id}/schedule`, { revision, at, reason }),
  discard: (id: string, revision: number) => post<ItemRes>(`${BASE}/${id}/discard`, { revision }),
  pause: (id: string, paused: boolean) => post<ItemRes>(`${BASE}/${id}/pause`, { paused }),
  duplicate: (id: string) => post<ItemRes>(`${BASE}/${id}/duplicate`),
  archive: (id: string) => post<ItemRes>(`${BASE}/${id}/archive`),
  remove: (id: string) => call<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" }),
  running: (id: string) => call<RunningData>(`${BASE}/${id}/running`),
  downloadReport: async (id: string) => {
    const res = await fetch(`${BASE}/${id}/report.xlsx`, { credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new CampaignAdminError(data?.error || `Lỗi ${res.status}`, res.status, data?.code);
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || "bao-cao-chien-dich.xlsx";
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  previewToken: (id: string) => post<{ token: string; expiresInSec: number }>(`${BASE}/${id}/preview-token`),
  facts: (mas: string[]) =>
    call<{ facts: Record<string, ProductFacts> }>(`/api/shop/admin/campaign-ops/facts?mas=${encodeURIComponent(mas.join(","))}`),
  fixCounters: () => post<{ fixed: number }>("/api/shop/admin/campaign-ops/reconcile"),
  resolveReview: (code: string, note: string) =>
    post<{ ok: true }>(`/api/shop/admin/campaign-ops/review/${encodeURIComponent(code)}/resolve`, { note }),
};
