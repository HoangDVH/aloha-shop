"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";
import { useCurrentCampaign, CURRENT_CAMPAIGN_KEY } from "@/lib/campaign/campaignQueries";
import { exitPreview } from "@/lib/campaign/previewMode";

const PHASE_LABEL: Record<string, string> = {
  upcoming: "chưa tới giờ",
  teaser: "khởi động",
  live: "đang chạy",
  lastHours: "giờ chót",
  ended: "đã kết thúc",
};

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

/** Chỉ hiện khi mở bằng link xem trước của admin; nhắc rằng giá khi đặt hàng vẫn là giá thật. */
export function PreviewBar() {
  const qc = useQueryClient();
  const { data } = useCurrentCampaign();
  if (!data?.preview && !data?.previewError) return null;

  const exit = () => {
    exitPreview();
    void qc.invalidateQueries({ queryKey: CURRENT_CAMPAIGN_KEY });
  };

  if (data.previewError) {
    return (
      <div className="bg-amber-100 px-3 py-1.5 text-center text-xs text-amber-900" role="status">
        {data.previewError}
      </div>
    );
  }

  const phase = data.campaign?.phase || data.state || "";
  return (
    <div className="flex items-center justify-center gap-2 bg-slate-900 px-3 py-1.5 text-xs text-white" role="status">
      <Eye size={14} aria-hidden />
      <span className="min-w-0 truncate">
        Xem trước bản nháp · giờ giả lập <b>{fmt(Date.now() + data.offsetMs)}</b>
        {phase ? ` (${PHASE_LABEL[phase] || phase})` : ""} · Giá khi đặt hàng vẫn là giá thật
      </span>
      <button type="button" onClick={exit} className="ml-1 inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 hover:bg-white/25">
        <X size={12} aria-hidden /> Thoát
      </button>
    </div>
  );
}
