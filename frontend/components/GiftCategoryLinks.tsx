"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Gift,
  Heart,
  House,
  Sprout,
  Trophy,
  Sparkles,
  Star,
  Smile,
  Cake,
  Sun,
  Flower2,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_GIFT_NAV_CONFIG } from "@/lib/giftFilters";
import { usePublicGiftNav } from "@/lib/publicContentQueries";

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  House,
  Home: House,
  Trophy,
  Sprout,
  Gift,
  BriefcaseBusiness,
  Briefcase: BriefcaseBusiness,
  Sparkles,
  Star,
  Smile,
  Cake,
  Sun,
  Flower2,
};

function getIcon(name?: string): LucideIcon {
  if (!name) return Gift;
  return ICON_MAP[name] || Gift;
}

const COLOR_MAP: Record<string, string> = {
  rose: "bg-rose-50 text-rose-600",
  orange: "bg-orange-50 text-orange-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  pink: "bg-pink-50 text-pink-600",
  teal: "bg-teal-50 text-teal-600",
};

function getColor(c?: string): string {
  if (!c) return "bg-emerald-50 text-emerald-600";
  if (c.includes(" ")) return c;
  return COLOR_MAP[c] || "bg-emerald-50 text-emerald-600";
}

export function GiftCategoryLinks({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { data: config } = usePublicGiftNav();
  const nav = config || DEFAULT_GIFT_NAV_CONFIG;
  const categories = (nav.categories || []).filter(c => c.enabled !== false);

  if (mobile) {
    return (
      <div className="space-y-2.5 px-1.5 py-2">
        <div className="px-1 pt-1 pb-0.5">
          <h3 className="text-sm font-bold text-[var(--aloha-green)]">
            {nav.headerTitle || "Chọn quà, gửi yêu thương"}
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {nav.headerSubtitle || "Bạn muốn tặng ai, nhân dịp nào?"}
          </p>
        </div>

        <div className="space-y-2">
          {categories.map(option => (
            <Link
              key={option.id || option.href}
              href={option.href}
              onClick={onNavigate}
              className="group flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3 transition hover:border-[var(--aloha-green)] hover:bg-emerald-50/40 active:bg-emerald-50/70"
            >
              <div>
                <span className="block text-sm font-semibold text-stone-800 group-hover:text-[var(--aloha-green)]">
                  {option.label}
                </span>
                {option.hint && (
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {option.hint}
                  </span>
                )}
              </div>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--aloha-green)]" />
            </Link>
          ))}
        </div>

        {nav.b2bEnabled !== false && (
          <Link
            href={nav.b2bHref || "/qua-tang/doanh-nghiep"}
            onClick={onNavigate}
            className="group flex items-center justify-between rounded-xl bg-[var(--aloha-green-light,#eef7ed)] p-3 text-[var(--aloha-green)] transition hover:bg-emerald-100 active:bg-emerald-100"
          >
            <div>
              <span className="block text-sm font-bold">{nav.b2bTitle || "Quà tặng doanh nghiệp"}</span>
              <span className="mt-0.5 block text-xs text-stone-600">
                {nav.b2bSubtitle || "Tư vấn quà tặng cho đối tác, khách hàng & đội ngũ"}
              </span>
            </div>
            <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--aloha-green)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-3 sm:py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--aloha-green)]">
          <Gift size={22} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-bold text-[var(--aloha-green)] sm:text-lg">
            {nav.headerTitle || "Chọn quà, gửi yêu thương"}
          </h3>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            {nav.headerSubtitle || "Bạn muốn tặng ai, nhân dịp nào?"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {categories.map(option => {
          const Icon = getIcon(option.icon);
          const colorClass = getColor(option.color);
          return (
            <Link
              key={option.id || option.href}
              href={option.href}
              onClick={onNavigate}
              className="group flex min-h-24 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-[var(--aloha-green)] hover:bg-emerald-50/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-800 group-hover:text-[var(--aloha-green)]">
                  {option.label}
                </span>
                {option.hint && (
                  <span className="mt-1 block text-xs leading-relaxed text-stone-500">
                    {option.hint}
                  </span>
                )}
              </div>
              <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-stone-400 group-hover:text-[var(--aloha-green)]" />
            </Link>
          );
        })}
      </div>
      {nav.b2bEnabled !== false && (
        <Link
          href={nav.b2bHref || "/qua-tang/doanh-nghiep"}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl bg-[var(--aloha-green-light,#eef7ed)] p-4 text-[var(--aloha-green)] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
        >
          <BriefcaseBusiness size={22} aria-hidden="true" className="shrink-0" />
          <div className="flex-1">
            <span className="block text-sm font-bold">{nav.b2bTitle || "Quà tặng doanh nghiệp"}</span>
            <span className="mt-1 block text-xs text-stone-600">
              {nav.b2bSubtitle || "Tư vấn quà tặng cho đối tác, khách hàng & đội ngũ"}
            </span>
          </div>
          <ArrowRight size={18} aria-hidden="true" className="shrink-0" />
        </Link>
      )}
    </div>
  );
}
