"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  onShopAppearanceChanged,
  onShopCatalogChanged,
  startShopCatalogStream,
  SHOP_CATALOG_CHANGED,
} from "@/lib/catalogSync";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";

/**
 * SSE catalog + appearance: Xuất bản Website bán hàng → shop tự refresh, không cần F5.
 */
export function ShopCatalogSync() {
  const router = useRouter();

  useEffect(() => startShopCatalogStream(), []);

  useEffect(
    () =>
      onShopCatalogChanged(() => {
        void refreshCartPricesFromCatalog().catch(() => undefined);
      }),
    []
  );

  useEffect(
    () =>
      onShopAppearanceChanged(() => {
        router.refresh();
      }),
    [router]
  );

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      window.dispatchEvent(
        new CustomEvent(SHOP_CATALOG_CHANGED, {
          detail: { ids: [], at: Date.now(), source: "poll-fallback" },
        })
      );
      void refreshCartPricesFromCatalog().catch(() => undefined);
    };
    const id = window.setInterval(tick, 8_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
