"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { useCampaignRequoteKey } from "@/lib/campaign/campaignQuote";

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

    void load();
    const onSession = () => {
      setLiveMap({});
      void load();
    };
    window.addEventListener("aloha-price-session", onSession);

    let onCatalog: (() => void) | undefined;
    let onCampaign: (() => void) | undefined;
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
        void load();
      });
      onCampaign = onShopCampaignChanged(() => {
        window.setTimeout(() => void load(), Math.floor(Math.random() * 2000));
      });
    });

    return () => {
      cancelled = true;
      onCatalog?.();
      onCampaign?.();
      window.removeEventListener("aloha-price-session", onSession);
    };
  }, [masKey]);

  const slotKey = useCampaignRequoteKey();
  const lastSlotKey = useRef(slotKey);
  useEffect(() => {
    if (!hasPromo || !masKey) return;
    const refresh = async () => {
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
    const id = window.setInterval(refresh, PROMO_REFRESH_MS);
    return () => window.clearInterval(id);
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
