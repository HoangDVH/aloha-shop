"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { createSharedSseLeader } from "@/lib/sharedSseLeader";

/**
 * CTV portal SSE — commissions/bills/account → invalidate queries (bỏ poll dày).
 * Dùng chung 1 kết nối Leader-Follower qua Web Locks + BroadcastChannel giữa nhiều tab.
 */
export function CtvMeStreamSync() {
  const { user } = useShopAuth();
  const qc = useQueryClient();
  const enabled = Boolean(user?.roles?.includes?.("ctv"));
  const userId = user?.id || user?.email || "anonymous";

  useEffect(() => {
    if (!enabled) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const invalidate = (payload?: { collections?: string[]; source?: string }) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const cols = payload?.collections || [];
        if (!cols.length) {
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "stats"] });
          void qc.invalidateQueries({ queryKey: ["ctv-portal", userId, "overview"] });
          return;
        }
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

    const stop = createSharedSseLeader({
      lockName: `aloha_sse_ctv_me_${userId}`,
      channelName: `aloha_sse_ctv_me_${userId}`,
      url: "/api/shop/ctv/me/stream",
      withCredentials: true,
      events: ["hello", "me"],
      onEvent: (type, rawData) => {
        if (type !== "me") return;
        try {
          invalidate(JSON.parse(rawData || "{}"));
        } catch {
          invalidate();
        }
      },
    });

    return () => {
      stop();
      if (debounce) clearTimeout(debounce);
    };
  }, [enabled, qc, user?.id, userId]);

  return null;
}
