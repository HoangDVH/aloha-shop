"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { useShopMeQuery } from "@/lib/authQueries";
import { ctvPortalFetch } from "./ctvPortalFetch";
import type {
  BillRow,
  ConversionRow,
  CtvOverview,
  CtvStats,
  PayoutBank,
} from "./types";
import type { PayoutBankInput } from "./schemas";

export function useCtvMeStats(opts?: {
  refetchInterval?: number | false | (() => number | false);
}) {
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  return useQuery({
    queryKey: ["ctv-portal", userId, "stats"],
    queryFn: () => ctvPortalFetch<CtvStats>("/api/shop/ctv/me/stats"),
    enabled: Boolean(me?.id || me?.email),
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useCtvMeOverview(
  from: string,
  to: string,
  opts?: { refetchInterval?: number | false | (() => number | false) }
) {
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  return useQuery({
    queryKey: ["ctv-portal", userId, "overview", from, to],
    queryFn: () =>
      ctvPortalFetch<CtvOverview>(
        `/api/shop/ctv/me/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
    enabled: Boolean(me?.id || me?.email) && Boolean(from && to),
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useCtvMeBills(opts?: {
  refetchInterval?: number | false | (() => number | false);
}) {
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  return useQuery({
    queryKey: ["ctv-portal", userId, "bills"],
    queryFn: () =>
      ctvPortalFetch<{ data: BillRow[] }>("/api/shop/ctv/me/bills").then(
        (r) => r.data || []
      ),
    enabled: Boolean(me?.id || me?.email),
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useCtvMeConversions(
  params: {
    from: string;
    to: string;
    orderCode?: string;
    orderStatus?: string;
    paymentStatus?: string;
  },
  opts?: {
    enabled?: boolean;
    refetchInterval?: number | false | (() => number | false);
  }
) {
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.orderCode?.trim()) qs.set("orderCode", params.orderCode.trim());
  if (params.orderStatus && params.orderStatus !== "all") {
    qs.set("orderStatus", params.orderStatus);
  }
  if (params.paymentStatus && params.paymentStatus !== "all") {
    qs.set("paymentStatus", params.paymentStatus);
  }
  return useQuery({
    queryKey: ["ctv-portal", userId, "conversions", params],
    queryFn: () =>
      ctvPortalFetch<{ data: ConversionRow[] }>(
        `/api/shop/ctv/me/conversions?${qs.toString()}`
      ).then((r) => r.data || []),
    enabled:
      Boolean(me?.id || me?.email) &&
      opts?.enabled !== false &&
      Boolean(params.from && params.to),
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useCtvMePayoutBank() {
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  return useQuery({
    queryKey: ["ctv-portal", userId, "payout-bank"],
    queryFn: () =>
      ctvPortalFetch<{ payoutBank: PayoutBank | null }>(
        "/api/shop/ctv/me/payout-bank"
      ).then((r) => r.payoutBank),
    enabled: Boolean(me?.id || me?.email),
  });
}

export function useSaveCtvPayoutBank() {
  const qc = useQueryClient();
  const { data: me } = useShopMeQuery();
  const userId = me?.id || me?.email || "anonymous";
  return useMutation({
    mutationFn: (body: PayoutBankInput) =>
      ctvPortalFetch<{ ok: boolean; payoutBank: PayoutBank }>(
        "/api/shop/ctv/me/payout-bank",
        { method: "PUT", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "payout-bank"] });
    },
  });
}

/** Catalog shop (aloha_products) — tái dùng GET /api/shop/products */
export function useCtvCatalogProducts(opts: {
  q: string;
  page: number;
  limit?: number;
}) {
  const limit = opts.limit ?? 24;
  return useQuery({
    queryKey: ["ctv-portal", "catalog-products", opts.q, opts.page, limit],
    queryFn: () =>
      fetchProducts(
        {
          q: opts.q || undefined,
          page: opts.page,
          limit,
          sort: "ten",
        },
        { cache: "no-store" }
      ),
    placeholderData: (prev) => prev,
  });
}
