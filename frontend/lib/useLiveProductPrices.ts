"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { useCampaignRequoteKey } from "@/lib/campaign/campaignQuote";
import { isPageVisible, onPageVisible } from "@/lib/sharedSseLeader";

export type LiveProductPrice = {
  gia: number;
  webPrice?: number;
  ton: number;
  priceKind?: ShopProduct["priceKind"];
  allowBackorder?: boolean;
  /** `undefined` = server không gửi (cờ tắt) → giữ dữ liệu SSR; `null` = hết ưu đãi. */
  campaignPromo?: CampaignPromoUI | null;
};

/** Có card ưu đãi trên lưới → làm mới định kỳ để hết khung giờ / tạm dừng thì card về dạng thường. */
const PROMO_REFRESH_MS = 40_000;

/**
 * Batch-fetch giá/tồn theo mã SP (cookies SI). Dùng chung ProductGrid + carousel trang chủ.
 */
export function useLiveProductPrices(products: ShopProduct[]) {
  const [liveMap, setLiveMap] = useState<Record<string, LiveProductPrice>>({});
  const masKey = products.map((p) => p.ma).join("|");
  const hasPromo =
    products.some((p) => p.campaignPromo) || Object.values(liveMap).some((l) => l.campaignPromo);

  useEffect(() => {
    let cancelled = false;
    const mas = masKey ? masKey.split("|").filter(Boolean) : [];
    if (!mas.length) {
      setLiveMap({});
      return;
    }

    let pendingReload = false;
    const load = async () => {
      try {
        const { fetchLivePrices } = await import("@/lib/livePrices");
        const rows = await fetchLivePrices(mas);
        if (cancelled) return;
        const next: Record<string, LiveProductPrice> = {};
        for (const r of rows) {
          const ma = String(r.ma || "").trim().toUpperCase();
          if (!ma) continue;
          next[ma] = {
            gia: Number(r.gia) || 0,
            webPrice: r.webPrice,
            ton: Number(r.ton) || 0,
            priceKind: r.priceKind,
            allowBackorder: r.allowBackorder,
            campaignPromo: r.campaignPromo,
          };
        }
        setLiveMap(next);
      } catch {
        /* giữ giá SSR */
      }
    };

    const runOrDefer = () => {
      if (!isPageVisible()) {
        pendingReload = true;
        return;
      }
      pendingReload = false;
      void load();
    };

    runOrDefer();
    const stopVis = onPageVisible(() => {
      if (!cancelled && pendingReload) {
        pendingReload = false;
        void load();
      }
    });
    const onSession = () => {
      setLiveMap({});
      runOrDefer();
    };
    window.addEventListener("aloha-price-session", onSession);

    let onCatalog: (() => void) | undefined;
    let onCampaign: (() => void) | undefined;
    let campaignTimer: number | undefined;
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged, onShopCampaignChanged }) => {
      if (cancelled) return;
      onCatalog = onShopCatalogChanged((detail) => {
        const ids = (detail.ids || []).map((x) => String(x).toUpperCase());
        if (
          ids.length &&
          !mas.some((m) => ids.includes(String(m).toUpperCase()))
        ) {
          return;
        }
        runOrDefer();
      });
      onCampaign = onShopCampaignChanged(() => {
        if (campaignTimer) window.clearTimeout(campaignTimer);
        campaignTimer = window.setTimeout(() => {
          campaignTimer = undefined;
          runOrDefer();
        }, Math.floor(Math.random() * 2000));
      });
    });

    return () => {
      cancelled = true;
      stopVis();
      if (campaignTimer) window.clearTimeout(campaignTimer);
      onCatalog?.();
      onCampaign?.();
      window.removeEventListener("aloha-price-session", onSession);
    };
  }, [masKey]);

  const slotKey = useCampaignRequoteKey();
  const lastSlotKey = useRef(slotKey);
  useEffect(() => {
    if (!hasPromo || !masKey) return;
    let promoDirty = false;
    const refresh = async () => {
      if (!isPageVisible()) {
        promoDirty = true;
        return;
      }
      promoDirty = false;
      const { fetchLivePrices } = await import("@/lib/livePrices");
      const mas = masKey.split("|").filter(Boolean);
      const rows = await fetchLivePrices(mas).catch(() => null);
      if (!rows) return;
      setLiveMap((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          const ma = String(r.ma || "").trim().toUpperCase();
          if (ma && next[ma]) next[ma] = { ...next[ma], campaignPromo: r.campaignPromo };
        }
        return next;
      });
    };
    if (lastSlotKey.current !== slotKey) {
      lastSlotKey.current = slotKey;
      void refresh();
    }
    const stopVis = onPageVisible(() => {
      if (promoDirty) void refresh();
    });
    const id = window.setInterval(refresh, PROMO_REFRESH_MS);
    return () => {
      stopVis();
      window.clearInterval(id);
    };
  }, [hasPromo, masKey, slotKey]);

  return liveMap;
}

export function livePropsForMa(
  liveMap: Record<string, LiveProductPrice>,
  ma: string
) {
  const key = String(ma || "").trim().toUpperCase();
  const live = liveMap[key];
  return {
    liveWebPrice: live?.webPrice,
    livePriceKind: live?.priceKind,
    liveAllowBackorder: live?.allowBackorder,
    liveGia: live != null ? live.gia : undefined,
    liveTon: live != null ? live.ton : undefined,
    liveCampaignPromo: live?.campaignPromo,
  };
}
