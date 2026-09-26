"use client";

import { useEffect, useState } from "react";
import type { ShopProduct } from "@/lib/api";

export type LiveProductPrice = {
  gia: number;
  webPrice?: number;
  ton: number;
  priceKind?: ShopProduct["priceKind"];
  allowBackorder?: boolean;
};

/**
 * Batch-fetch giá/tồn theo mã SP (cookies SI). Dùng chung ProductGrid + carousel trang chủ.
 */
export function useLiveProductPrices(products: ShopProduct[]) {
  const [liveMap, setLiveMap] = useState<Record<string, LiveProductPrice>>({});
  const masKey = products.map((p) => p.ma).join("|");

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
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged }) => {
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
    });

    return () => {
      cancelled = true;
      onCatalog?.();
      window.removeEventListener("aloha-price-session", onSession);
    };
  }, [masKey]);

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
  };
}
