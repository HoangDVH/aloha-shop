"use client";

import { BadgeCheck, RefreshCcw, Truck, Wallet, type LucideIcon } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";

function iconFor(text: string): LucideIcon {
  const t = text.toLowerCase();
  if (t.includes("giao")) return Truck;
  if (t.includes("đổi") || t.includes("trả")) return RefreshCcw;
  if (t.includes("thanh toán")) return Wallet;
  return BadgeCheck;
}

/** Cam kết lấy từ dữ liệu chiến dịch (nhãn + lợi ích về giao hàng), không tự bịa. */
export function trustItemsOf(campaign: CampaignUI): string[] {
  const { benefits, tags } = campaign.display.hero;
  const ship = benefits.filter((b) => b.toLowerCase().includes("giao"));
  return [...new Set([...ship, ...tags].map((s) => s.trim()).filter(Boolean))].slice(0, 4);
}

/** Dải cam kết cạnh thể lệ cuối trang (hạn đặt đã nằm trong ô banner). */
export function DealsTrust({ campaign }: { campaign: CampaignUI }) {
  const trust = trustItemsOf(campaign);
  if (!trust.length) return null;
  return (
    <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0 [&::-webkit-scrollbar]:hidden">
      {trust.map((t) => {
        const Icon = iconFor(t);
        return (
          <li
            key={t}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs ring-1 ring-black/[0.05]"
          >
            <Icon size={14} className="text-emerald-600" aria-hidden />
            {t}
          </li>
        );
      })}
    </ul>
  );
}
