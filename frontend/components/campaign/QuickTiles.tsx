"use client";

import Link from "next/link";
import {
  Flame,
  Gift,
  Percent,
  Sparkles,
  Star,
  Tag,
  TicketPercent,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CampaignUI, CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { dealsHref, toDealsTab } from "@/lib/campaign/dealsTabs";

type Kind = "voucher" | "flash" | "hot" | "gift" | "ship" | "other";

const KIND_BY_ICON: Record<string, Kind> = {
  ticket: "voucher",
  voucher: "voucher",
  flash: "flash",
  zap: "flash",
  flame: "hot",
  hot: "hot",
  gift: "gift",
  truck: "ship",
  ship: "ship",
};

const KIND_BY_TAB: Record<string, Kind> = {
  voucher: "voucher",
  "flash-sale": "flash",
  "deal-hot": "hot",
  "qua-tang": "gift",
};

const ICONS: Record<string, LucideIcon> = {
  ticket: TicketPercent,
  voucher: TicketPercent,
  flash: Zap,
  zap: Zap,
  gift: Gift,
  flame: Flame,
  hot: Flame,
  truck: Truck,
  ship: Truck,
  percent: Percent,
  star: Star,
  tag: Tag,
};

/** Màu ô icon theo loại (nền nhạt + icon đậm; Hỗ trợ ship nền xanh đậm). */
const TONE: Record<Kind, { box: string; icon: string; sub: string }> = {
  voucher: { box: "bg-[#E7F4EA]", icon: "text-[#1F7A3D]", sub: "text-slate-500" },
  flash: { box: "bg-[#FFE1E1]", icon: "text-[#D61F2C]", sub: "font-semibold text-[#D61F2C]" },
  hot: { box: "bg-[#FFEAD9]", icon: "text-[#E2620E]", sub: "text-slate-500" },
  gift: { box: "bg-[#FFF3E0]", icon: "text-[#C77700]", sub: "text-slate-500" },
  ship: { box: "bg-[#1F5132]", icon: "text-white", sub: "text-slate-500" },
  other: { box: "bg-slate-100", icon: "text-slate-700", sub: "text-slate-500" },
};

function tabOf(href: string) {
  if (!href.startsWith("/uu-dai")) return null;
  return toDealsTab(new URLSearchParams(href.split("?")[1]?.split("#")[0] || "").get("tab"));
}

function tileHref(href: string, kind: Kind): string {
  const to = dealsHref(href);
  if (kind !== "ship" || !to.startsWith("/uu-dai")) return to;
  const params = new URLSearchParams(to.split("?")[1] || "");
  if ((params.get("tab") || "voucher") !== "voucher") return to;
  params.set("tab", "voucher");
  params.set("loai", "ship");
  return `/uu-dai?${params.toString()}`;
}

/** Ô lối tắt dưới banner trang chủ: thẻ trắng, icon màu theo loại. */
export function QuickTiles({
  campaign,
  vouchers,
  offsetMs,
  activeTab,
  activeLoai,
  className,
  variant = "tiles",
}: {
  campaign: CampaignUI;
  vouchers: CampaignVoucherUI[];
  offsetMs: number;
  activeTab?: string | null;
  activeLoai?: string | null;
  className?: string;
  variant?: "tiles" | "tabs";
}) {
  const hasHot = campaign.products.some((p) => p.dealHot);
  // Ô "Deal hot" chỉ hiện khi chiến dịch có SP gắn deal hot (tránh dẫn tới trang trống).
  const tiles = campaign.display.tiles
    .filter((t) => {
      if (hasHot) return true;
      const tab = tabOf(dealsHref(t.href));
      return (KIND_BY_ICON[t.icon] || (tab ? KIND_BY_TAB[tab] : undefined)) !== "hot" && tab !== "deal-hot";
    })
    .slice(0, 8);
  if (!tiles.length) return null;

  // DẠNG THANH TAB MỎNG NGANG (CHUẨN SHOPEE/LAZADA PC)
  if (variant === "tabs") {
    return (
      <nav
        aria-label="Chuyển tab ưu đãi"
        className={`w-full ${className || ""}`}
        style={{ "--campaign-primary": campaign.display.colors.primary } as React.CSSProperties}
      >
        <div className="flex items-center justify-center">
          <ul
            role="tablist"
            className="inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-2xl bg-white/95 p-1.5 shadow-sm border border-rose-100/90 backdrop-blur-xs overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tiles.map((t) => {
              const tab = tabOf(dealsHref(t.href));
              const kind = KIND_BY_ICON[t.icon] || (tab ? KIND_BY_TAB[tab] : undefined) || "other";
              const tone = TONE[kind];
              const Icon = ICONS[t.icon] || Sparkles;

              const isShip = kind === "ship";
              const isVoucherTab = tab === "voucher" || kind === "voucher";
              const isActive = Boolean(
                activeTab &&
                  (isShip
                    ? activeTab === "voucher" && activeLoai === "ship"
                    : isVoucherTab
                      ? activeTab === "voucher" && (!activeLoai || activeLoai === "all")
                      : tab === activeTab)
              );

              return (
                <li key={`${t.href}-${t.label}`} role="presentation">
                  <Link
                    href={tileHref(t.href, kind)}
                    role="tab"
                    aria-selected={isActive}
                    className={`inline-flex min-h-[38px] sm:min-h-[42px] items-center gap-2 rounded-xl px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 select-none whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] text-white shadow-sm shadow-rose-950/20 scale-[1.02]"
                        : "text-slate-700 hover:text-[var(--campaign-primary,#C8102E)] hover:bg-rose-50/70"
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={2.2}
                      aria-hidden
                      className={isActive ? "text-white" : tone.icon}
                    />
                    <span>{t.label}</span>
                    {isActive ? (
                      <span className="hidden md:inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        Đang xem
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

  // DẠNG Ô VUÔNG LỐI TẮT TRUYỀN THỐNG (TRANG CHỦ)
  return (
    <nav
      aria-label="Lối tắt ưu đãi"
      className={`mx-auto max-w-7xl px-4 ${className || ""}`}
      style={{ "--campaign-primary": campaign.display.colors.primary } as React.CSSProperties}
    >
      <ul
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-3.5 pb-2.5 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pt-3 sm:pb-2 [&::-webkit-scrollbar]:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 5)}, minmax(0, 1fr))` }}
      >
        {tiles.map((t) => {
          const tab = tabOf(dealsHref(t.href));
          const kind = KIND_BY_ICON[t.icon] || (tab ? KIND_BY_TAB[tab] : undefined) || "other";
          const tone = TONE[kind];
          const Icon = ICONS[t.icon] || Sparkles;

          const isShip = kind === "ship";
          const isVoucherTab = tab === "voucher" || kind === "voucher";
          const isActive = Boolean(
            activeTab &&
              (isShip
                ? activeTab === "voucher" && activeLoai === "ship"
                : isVoucherTab
                  ? activeTab === "voucher" && (!activeLoai || activeLoai === "all")
                  : tab === activeTab)
          );

          return (
            <li key={`${t.href}-${t.label}`} className="w-[8rem] shrink-0 snap-start sm:w-auto">
              <Link
                href={tileHref(t.href, kind)}
                className={`relative flex h-full flex-col items-center gap-2 rounded-2xl bg-white px-3 py-3.5 text-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)] ${
                  isActive
                    ? "ring-2 ring-[var(--campaign-primary,#C8102E)] shadow-md z-10"
                    : "shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04] hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                {isActive ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-[var(--campaign-primary,#C8102E)] px-2 py-0.5 text-[9px] font-black uppercase text-white whitespace-nowrap z-20">
                    Đang xem
                  </span>
                ) : null}
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.box}`}>
                  <Icon size={20} strokeWidth={1.9} aria-hidden className={tone.icon} />
                </span>
                <span className={`line-clamp-2 text-[12px] leading-tight text-center ${isActive ? "font-black text-[var(--campaign-primary,#C8102E)]" : "font-semibold text-slate-700"}`}>
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
