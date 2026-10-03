"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { DealsTabId } from "@/lib/campaign/dealsTabs";

export type DealsTab = { id: DealsTabId; label: string; count?: number };

export const dealsTabDomId = (id: DealsTabId) => `deals-tab-${id}`;
export const dealsPanelDomId = (id: DealsTabId) => `deals-panel-${id}`;

/** Thanh tab dính đầu trang /uu-dai; mỗi tab là một link `?tab=` (chia sẻ / mở tab mới được). */
export function DealsTabs({
  tabs,
  active,
  hrefFor,
  onNavigate,
}: {
  tabs: DealsTab[];
  active: DealsTabId;
  hrefFor: (id: DealsTabId) => string;
  onNavigate: (id: DealsTabId) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const el = document.getElementById(dealsTabDomId(active));
    if (!list || !el) return;
    const left = el.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft) list.scrollLeft = left - 12;
    else if (left + el.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left + el.offsetWidth - list.clientWidth + 12;
    }
  }, [active]);

  const onClick = (e: MouseEvent<HTMLAnchorElement>, id: DealsTabId) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onNavigate(tabs[next].id);
    document.getElementById(dealsTabDomId(tabs[next].id))?.focus();
  };

  return (
    <nav aria-label="Mục ưu đãi" className="sticky top-[var(--shop-chrome-h,64px)] z-20 -mx-3 bg-white/95 border-b border-black/5 px-3 py-2 backdrop-blur sm:mx-0 sm:border-none sm:bg-transparent">
      <ul ref={listRef} role="tablist" onKeyDown={onKeyDown} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} role="presentation" className="shrink-0">
              <Link
                id={dealsTabDomId(t.id)}
                href={hrefFor(t.id)}
                replace
                scroll={false}
                role="tab"
                aria-selected={on}
                aria-controls={dealsPanelDomId(t.id)}
                tabIndex={on ? 0 : -1}
                onClick={(e) => onClick(e, t.id)}
                className={`inline-flex min-h-[38px] items-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E] ${
                  on ? "bg-[#C8102E] text-white font-bold" : "bg-white text-slate-600 ring-1 ring-black/8 hover:bg-red-50 hover:text-slate-900"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
