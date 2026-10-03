"use client";

import { useMemo, useState } from "react";
import { Flame, Zap } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { stageChips } from "@/lib/campaign/flashSlots";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { DealsProducts } from "./DealsProducts";

function getSlotEndTargetMs(slot: { start: string; end: string } | undefined, nowMs: number): number | null {
  if (!slot) return null;
  const d = new Date(nowMs + 7 * 3600_000);
  const [endH, endM] = slot.end.split(":").map(Number);
  const [startH] = slot.start.split(":").map(Number);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  let endUtc = Date.UTC(y, m, day, endH || 0, endM || 0) - 7 * 3600_000;
  if ((endH || 0) < (startH || 0) && d.getUTCHours() >= (startH || 0)) {
    endUtc += 86_400_000;
  }
  return endUtc;
}

export function DealsFlash({
  campaign,
  offsetMs,
  initialSlot = null,
  slotOnly = false,
}: {
  campaign: CampaignUI;
  offsetMs: number;
  /** `?slot=` từ sân khấu Flash Sale trang chủ. */
  initialSlot?: string | null;
  /** Trang tổng quan: chỉ SP gán khung giờ (SP cả ngày đã có ở lưới bên dưới); không có thì ẩn cả mục. */
  slotOnly?: boolean;
}) {
  const nowMs = Date.now() + offsetMs;
  // Cùng thứ tự / trạng thái với sân khấu Flash Sale trang chủ: đang mở → sắp tới → ngày mai.
  const chips = stageChips(campaign.slots, campaign.phase, nowMs, Date.parse(campaign.endAt));
  const chipOf = new Map(chips.map((c) => [c.key, c]));
  const allSlots = chips.flatMap((c) => campaign.slots.filter((s) => s.key === c.key));
  const openKey = chips.find((c) => c.status === "open")?.key ?? null;
  const slots = slotOnly ? allSlots.filter((s) => campaign.products.some((p) => p.slotKey === s.key)) : allSlots;
  const openSlot = slots.find((s) => s.key === openKey);
  const endTarget = getSlotEndTargetMs(openSlot, nowMs);
  const cd = useCountdown(endTarget, offsetMs);

  const [picked, setPicked] = useState<string | null>(() =>
    initialSlot && slots.some((s) => s.key === initialSlot) ? initialSlot : null,
  );
  const active = picked || (openSlot ? openKey : null) || slots[0]?.key || null;
  const activeSlot = slots.find((s) => s.key === active);
  // SP không gán khung giờ bán giá sale suốt chiến dịch → có mặt ở mọi khung, như dải Flash Sale trang chủ.
  const mas = useMemo(() => {
    const inSlot = campaign.products.filter((p) => p.slotKey && p.slotKey === active).map((p) => p.ma);
    const allDay = slotOnly ? [] : campaign.products.filter((p) => !p.slotKey).map((p) => p.ma);
    return [...new Set([...inSlot, ...allDay])];
  }, [campaign.products, active, slotOnly]);
  if (!slots.length) return null;

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
      {/* HEADER FLASH SALE VÀ ĐỒNG HỒ ĐẾM NGƯỢC GIÂY CHUẨN SÀN TMĐT */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-base sm:text-lg font-black uppercase text-[#C8102E] tracking-tight">
          <Zap size={20} aria-hidden className="fill-[#C8102E]" />
          <span>Flash Sale Theo Khung Giờ</span>
        </h2>

        {openSlot && endTarget && !cd.done ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200/80 px-3 py-1.5 shadow-2xs">
            <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#E53935]">
              <Flame size={14} className="fill-[#E53935] animate-pulse" />
              <span>Kết thúc trong:</span>
            </span>
            <div className="flex items-center gap-1 font-black tabular-nums text-white">
              <span className="rounded bg-[#E53935] px-1.5 py-0.5 text-xs">{cd.h}</span>
              <span className="text-[#E53935]">:</span>
              <span className="rounded bg-[#E53935] px-1.5 py-0.5 text-xs">{cd.m}</span>
              <span className="text-[#E53935]">:</span>
              <span className="rounded bg-[#E53935] px-1.5 py-0.5 text-xs">{cd.s}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* DANH SÁCH CÁC CHIP KHUNG GIỜ */}
      <div
        role="tablist"
        aria-label="Khung giờ flash sale"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slots.map((s) => {
          const on = s.key === active;
          const isLive = s.key === openKey;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(s.key)}
              className={`min-h-[46px] shrink-0 rounded-2xl px-4 py-1.5 text-left text-sm font-bold transition-all ${
                on
                  ? "bg-[#C8102E] text-white shadow-md scale-[1.02]"
                  : "bg-white text-slate-700 ring-1 ring-black/5 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1.5 leading-tight">
                <span>{s.start}–{s.end}</span>
                {isLive && !on ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-[#E53935] animate-ping" />
                ) : null}
              </div>
              <span className="block text-[10px] font-semibold opacity-90 mt-0.5">
                {isLive ? "🔥 " : "⏰ "}
                {chipOf.get(s.key)?.text || "Sắp diễn ra"}
                {s.label?.trim() ? ` · ${s.label.trim()}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* GHI CHÚ TRẠNG THÁI KHUNG GIỜ ĐANG CHỌN */}
      {activeSlot && activeSlot.key !== openKey ? (
        <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-2.5 text-xs text-amber-800 flex items-center gap-2">
          <span>⏰</span>
          <span>Khung giờ <strong>{activeSlot.start}–{activeSlot.end}</strong> sắp mở bán. Hãy quay lại đúng giờ để săn cây giá sốc!</span>
        </div>
      ) : null}

      <DealsProducts mas={mas} emptyText="Khung giờ này chưa có sản phẩm." />
    </div>
  );
}
