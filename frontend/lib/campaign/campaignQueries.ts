"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onShopCampaignChanged } from "@/lib/catalogSync";
import { fetchCurrentCampaign } from "./campaignApi";

export const CURRENT_CAMPAIGN_KEY = ["shop", "campaign", "current"] as const;
const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

/** Chờ ngẫu nhiên 0–2 giây trước khi tải lại, tránh dồn request lúc mở khung. */
const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 2000)));

/**
 * Chiến dịch hiện hành, tự làm mới ≤ 40 giây và ngay khi server phát event `campaign`.
 * `offsetMs` = lệch giờ server − máy khách, dùng cho đếm ngược.
 */
export function useCurrentCampaign() {
  // All campaign consumers share the same initial SSR/client snapshot, even with a warm query cache.
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CURRENT_CAMPAIGN_KEY,
    queryFn: fetchCurrentCampaign,
    staleTime: 30_000,
    refetchInterval: 40_000,
    refetchOnWindowFocus: true,
  });

  useEffect(
    () =>
      onShopCampaignChanged(async (kind) => {
        if (kind !== "campaign") return;
        await jitter();
        void qc.invalidateQueries({ queryKey: CURRENT_CAMPAIGN_KEY });
      }),
    [qc]
  );

  return { ...query, data: hydrated ? query.data : undefined, isLoading: !hydrated || query.isLoading };
}
