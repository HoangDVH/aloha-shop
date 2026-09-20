"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Menu, ChevronDown } from "lucide-react";
import { categoryHref, type ShopCategoryNavNode } from "@/lib/api";
import { isPhongThuyL3, navIllustrationSrc } from "@/lib/navIllustrations";
import {
  nameMatchesAny,
  navBarIcon,
  navBarLabel,
  toTitleCaseVi,
} from "@/components/CategoryNavMenu";

/** 5 cột × 3 hàng */
const L3_COLS = 5;
const L3_ROWS = 3;
const L3_LIMIT = L3_COLS * L3_ROWS;

function nodeSubs(node: ShopCategoryNavNode): ShopCategoryNavNode[] {
  return node.subs || [];
}

function labelNode(name: string): string {
  return toTitleCaseVi(String(name || "").trim());
}

function tileSrc(node: ShopCategoryNavNode): string {
  if (isPhongThuyL3(node)) return navIllustrationSrc(node.name);
  return String(node.image || "").trim();
}

function MegaL3Tile({
  node,
  onNavigate,
}: {
  node: ShopCategoryNavNode;
  onNavigate?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = tileSrc(node);
  if (!src || imgFailed) return null;

  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
      title={node.name}
    >
      <span className="flex aspect-square w-full max-w-[4.75rem] items-center justify-center overflow-hidden rounded-xl bg-[#f6f8f4] ring-1 ring-[var(--aloha-line)] shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-[var(--aloha-green)]/45 group-hover:shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-[88%] max-w-[88%] object-contain transition duration-200 group-hover:scale-[1.05]"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </span>
      <span className="line-clamp-2 min-h-[2.3em] w-full px-0.5 text-[11px] font-semibold leading-snug text-[var(--aloha-ink)] transition group-hover:text-[var(--aloha-green)]">
        {labelNode(node.name)}
      </span>
    </Link>
  );
}

