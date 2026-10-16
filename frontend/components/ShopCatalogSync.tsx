"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  onShopAppearanceChanged,
  onShopCatalogChanged,
  startShopCatalogStream,
} from "@/lib/catalogSync";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { PUBLIC_CONTENT_KEY } from "@/lib/publicContentQueries";

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
  const queryClient = useQueryClient();
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
      // One listener for all consumers: one refetch per content key, not per component.
      void queryClient.invalidateQueries({ queryKey: PUBLIC_CONTENT_KEY });
      router.refresh();
    });
  }, [enabled, router, queryClient]);

  return null;
}
