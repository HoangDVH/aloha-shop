"use client";

import { createSharedSseLeader, isPageVisible } from "@/lib/sharedSseLeader";

export const SHOP_CATALOG_CHANGED = "aloha-shop-catalog-changed";
export const SHOP_APPEARANCE_CHANGED = "aloha-shop-appearance-changed";
export const SHOP_CAMPAIGN_CHANGED = "aloha-shop-campaign-changed";

/** Chiến dịch đổi (áp dụng / tạm dừng) hoặc suất flash đổi. */
export function onShopCampaignChanged(onChange: (kind: "campaign" | "flash") => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => onChange((ev as CustomEvent<{ kind: "campaign" | "flash" }>).detail?.kind || "campaign");
  window.addEventListener(SHOP_CAMPAIGN_CHANGED, handler);
  return () => window.removeEventListener(SHOP_CAMPAIGN_CHANGED, handler);
}

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

/**
 * SSE catalog + appearance dùng chung Leader-Follower giữa nhiều tab.
 * Fallback poll chỉ chạy trên tab Leader khi SSE down + tab visible.
 */
export function startShopCatalogStream(): () => void {
  if (typeof window === "undefined") return () => {};

  let stopped = false;
  let sseOk = false;
  let isLeader = false;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let emitFallback: ((type: string, data: string) => void) | null = null;

  const clearFallback = () => {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const startFallback = () => {
    if (fallbackTimer || stopped || !isLeader || sseOk || !isPageVisible()) return;
    fallbackTimer = setInterval(() => {
      if (stopped || !isLeader || sseOk || !isPageVisible()) return;
      const payload = JSON.stringify({ ids: [], at: Date.now(), source: "fallback-poll" });
      if (emitFallback) {
        emitFallback("catalog", payload);
      } else {
        emitCatalog({ ids: [], at: Date.now(), source: "fallback-poll" });
      }
    }, 40_000);
  };

  const stopLeader = createSharedSseLeader({
    lockName: "aloha_sse_catalog",
    channelName: "aloha_sse_catalog",
    url: "/api/shop/catalog/stream",
    events: ["hello", "catalog", "appearance", "campaign", "flash"],
    onEvent: (type, rawData) => {
      if (type === "catalog") {
        try {
          const data = JSON.parse(rawData || "{}") as { ids?: string[]; at?: number; source?: string };
          emitCatalog({
            ids: Array.isArray(data.ids) ? data.ids.map(String) : [],
            at: Number(data.at) || Date.now(),
            source: data.source,
          });
        } catch {
          emitCatalog({ ids: [], at: Date.now() });
        }
      } else if (type === "appearance") {
        try {
          const data = JSON.parse(rawData || "{}") as { at?: number; source?: string };
          emitAppearance({ at: Number(data.at) || Date.now(), source: data.source });
        } catch {
          emitAppearance({ at: Date.now() });
        }
      } else if (type === "campaign" || type === "flash") {
        window.dispatchEvent(new CustomEvent(SHOP_CAMPAIGN_CHANGED, { detail: { kind: type, at: Date.now() } }));
      }
    },
    onConnectionChange: (state, helpers) => {
      sseOk = state.connected;
      isLeader = state.isLeader;
      emitFallback = helpers.emitLocalAndBroadcast;
      if (state.connected || !state.isLeader) {
        clearFallback();
      } else {
        startFallback();
      }
    },
  });

  const onVis = () => {
    if (stopped) return;
    if (!isPageVisible()) {
      clearFallback();
    } else if (!sseOk && isLeader) {
      startFallback();
    }
  };

  const boot = setTimeout(() => {
    if (!sseOk && isLeader) startFallback();
  }, 4000);
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stopped = true;
    clearTimeout(boot);
    clearFallback();
    document.removeEventListener("visibilitychange", onVis);
    stopLeader();
  };
}
