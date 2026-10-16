"use client";

import { useQuery } from "@tanstack/react-query";
import { shopApiBase } from "./api";
import type { PublicAppearance } from "./appearance";
import type { GiftCardItem } from "@/components/gift/HomeGiftSection";

export const PUBLIC_CONTENT_KEY = ["shop_public_content"] as const;
const contentPolicy = { staleTime: 60_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true };

async function readContent(path: string) {
  // Keep small shared requests alive across transient unmounts (including StrictMode).
  const response = await fetch(`${shopApiBase()}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Public content request failed (${response.status})`);
  return response.json();
}

export const appearanceQueryOptions = {
  ...contentPolicy,
  queryKey: [...PUBLIC_CONTENT_KEY, "appearance"] as const,
  queryFn: async (): Promise<PublicAppearance> => {
    const data = await readContent("/api/shop/appearance");
    if (!data?.theme || !Array.isArray(data.blocks)) throw new Error("Invalid appearance response");
    return data;
  },
};

export const giftsQueryOptions = {
  ...contentPolicy,
  queryKey: [...PUBLIC_CONTENT_KEY, "gifts"] as const,
  queryFn: async (): Promise<GiftCardItem[]> => {
    const data = await readContent("/api/shop/gifts");
    if (!data?.ok || !Array.isArray(data.data)) throw new Error("Invalid gifts response");
    return data.data;
  },
};

export function usePublicAppearance(enabled = true) {
  return useQuery({ ...appearanceQueryOptions, enabled });
}

export function usePublicGifts(initialItems?: GiftCardItem[]) {
  return useQuery({ ...giftsQueryOptions, initialData: initialItems?.length ? initialItems : undefined });
}
