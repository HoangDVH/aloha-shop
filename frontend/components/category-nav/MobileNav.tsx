"use client";
import { GiftCategoryLinks } from "../GiftCategoryLinks";
import { Gift } from "lucide-react";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { categoryHref, type ShopCategoryNavNode } from "@/lib/api";
import { isPhongThuyL3, navIllustrationSrc } from "@/lib/navIllustrations";
import {
  MOBILE_CAT_ACTIVE_KEY,
  mobileCatLabel,
  navBarIcon,
  navBarLabel,
  nodeSubs,
  orderL2Nodes,
} from "./navLabels";
import { orderMobileRoots } from "./navSlots";

export function mobileTileSrc(node: ShopCategoryNavNode): string {
  if (isPhongThuyL3(node)) return navIllustrationSrc(node.name);
  return String(node.image || "").trim();
}

export function mobileTileHasImage(node: ShopCategoryNavNode): boolean {
  return Boolean(mobileTileSrc(node));
}

export function MobileCatTile({
  node,
  onNavigate,
}: {
  node: ShopCategoryNavNode;
  onNavigate?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = mobileTileSrc(node);
  if (!src || imgFailed) return null;

  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      className="flex flex-col items-center gap-1.5 text-center"
    >
      {/* Ảnh nhỏ — bo góc nhẹ như TGDĐ */}
      <span className="flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full rounded-md object-contain"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </span>
      <span className="line-clamp-2 min-h-[2.5em] w-full px-0.5 text-[11px] font-normal leading-[1.25] text-[#333]">
        {mobileCatLabel(node.name)}
      </span>
    </Link>
  );
}

/** Mobile — rail 9 mẹ trái + lưới ảnh/chữ phải (kiểu TGDĐ). */
export function CategoryMobileNav({
  tree,
  onNavigate,
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
}) {
  const roots = useMemo(() => orderMobileRoots(tree), [tree]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roots.length) return;
    let saved: number | null = null;
    try {
      const raw = sessionStorage.getItem(MOBILE_CAT_ACTIVE_KEY);
      const n = Number(raw);
      if (Number.isFinite(n) && (n === -1 || roots.some((r) => r.id === n))) saved = n;
    } catch {
      /* ignore */
    }
    setActiveId(saved ?? roots[0].id);
  }, [roots]);

  useEffect(() => {
    if (activeId == null) return;
    try {
      sessionStorage.setItem(MOBILE_CAT_ACTIVE_KEY, String(activeId));
    } catch {
      /* ignore */
    }
    rightRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  const active = roots.find((r) => r.id === activeId) || roots[0] || null;
  const giftActive = activeId === -1;
  if (!roots.length || !active) return null;

  const l2 = orderL2Nodes(active.name, nodeSubs(active));
  const leafOnly = l2
    .filter((n) => !nodeSubs(n).length)
    .filter(mobileTileHasImage)
    .slice(0, 9);
  const withKids = l2
    .map((section) => ({
      section,
      kids: nodeSubs(section).filter(mobileTileHasImage).slice(0, 9),
    }))
    .filter((x) => x.kids.length > 0);
  const rootLeafTile = !l2.length && mobileTileHasImage(active);
  const hasGrid =
    withKids.length > 0 || leafOnly.length > 0 || rootLeafTile;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-[#F3F4F6]">
      {/* Rail trái — ~28%, xám / trắng khi chọn (TGDĐ) */}
      <nav
        className="w-[28%] max-w-[6.75rem] shrink-0 overflow-y-auto overscroll-contain pb-4"
        aria-label="Nhóm hàng"
      >
        {roots.map((node) => {
          const selected = !giftActive && node.id === active.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveId(node.id)}
              className={`relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-1 py-2.5 text-center transition-colors ${
                selected
                  ? "bg-white text-[#222]"
                  : "bg-transparent text-[#666]"
              }`}
              aria-current={selected ? "true" : undefined}
            >
              {selected ? (
                <span
                  className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--aloha-green)]"
                  aria-hidden
                />
              ) : null}
              <span className={selected ? "text-[var(--aloha-green)]" : "text-[#888]"}>
                {navBarIcon(node.name)}
              </span>
              <span
                className={`line-clamp-2 px-0.5 text-[11px] leading-tight ${
                  selected ? "font-bold" : "font-medium"
                }`}
              >
                {navBarLabel(node.name)}
              </span>
            </button>
          );
        })}
        <button type="button" onClick={() => setActiveId(-1)} aria-expanded={giftActive} className={`flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-1 py-2.5 text-center ${giftActive ? "bg-white font-bold text-[var(--aloha-green)]" : "text-[#666]"}`}>
          <Gift size={18} /><span className="text-[11px]">Quà tặng</span>
        </button>
      </nav>

      {/* Cột phải */}
      <div
        ref={rightRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        {giftActive ? <GiftCategoryLinks onNavigate={onNavigate} /> : <>
        {withKids.map(({ section, kids }) => {
          return (
            <section key={section.id} className="mb-6">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="min-w-0 truncate text-[16px] font-extrabold text-[#222]">
                  {mobileCatLabel(section.name)}
                </h3>
                <Link
                  href={categoryHref(section)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-x-1 gap-y-5">
                {kids.map((leaf) => (
                  <MobileCatTile
                    key={leaf.id}
                    node={leaf}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {leafOnly.length ? (
          <section className="mb-6">
            {withKids.length ? (
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-bold text-[#222]">Khác</h3>
                <Link
                  href={categoryHref(active)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
            ) : (
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="min-w-0 truncate text-[15px] font-bold text-[#222]">
                  {mobileCatLabel(active.name)}
                </h3>
                <Link
                  href={categoryHref(active)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-1 gap-y-5">
              {leafOnly.map((leaf) => (
                <MobileCatTile
                  key={leaf.id}
                  node={leaf}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Nhóm mẹ lá (Bình hoa, Hạt giống): 1 ảnh kho + xem tất cả */}
        {rootLeafTile ? (
          <section className="mb-6">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="min-w-0 truncate text-[15px] font-bold text-[#222]">
                {mobileCatLabel(active.name)}
              </h3>
              <Link
                href={categoryHref(active)}
                onClick={onNavigate}
                className="shrink-0 text-[12px] font-normal text-[#999]"
              >
                Xem tất cả &gt;
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-x-1 gap-y-5">
              <MobileCatTile node={active} onNavigate={onNavigate} />
            </div>
          </section>
        ) : null}

        {!hasGrid ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-[#888]">Chưa có danh mục con để hiển thị.</p>
            <Link
              href={categoryHref(active)}
              onClick={onNavigate}
              className="text-sm font-semibold text-[var(--aloha-green)]"
            >
              Xem tất cả sản phẩm &gt;
            </Link>
          </div>
        ) : null}
        </>}
      </div>
    </div>
  );
}
