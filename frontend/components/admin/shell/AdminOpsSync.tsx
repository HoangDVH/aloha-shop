"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/components/admin/api/adminFetch";

export type AdminOpsCounts = {
  ordersNeedAction: number;
  ctvPending: number;
  fraudOpen: number;
  at?: number;
};

export function useAdminOpsCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "ops", "counts"],
    queryFn: () =>
      adminFetch<AdminOpsCounts & { ok?: boolean }>("/api/shop/admin/ops/counts"),
    enabled,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? 60_000
        : false,
    staleTime: 10_000,
  });
}

/**
 * Seller Center: SSE ops → invalidate + toast đơn mới (debounce).
 */
export function AdminOpsSync({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const lastToastAt = useRef(0);
  const pendingIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const flushToast = () => {
      toastTimer.current = null;
      const n = pendingIds.current.size;
      if (!n) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        pendingIds.current.clear();
        return;
      }
      const now = Date.now();
      if (now - lastToastAt.current < 2000) {
        pendingIds.current.clear();
        return;
      }
      lastToastAt.current = now;
      const sample = [...pendingIds.current].slice(0, 3).join(", ");
      pendingIds.current.clear();
      toast.info(
        n === 1
          ? `Đơn mới / cập nhật: ${sample || "—"}`
          : `+${n} đơn cập nhật${sample ? ` (${sample}…)` : ""}`
      );
    };

    const invalidate = (payload: {
      collections?: string[];
      ids?: string[];
      source?: string;
    }) => {
      void qc.invalidateQueries({ queryKey: ["admin", "ops", "counts"] });
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
      const cols = payload.collections || [];
      if (cols.some((c) => c.includes("order"))) {
        const ids = payload.ids || [];
        for (const id of ids) pendingIds.current.add(id);
        if (!ids.length && payload.source?.includes("create")) {
          pendingIds.current.add("new");
        }
        if (!toastTimer.current) {
          toastTimer.current = setTimeout(flushToast, 400);
        }
      }
    };

    const connect = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/shop/admin/ops/stream", {
          withCredentials: true,
        });
      } catch {
        schedule();
        return;
      }
      es.addEventListener("hello", () => {
        attempt = 0;
      });
      es.addEventListener("ops", (ev) => {
        attempt = 0;
        try {
          const data = JSON.parse(String((ev as MessageEvent).data || "{}"));
          invalidate(data);
        } catch {
          invalidate({});
        }
      });
      es.onerror = () => {
        try {
          es?.close();
        } catch {
          /* */
        }
        es = null;
        schedule();
      };
    };

    const schedule = () => {
      if (stopped || reconnectTimer) return;
      const delay =
        Math.min(30_000, 2000 * Math.pow(2, attempt)) +
        Math.floor(Math.random() * 500);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      try {
        es?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, qc]);

  return null;
}

/** Badge số — dùng trong sidebar */
export function useAdminBadgeCounts(enabled: boolean) {
  const q = useAdminOpsCounts(enabled);
  return {
    ordersNeedAction: Number(q.data?.ordersNeedAction) || 0,
    ctvPending: Number(q.data?.ctvPending) || 0,
    fraudOpen: Number(q.data?.fraudOpen) || 0,
    isLoading: q.isLoading,
  };
}
