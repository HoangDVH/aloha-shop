"use client";
import { useEffect, useState } from "react";
import { fetchProducts } from "@/lib/api";

export const CATALOG_BADGES = ["noi_bat", "moi", "ban_chay_sap_het", "giam_gia"] as const;
export type BadgeCounts = Partial<Record<string, number>>;
type Scope = Parameters<typeof fetchProducts>[0];

export function useCatalogBadgeCounts(scope: Scope, enabled = true): BadgeCounts {
  const key = JSON.stringify(scope);
  const [result, setResult] = useState<{ key: string; counts: BadgeCounts } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const base: Scope = JSON.parse(key);
      const rows = await Promise.all(CATALOG_BADGES.map(async badge => {
        try {
          const response = await fetchProducts({ ...base, badge, sort: "ten", page: 1, limit: 1, signal: controller.signal });
          return [badge, response.total] as const;
        } catch { return [badge, undefined] as const; }
      }));
      if (!controller.signal.aborted) setResult({ key, counts: Object.fromEntries(rows.filter(row => row[1] !== undefined)) });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, enabled]);
  return enabled && result?.key === key ? result.counts : {};
}
