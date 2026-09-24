"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShopAuth } from "@/components/ShopAuthProvider";

/**
 * CTV portal SSE — commissions/bills/account → invalidate queries (bỏ poll dày).
 */
export function CtvMeStreamSync() {
  const { user } = useShopAuth();
  const qc = useQueryClient();
  const enabled = Boolean(user?.roles?.includes?.("ctv"));
  const userId = user?.id || user?.email || "anonymous";

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const invalidate = (payload?: { collections?: string[]; source?: string }) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const cols = payload?.collections || [];
        // Nếu không có thông tin chi tiết collections, fallback invalidate chung với staleTime bảo vệ
        if (!cols.length) {
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "stats"] });
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "overview"] });
          return;
        }

        // Phân loại chỉ invalidate query bị ảnh hưởng thay vì toàn bộ ["ctv-portal"]
        if (cols.includes("aloha_shop_commissions")) {
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "stats"] });
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "overview"] });
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "conversions"] });
        }
        if (cols.includes("aloha_shop_commission_bills")) {
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "stats"] });
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "bills"] });
        }
        if (cols.includes("aloha_shop_accounts")) {
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "payout-bank"] });
        }
      }, 400);
    };

    const connect = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/shop/ctv/me/stream", {
          withCredentials: true,
        });
      } catch {
        schedule();
        return;
      }
      es.addEventListener("hello", () => {
        attempt = 0;
      });
      es.addEventListener("me", (ev: MessageEvent) => {
        attempt = 0;
        try {
          const payload = JSON.parse(ev.data || "{}");
          invalidate(payload);
        } catch {
          invalidate();
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
      if (debounce) clearTimeout(debounce);
      try {
        es?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, qc, user?.id]);

  return null;
}
