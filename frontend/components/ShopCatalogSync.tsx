"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  onShopAppearanceChanged,
  onShopCatalogChanged,
  startShopCatalogStream,
} from "@/lib/catalogSync";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";

function isStorefrontPath(pathname: string) {
  const p = pathname || "/";
  if (p.startsWith("/admin")) return false;
  if (p.startsWith("/cong-tac-vien")) return false;
  return true;
}

/**
 * SSE catalog + appearance — chỉ storefront (không gắn poll nền lên admin/CTV).
 */
export function ShopCatalogSync() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const enabled = isStorefrontPath(pathname);

  useEffect(() => {
    if (!enabled) return;
    return startShopCatalogStream();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return onShopCatalogChanged(() => {
      void refreshCartPricesFromCatalog().catch(() => undefined);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return onShopAppearanceChanged(() => {
      router.refresh();
    });
  }, [enabled, router]);

  return null;
}