/** Mega menu desktop — 2 cột: L1 trắng | L2 + L3 ảnh (5×3). */
export function CategoryMegaMenu({
  tree,
  onNavigate,
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
}) {
  const roots = useMemo(
    () =>
      tree.filter(
        (n) => !nameMatchesAny(n.name, ["KHÁC", "VẬT TƯ VÀ THIẾT BỊ", "QUÀ TẶNG CÂY"])
      ),
    [tree]
  );
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = roots.find((r) => r.id === activeId) || roots[0] || null;

  useEffect(() => {
    if (!open) return;
    if (activeId == null && roots[0]) setActiveId(roots[0].id);
  }, [open, activeId, roots]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const openMenu = () => {
    clearClose();
    setOpen(true);
    if (activeId == null && roots[0]) setActiveId(roots[0].id);
  };

  const handleNavigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  if (!roots.length) return null;

  const l2 = active ? nodeSubs(active) : [];

  return (
    <div
      ref={wrapRef}
      className="relative flex shrink-0 items-stretch"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-2 px-2 py-3 text-[15px] font-bold transition-colors xl:text-base ${
          open
            ? "text-[var(--aloha-green)]"
            : "text-[var(--aloha-green-dark)] hover:text-[var(--aloha-green)]"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <Menu size={18} strokeWidth={2.25} aria-hidden />
        Danh mục sản phẩm
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          className={`opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[80] pt-1.5"
          onMouseEnter={clearClose}
        >
          <div
            className="flex w-[min(96vw,58rem)] overflow-hidden rounded-2xl border border-[var(--aloha-line)] bg-white shadow-[0_20px_50px_-18px_rgba(27,94,32,0.28)]"
            role="menu"
            aria-label="Danh mục sản phẩm"
          >
            {/* Cột 1 — L1 nền trắng */}
            <nav
              className="w-[15rem] shrink-0 border-r border-[var(--aloha-line)] bg-white py-2.5"
              aria-label="Nhóm chính"
            >
              {roots.map((node) => {
                const selected = active?.id === node.id;
                const hasKids = nodeSubs(node).length > 0;
                return (
                  <Link
                    key={node.id}
                    href={categoryHref(node)}
                    onClick={handleNavigate}
                    onMouseEnter={() => setActiveId(node.id)}
                    className={`mx-2.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      selected
                        ? "bg-[var(--aloha-green-light)] font-bold text-[var(--aloha-green-dark)]"
                        : "font-semibold text-[var(--aloha-ink)] hover:bg-[#f7f7f5]"
                    }`}
                  >
                    <span
                      className={`shrink-0 ${
                        selected
                          ? "text-[var(--aloha-green)]"
                          : "text-[var(--aloha-muted)]"
                      }`}
                    >
                      {navBarIcon(node.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {navBarLabel(node.name)}
                    </span>
                    {hasKids ? (
                      <ChevronRight
                        size={14}
                        className={
                          selected
                            ? "text-[var(--aloha-green)]"
                            : "text-[var(--aloha-muted)]/70"
                        }
                        aria-hidden
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Cột 2 — L2 + L3 ảnh 4×3 */}
            <div className="min-h-[22rem] min-w-0 flex-1 bg-white px-6 py-5">
              {active ? (
                <>
                  <div className="mb-5 flex items-start gap-3 border-b border-[var(--aloha-line)] pb-3.5">
                    <span className="mt-0.5 text-[var(--aloha-green)]">
                      {navBarIcon(active.name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={categoryHref(active)}
                        onClick={handleNavigate}
                        className="text-base font-bold text-[var(--aloha-green-dark)] hover:underline"
                      >
                        {navBarLabel(active.name)}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--aloha-muted)]">
                        Đa dạng chủng loại, phù hợp mọi không gian
                      </p>
                    </div>
                  </div>

                  {l2.length ? (
                    <div className="max-h-[min(62vh,32rem)] space-y-6 overflow-y-auto overscroll-contain pr-1">
                      {l2.map((section) => {
                        const kids = nodeSubs(section);
                        const withImg = (
                          kids.length ? kids : tileSrc(section) ? [section] : []
                        )
                          .filter((n) => Boolean(tileSrc(n)))
                          .slice(0, L3_LIMIT);
                        if (!withImg.length && !kids.length) {
                          return (
                            <section key={section.id}>
                              <div className="mb-2.5 flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-[15px] font-extrabold text-[var(--aloha-green-dark)] sm:text-base">
                                  {labelNode(section.name)}
                                </span>
                                <Link
                                  href={categoryHref(section)}
                                  onClick={handleNavigate}
                                  className="shrink-0 text-[12px] font-semibold text-[var(--aloha-muted)] hover:text-[var(--aloha-green)]"
                                >
                                  Xem tất cả →
                                </Link>
                              </div>
                            </section>
                          );
                        }
                        if (!withImg.length) return null;
                        return (
                          <section key={section.id}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <Link
                                href={categoryHref(section)}
                                onClick={handleNavigate}
                                className="min-w-0 truncate text-[15px] font-extrabold text-[var(--aloha-green-dark)] hover:text-[var(--aloha-green)] sm:text-base"
                              >
                                {labelNode(section.name)}
                              </Link>
                              <Link
                                href={categoryHref(section)}
                                onClick={handleNavigate}
                                className="shrink-0 text-[12px] font-semibold text-[var(--aloha-muted)] hover:text-[var(--aloha-green)]"
                              >
                                Xem tất cả →
                              </Link>
                            </div>
                            <div className="grid grid-cols-5 gap-x-2.5 gap-y-3 justify-items-center">
                              {withImg.map((leaf) => (
                                <MegaL3Tile
                                  key={leaf.id}
                                  node={leaf}
                                  onNavigate={handleNavigate}
                                />
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-3 py-6">
                      <p className="text-sm text-[var(--aloha-muted)]">
                        Nhóm này chưa có danh mục con.
                      </p>
                      <Link
                        href={categoryHref(active)}
                        onClick={handleNavigate}
                        className="inline-flex items-center rounded-full bg-[var(--aloha-green-dark)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--aloha-green)]"
                      >
                        Xem tất cả →
                      </Link>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
