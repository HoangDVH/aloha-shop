"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { websiteApi } from "../api";

type Counts = { views: number; clicks: number; closes: number };
type Stats = Counts & { campaignId: string; today: Counts; updatedAt: string | null };

const rate = (c: Counts) => (c.views > 0 ? `${Math.round((c.clicks / c.views) * 1000) / 10}%` : "—");

/** Số lần hiện / bấm / đóng của popup theo mã chiến dịch. */
export function PopupStats({ campaignId }: { campaignId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const r = await websiteApi<Stats>(
        `/api/shop/admin/appearance/popup-stats?campaignId=${encodeURIComponent(id)}`
      );
      setStats(r);
      setError("");
    } catch (e: any) {
      setStats(null);
      setError(e?.message || "Không tải được số liệu");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const id = campaignId.trim();
    const t = setTimeout(() => void load(id), 400);
    return () => clearTimeout(t);
  }, [campaignId, load]);

  const row = (title: string, c: Counts) => (
    <div className="grid grid-cols-4 gap-1 text-center">
      <span className="text-left text-gray-500">{title}</span>
      <span>{c.views}</span>
      <span>
        {c.clicks} <span className="text-gray-400">({rate(c)})</span>
      </span>
      <span>{c.closes}</span>
    </div>
  );

  return (
    <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-800">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Hiệu quả popup · mã «{campaignId.trim() || "—"}»</span>
        <button
          type="button"
          onClick={() => void load(campaignId.trim())}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Tải lại
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : stats ? (
        <>
          <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-gray-500">
            <span />
            <span>Đã hiện</span>
            <span>Bấm vào ảnh</span>
            <span>Đóng</span>
          </div>
          {row("Hôm nay", stats.today)}
          {row("Tổng", stats)}
        </>
      ) : (
        <p className="text-[11px] text-gray-500">Đang tải…</p>
      )}
      <p className="text-[11px] text-gray-500">Đổi mã chiến dịch thì số liệu đếm lại từ đầu.</p>
    </div>
  );
}
