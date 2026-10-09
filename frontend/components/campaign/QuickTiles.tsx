"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Flame,
  Gift,
  Percent,
  Sparkles,
  Star,
  Tag,
  TicketPercent,
  Trophy,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CampaignUI, CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { dealsHref, toDealsTab } from "@/lib/campaign/dealsTabs";

type Kind = "voucher" | "flash" | "hot" | "gift" | "top" | "ship" | "other";

const KIND_BY_ICON: Record<string, Kind> = {
  ticket: "voucher",
  voucher: "voucher",
  flash: "flash",
  zap: "flash",
  flame: "hot",
  hot: "hot",
  gift: "gift",
  trophy: "top",
  bestseller: "top",
  top: "top",
  truck: "top",
  ship: "top",
};

const KIND_BY_TAB: Record<string, Kind> = {
  voucher: "voucher",
  "flash-sale": "flash",
  "deal-hot": "hot",
  "qua-tang": "gift",
  "ban-chay": "top",
};

const ICONS: Record<string, LucideIcon> = {
  ticket: TicketPercent,
  voucher: TicketPercent,
  flash: Zap,
  zap: Zap,
  gift: Gift,
  flame: Flame,
  hot: Flame,
  trophy: Trophy,
  top: Trophy,
  bestseller: Trophy,
  truck: Trophy,
  ship: Trophy,
  percent: Percent,
  star: Star,
  tag: Tag,
};

/** Màu ô icon theo loại (nền nhạt + icon đậm; Top Bán Chạy nền vàng cam danh giá). */
const TONE: Record<Kind, { box: string; icon: string; sub: string }> = {
  voucher: { box: "bg-[#E7F4EA]", icon: "text-[#1F7A3D]", sub: "text-slate-500" },
  flash: { box: "bg-[#FFE1E1]", icon: "text-[#D61F2C]", sub: "font-semibold text-[#D61F2C]" },
  hot: { box: "bg-[#FFEAD9]", icon: "text-[#E2620E]", sub: "text-slate-500" },
  gift: { box: "bg-[#FFF3E0]", icon: "text-[#C77700]", sub: "text-slate-500" },
  top: { box: "bg-[#FFF8E1]", icon: "text-[#D97706]", sub: "text-slate-500" },
  ship: { box: "bg-[#FFF8E1]", icon: "text-[#D97706]", sub: "text-slate-500" },
  other: { box: "bg-slate-100", icon: "text-slate-700", sub: "text-slate-500" },
};

function tabOf(href: string) {
  if (!href.startsWith("/uu-dai")) return null;
  return toDealsTab(new URLSearchParams(href.split("?")[1]?.split("#")[0] || "").get("tab"));
}

function tileHref(href: string, kind: Kind): string {
  const to = dealsHref(href);
  if (kind === "top" || href.includes("ban-chay")) {
    return "/uu-dai?tab=ban-chay";
  }
  if (kind !== "ship" || !to.startsWith("/uu-dai")) return to;
  const params = new URLSearchParams(to.split("?")[1] || "");
  if ((params.get("tab") || "voucher") !== "voucher") return to;
  params.set("tab", "voucher");
  params.set("loai", "ship");
  return `/uu-dai?${params.toString()}`;
}

/** Thanh chuyển tab ưu đãi (trang Ưu đãi): thanh ngang màu trắng bo góc, icon màu, tab active gradient đỏ kèm nhãn ĐANG XEM. */
export function QuickTiles({
  campaign,
  vouchers,
  offsetMs,
  activeTab,
  activeLoai,
  className,
  variant = "tabs",
}: {
  campaign: CampaignUI;
  vouchers: CampaignVoucherUI[];
  offsetMs: number;
  activeTab?: string | null;
  activeLoai?: string | null;
  className?: string;
  variant?: "tiles" | "tabs";
}) {
  const hasHot = campaign.products?.some((p) => p.dealHot);
  const rawTiles = campaign.display.tiles
    .filter((t) => {
      if (hasHot) return true;
      const tab = tabOf(dealsHref(t.href));
      return (KIND_BY_ICON[t.icon] || (tab ? KIND_BY_TAB[tab] : undefined)) !== "hot" && tab !== "deal-hot";
    });

  // Tự động thay thế ô "Hỗ trợ ship" thành "Top Bán Chạy" (chuẩn sàn TMĐT, tránh trùng lặp)
  const tiles = rawTiles.map((t) => {
    if (t.label === "Hỗ trợ ship" || t.icon === "truck" || t.icon === "ship") {
      return {
        ...t,
        label: "Top Bán Chạy",
        icon: "trophy",
        href: "/uu-dai?tab=ban-chay",
      };
    }
    return t;
  }).slice(0, 8);

  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeTab]);

  if (!tiles.length) return null;

  return (
    <nav
      aria-label="Chuyển tab ưu đãi"
      className={`w-full ${className || ""}`}
      style={{ "--campaign-primary": campaign.display.colors.primary } as React.CSSProperties}
    >
      <div className="flex items-center justify-start sm:justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-2 py-1">
        <ul
          role="tablist"
          className="inline-flex max-w-full items-center gap-1.5 sm:gap-2.5 rounded-2xl sm:rounded-full bg-white p-1.5 sm:p-2 shadow-sm border border-rose-100/90 whitespace-nowrap"
        >
          {tiles.map((t) => {
            const tab = tabOf(dealsHref(t.href));
            const kind = KIND_BY_ICON[t.icon] || (tab ? KIND_BY_TAB[tab] : undefined) || "other";
            const tone = TONE[kind];
            const Icon = ICONS[t.icon] || Sparkles;

            const isTop = kind === "top" || tab === "ban-chay";
            const isShip = kind === "ship";
            const isVoucherTab = tab === "voucher" || kind === "voucher";
            const isActive = Boolean(
              activeTab &&
                (isTop
                  ? activeTab === "ban-chay"
                  : isShip
                    ? activeTab === "voucher" && activeLoai === "ship"
                    : isVoucherTab
                      ? activeTab === "voucher" && (!activeLoai || activeLoai === "all")
                      : tab === activeTab)
            );

            return (
              <li
                key={`${t.href}-${t.label}`}
                role="presentation"
                className="shrink-0"
                ref={isActive ? activeRef : undefined}
              >
                <Link
                  href={tileHref(t.href, kind)}
                  role="tab"
                  aria-selected={isActive}
                  className={`inline-flex min-h-[38px] sm:min-h-[44px] shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-full px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold transition-all duration-200 select-none whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] text-white shadow-sm shadow-rose-950/20 scale-[1.02]"
                      : "text-slate-800 hover:text-[var(--campaign-primary,#C8102E)] hover:bg-rose-50/70"
                  }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden
                    className={`shrink-0 ${isActive ? "text-white" : tone.icon}`}
                  />
                  <span className="whitespace-nowrap">{t.label}</span>
                  {isActive ? (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-white/20 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-black text-white uppercase tracking-wider">
                      ĐANG XEM
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
