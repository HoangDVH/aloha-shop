"use client";

export const SHOP_CATALOG_CHANGED = "aloha-shop-catalog-changed";
export const SHOP_APPEARANCE_CHANGED = "aloha-shop-appearance-changed";

export type ShopCatalogChangeDetail = {
  ids: string[];
  at: number;
  source?: string;
};

export type ShopAppearanceChangeDetail = {
  at: number;
  source?: string;
};

/** Chỉ lắng nghe CustomEvent — dùng trên từng trang/UI (không mở thêm SSE). */
export function onShopCatalogChanged(
  onChange: (detail: ShopCatalogChangeDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => {
    const d = (ev as CustomEvent<ShopCatalogChangeDetail>).detail;
    onChange({
      ids: d?.ids || [],
      at: d?.at || Date.now(),
      source: d?.source,
    });
  };
  window.addEventListener(SHOP_CATALOG_CHANGED, handler);
  return () => window.removeEventListener(SHOP_CATALOG_CHANGED, handler);
}

export function onShopAppearanceChanged(
  onChange: (detail: ShopAppearanceChangeDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => {
    const d = (ev as CustomEvent<ShopAppearanceChangeDetail>).detail;
    onChange({
      at: d?.at || Date.now(),
      source: d?.source,
    });
  };
  window.addEventListener(SHOP_APPEARANCE_CHANGED, handler);
  return () => window.removeEventListener(SHOP_APPEARANCE_CHANGED, handler);
}

function emitCatalog(detail: ShopCatalogChangeDetail) {
  window.dispatchEvent(new CustomEvent(SHOP_CATALOG_CHANGED, { detail }));
}

function emitAppearance(detail: ShopAppearanceChangeDetail) {
  window.dispatchEvent(new CustomEvent(SHOP_APPEARANCE_CHANGED, { detail }));
}

function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/** Exponential backoff + jitter, cap 30s. */
function nextBackoffMs(attempt: number) {
  const base = Math.min(30_000, 2000 * Math.pow(2, Math.max(0, attempt)));
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/**
 * SSE catalog + appearance.
 * Fallback poll chỉ khi SSE down + tab visible (chuẩn marketplace).
 */
export function startShopCatalogStream(): () => void {
  if (typeof window === "undefined") return () => {};

  let es: EventSource | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let sseOk = false;
  let reconnectAttempt = 0;

  const clearFallback = () => {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const startFallback = () => {
    if (fallbackTimer || stopped) return;
    if (!isPageVisible()) return;
    fallbackTimer = setInterval(() => {
      if (!isPageVisible() || sseOk) return;
      emitCatalog({ ids: [], at: Date.now(), source: "fallback-poll" });
    }, 40_000);
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
      startFallback();
      return;
    }
    try {
      es = new EventSource("/api/shop/catalog/stream");
    } catch {
      startFallback();
      scheduleReconnect();
      return;
    }
    es.addEventListener("hello", () => {
      sseOk = true;
      reconnectAttempt = 0;
      clearFallback();
    });
    es.addEventListener("catalog", (ev) => {
      sseOk = true;
      reconnectAttempt = 0;
      clearFallback();
      try {
        const data = JSON.parse(String((ev as MessageEvent).data || "{}")) as {
          ids?: string[];
          at?: number;
          source?: string;
        };
        emitCatalog({
          ids: Array.isArray(data.ids) ? data.ids.map(String) : [],
          at: Number(data.at) || Date.now(),
          source: data.source,
        });
      } catch {
        emitCatalog({ ids: [], at: Date.now() });
      }
    });
    es.addEventListener("appearance", (ev) => {
      sseOk = true;
      reconnectAttempt = 0;
      clearFallback();
      try {
        const data = JSON.parse(String((ev as MessageEvent).data || "{}")) as {
          at?: number;
          source?: string;
        };
        emitAppearance({
          at: Number(data.at) || Date.now(),
          source: data.source,
        });
      } catch {
        emitAppearance({ at: Date.now() });
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
      startFallback();
      scheduleReconnect();
    };
  };

  const onVis = () => {
    if (stopped) return;
    if (!isPageVisible()) {
      clearFallback();
      return;
    }
    if (!sseOk) {
      startFallback();
      if (!es && !reconnectTimer) scheduleReconnect();
    }
  };

  connect();
  const boot = setTimeout(() => {
    if (!sseOk) startFallback();
  }, 4000);
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stopped = true;
    clearTimeout(boot);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    clearFallback();
    document.removeEventListener("visibilitychange", onVis);
    try {
      es?.close();
    } catch {
      /* */
    }
  };
}
