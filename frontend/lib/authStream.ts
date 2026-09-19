"use client";

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

function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function nextBackoffMs(attempt: number) {
  const base = Math.min(30_000, 2000 * Math.pow(2, Math.max(0, attempt)));
  return base + Math.floor(Math.random() * 500);
}

/** Mở SSE /api/shop/auth/stream (cần cookie đăng nhập). */
export function startShopAuthStream(): () => void {
  if (typeof window === "undefined") return () => {};

  let es: EventSource | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let sseOk = false;
  let reconnectAttempt = 0;

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    if (pollTimer || stopped) return;
    if (!isPageVisible()) return;
    pollTimer = setInterval(() => {
      if (!isPageVisible() || sseOk) return;
      emitAccount({ at: Date.now(), source: "auth-poll" });
    }, 30_000);
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const delay = nextBackoffMs(reconnectAttempt);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped) return;
    if (typeof EventSource === "undefined") {
      startPoll();
      return;
    }
    try {
      es = new EventSource("/api/shop/auth/stream", { withCredentials: true });
    } catch {
      startPoll();
      scheduleReconnect();
      return;
    }
    es.addEventListener("hello", () => {
      sseOk = true;
      reconnectAttempt = 0;
      clearPoll();
    });
    es.addEventListener("account", (ev) => {
      sseOk = true;
      reconnectAttempt = 0;
      clearPoll();
      try {
        const data = JSON.parse(String((ev as MessageEvent).data || "{}")) as {
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
    });
    es.onerror = () => {
      sseOk = false;
      try {
        es?.close();
      } catch {
        /* */
      }
      es = null;
      startPoll();
      scheduleReconnect();
    };
  };

  const onVis = () => {
    if (stopped) return;
    if (!isPageVisible()) {
      clearPoll();
      return;
    }
    if (!sseOk) {
      startPoll();
      if (!es && !reconnectTimer) scheduleReconnect();
    }
  };

  connect();
  // Chỉ fallback nếu sau 5s chưa hello — không luôn bật poll khi SSE đã ổn
  const boot = setTimeout(() => {
    if (!sseOk) startPoll();
  }, 5000);
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stopped = true;
    clearTimeout(boot);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    clearPoll();
    document.removeEventListener("visibilitychange", onVis);
    try {
      es?.close();
    } catch {
      /* */
    }
  };
}
