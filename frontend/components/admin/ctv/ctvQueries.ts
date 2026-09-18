"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/components/admin/api/adminFetch";

export function useCtvStats() {
  return useQuery({
    queryKey: ["admin", "ctv", "stats"],
    queryFn: () =>
      adminFetch<{ ok: boolean } & Record<string, unknown>>(
        "/api/shop/admin/ctv/stats"
      ),
  });
}

export function useCtvOverview(opts?: {
  period?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (opts?.from && opts?.to) {
    sp.set("from", opts.from);
    sp.set("to", opts.to);
  } else if (opts?.period) {
    sp.set("period", opts.period);
  }
  const qs = sp.toString();
  return useQuery({
    queryKey: ["admin", "ctv", "overview", opts?.from, opts?.to, opts?.period || "default"],
    queryFn: () =>
      adminFetch<{ ok: boolean } & Record<string, unknown>>(
        `/api/shop/admin/ctv/overview${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCtvCommissions(params: {
  status?: string;
  ctvCode?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.ctvCode) sp.set("ctvCode", params.ctvCode);
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return useQuery({
    queryKey: ["admin", "ctv", "commissions", params],
    queryFn: () =>
      adminFetch<{ ok: boolean; data: any[]; total?: number }>(
        `/api/shop/admin/ctv/commissions${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCtvBills(period?: string) {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return useQuery({
    queryKey: ["admin", "ctv", "bills", period || "list"],
    queryFn: () =>
      adminFetch<{ ok: boolean; bill?: any; data?: any[] }>(
        `/api/shop/admin/ctv/bills${q}`
      ),
  });
}

export function useCtvFraud(params?: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit || 50));
  const qs = sp.toString();
  return useQuery({
    queryKey: ["admin", "ctv", "fraud", params],
    queryFn: () =>
      adminFetch<{ ok: boolean; data: any[] }>(
        `/api/shop/admin/ctv/fraud${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCtvSettings() {
  return useQuery({
    queryKey: ["admin", "ctv", "settings"],
    queryFn: () =>
      adminFetch<{ ok: boolean; settings: any }>("/api/shop/admin/ctv/settings"),
  });
}

export function useLockBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) =>
      adminFetch("/api/shop/admin/ctv/bills/lock", {
        method: "POST",
        body: JSON.stringify({ period }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useMarkBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: string | { period: string; ctvCode?: string }) => {
      const period = typeof payload === "string" ? payload : payload.period;
      const ctvCode =
        typeof payload === "string" ? undefined : payload.ctvCode;
      return adminFetch(
        `/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/mark-paid`,
        {
          method: "POST",
          body: ctvCode ? JSON.stringify({ ctvCode }) : undefined,
        }
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useBanCtv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ctvCode: string; reason?: string }) =>
      adminFetch(`/api/shop/admin/ctv/${encodeURIComponent(payload.ctvCode)}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: payload.reason || "" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useClearCommissionFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id?: string;
      orderCode?: string;
      ctvCode?: string;
      ma?: string;
      note?: string;
    }) =>
      adminFetch<{ ok: boolean; modified: number }>(
        "/api/shop/admin/ctv/commissions/clear-flag",
        { method: "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useConfirmCommissionFraud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id?: string;
      orderCode?: string;
      ctvCode?: string;
      ma?: string;
      reason?: string;
    }) =>
      adminFetch<{ ok: boolean; modified: number }>(
        "/api/shop/admin/ctv/commissions/confirm-fraud",
        { method: "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useClearSoftFraudFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean; modified: number }>(
        "/api/shop/admin/ctv/commissions/clear-soft-flags",
        { method: "POST", body: "{}" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useReviewFraudEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      reviewStatus: "dismissed" | "confirmed" | "open";
      note?: string;
    }) =>
      adminFetch("/api/shop/admin/ctv/fraud/review", {
        method: "POST",
        body: JSON.stringify({
          id: payload.id,
          reviewStatus: payload.reviewStatus,
          note: payload.note || "",
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv", "fraud"] });
    },
  });
}

export function usePatchCtvSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      adminFetch<{ ok: boolean; settings: any }>("/api/shop/admin/ctv/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
    },
  });
}

export function useCtvAffiliateDetail(
  ctvCode: string,
  opts?: { period?: string; from?: string; to?: string } | string
) {
  const code = String(ctvCode || "").trim().toUpperCase();
  const normalized =
    typeof opts === "string" ? { period: opts } : opts || {};
  const sp = new URLSearchParams();
  if (normalized.from && normalized.to) {
    sp.set("from", normalized.from);
    sp.set("to", normalized.to);
  } else if (normalized.period) {
    sp.set("period", normalized.period);
  }
  const q = sp.toString() ? `?${sp.toString()}` : "";
  return useQuery({
    queryKey: [
      "admin",
      "ctv",
      "affiliate",
      code,
      normalized.from,
      normalized.to,
      normalized.period || "default",
    ],
    enabled: code.length >= 3,
    queryFn: () =>
      adminFetch<{
        ok: boolean;
        period: string;
        account: any;
        referralUrl: string;
        metrics: {
          clicks: number;
          orders: number;
          revenue: number;
          commission: number;
        };
        products: Array<{
          ma: string;
          name: string;
          imageUrl?: string;
          price: number;
          orderCount: number;
          qty: number;
        }>;
        recentHistory: Array<{
          type: string;
          id: string;
          label: string;
          amount: number;
          badge: string;
          at: string | null;
        }>;
        orders: Array<{
          code: string;
          displayCode?: string;
          total: number;
          orderStatus: string;
          createdAt: string | null;
        }>;
        commissions: Array<{
          id: string;
          orderCode: string;
          displayOrderCode?: string;
          ma: string;
          productName: string;
          imageUrl?: string;
          amount: number;
          status: string;
          createdAt: string | null;
        }>;
        payouts: Array<{
          period: string;
          status: string;
          amount: number;
          orderCount: number;
          lockedAt: string | null;
          paidAt: string | null;
        }>;
      }>(`/api/shop/admin/ctv/affiliates/${encodeURIComponent(code)}${q}`),
  });
}

export function useExportBillExcel() {
  return useMutation({
    mutationFn: async (period: string) => {
      const res = await fetch(
        `/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/export.xlsx`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ChiHH-${period}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    },
  });
}
