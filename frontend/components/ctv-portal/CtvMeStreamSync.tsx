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

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["ctv-portal"] });
      }, 300);
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
      es.addEventListener("me", () => {
        attempt = 0;
        invalidate();
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
