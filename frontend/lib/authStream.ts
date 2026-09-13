"use client";

/**
 * SSE phiên CTV/auth — khi admin duyệt tài khoản, shop nhận ngay (không F5).
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

/** Mở SSE /api/shop/auth/stream (cần cookie đăng nhập). */
export function startShopAuthStream(): () => void {
  if (typeof window === "undefined") return () => {};

  let es: EventSource | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    if (pollTimer || stopped) return;
    pollTimer = setInterval(() => {
      emitAccount({ at: Date.now(), source: "auth-poll" });
    }, 12_000);
  };

  const connect = () => {
    if (stopped || typeof EventSource === "undefined") {
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
      clearPoll();
    });
    es.addEventListener("account", (ev) => {
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

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2500);
  };

  connect();
  const boot = setTimeout(() => startPoll(), 5000);

  return () => {
    stopped = true;
    clearTimeout(boot);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    clearPoll();
    try {
      es?.close();
    } catch {
      /* */
    }
  };
}
