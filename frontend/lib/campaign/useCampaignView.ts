"use client";

import { useCurrentCampaign } from "./campaignQueries";
import { isRunningPhase, isSellingPhase } from "./campaignApi";

/** Dữ liệu chiến dịch dạng tiện dùng cho các khối giao diện. */
export function useCampaignView() {
  const q = useCurrentCampaign();
  const data = q.data;
  const campaign = data?.campaign && isRunningPhase(data.campaign.phase) ? data.campaign : null;
  return {
    loading: q.isLoading,
    data,
    campaign,
    running: Boolean(campaign),
    selling: isSellingPhase(campaign?.phase),
    lastHours: campaign?.phase === "lastHours",
    offsetMs: data?.offsetMs || 0,
    viewer: data?.viewer || null,
    vouchers: data?.vouchers || [],
    upcoming: data?.upcoming || null,
  };
}

/** Chuỗi băm ngắn ổn định (đánh dấu "đã tắt" theo nội dung, đổi nội dung thì hiện lại). */
export function shortHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
