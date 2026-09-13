"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const warmedRoutes = new Set<string>();
const warmedApi = new Set<string>();

export { notifyShopNavStart } from "@/lib/shopLoading";

export function prefetchShopPath(router: AppRouterInstance, path: string) {
  const href = String(path || "").trim();
  if (!href || href.startsWith("http")) return;

  if (!warmedRoutes.has(href)) {
    warmedRoutes.add(href);
    try {
      router.prefetch(href);
    } catch {
      warmedRoutes.delete(href);
    }
  }

  if (typeof window === "undefined" || warmedApi.has(href)) return;
  warmedApi.add(href);
  const url = `/api/shop/resolve?path=${encodeURIComponent(href)}`;
  fetch(url, {
    headers: { Accept: "application/json" },
  }).catch(() => warmedApi.delete(href));
}

export function prefetchShopPaths(router: AppRouterInstance, paths: string[]) {
  for (const p of paths) prefetchShopPath(router, p);
}
