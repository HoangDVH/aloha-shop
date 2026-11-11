"use client";

import { createSharedSseLeader, isPageVisible } from "@/lib/sharedSseLeader";

/**
 * SSE phiên CTV/auth — khi admin duyệt tài khoản, shop nhận ngay (không F5).
 * Poll chỉ khi SSE down + tab visible (không boot poll sau hello).
 */
export const SHOP_ACCOUNT_CHANGED = "aloha-shop-account-changed";

export type ShopAccountChangeDetail = {
  userId?: string;
  ctvStatus?: string | null;
  source?: string;
  at: number;
};

export function onShopAccountChanged(
  onChange: (detail: ShopAccountChangeDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => {
    const d = (ev as CustomEvent<ShopAccountChangeDetail>).detail;
    onChange({
      userId: d?.userId,
      ctvStatus: d?.ctvStatus,
      source: d?.source,
      at: d?.at || Date.now(),
    });
  };
  window.addEventListener(SHOP_ACCOUNT_CHANGED, handler);
  return () => window.removeEventListener(SHOP_ACCOUNT_CHANGED, handler);
}

function emitAccount(detail: ShopAccountChangeDetail) {
  window.dispatchEvent(new CustomEvent(SHOP_ACCOUNT_CHANGED, { detail }));
}

/** Mở SSE /api/shop/auth/stream dùng chung Leader-Follower giữa nhiều tab (cần cookie đăng nhập). */
export function startShopAuthStream(userId?: string): () => void {
  if (typeof window === "undefined") return () => {};

  let stopped = false;
  let sseOk = false;
  let isLeader = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let emitFallback: ((type: string, data: string) => void) | null = null;

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    if (pollTimer || stopped || !isLeader || sseOk || !isPageVisible()) return;
    pollTimer = setInterval(() => {
      if (stopped || !isLeader || sseOk || !isPageVisible()) return;
      const payload = JSON.stringify({ userId, at: Date.now(), source: "auth-poll" });
      if (emitFallback) {
        emitFallback("account", payload);
      } else {
        emitAccount({ userId, at: Date.now(), source: "auth-poll" });
      }
    }, 30_000);
  };

  const key = userId ? `aloha_sse_auth_${userId}` : "aloha_sse_auth";
  const stopLeader = createSharedSseLeader({
    lockName: key,
    channelName: key,
    url: "/api/shop/auth/stream",
    withCredentials: true,
    events: ["hello", "account"],
    onEvent: (type, rawData) => {
      if (type !== "account") return;
      try {
        const data = JSON.parse(rawData || "{}") as {
          userId?: string;
          ctvStatus?: string | null;
          source?: string;
          at?: number;
        };
        emitAccount({
          userId: data.userId,
          ctvStatus: data.ctvStatus ?? null,
          source: data.source,
          at: Number(data.at) || Date.now(),
        });
      } catch {
        emitAccount({ at: Date.now(), source: "account-parse" });
      }
    },
    onConnectionChange: (state, helpers) => {
      sseOk = state.connected;
      isLeader = state.isLeader;
      emitFallback = helpers.emitLocalAndBroadcast;
      if (state.connected || !state.isLeader) {
        clearPoll();
      } else {
        startPoll();
      }
    },
  });

  const onVis = () => {
    if (stopped) return;
    if (!isPageVisible()) {
      clearPoll();
    } else if (!sseOk && isLeader) {
      startPoll();
    }
  };

  const boot = setTimeout(() => {
    if (!sseOk && isLeader) startPoll();
  }, 5000);
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stopped = true;
    clearTimeout(boot);
    clearPoll();
    document.removeEventListener("visibilitychange", onVis);
    stopLeader();
  };
}
