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

/** Thứ tự L1 mega menu — Phụ kiện ngay sau Bình hoa. */
const MEGA_L1_ORDER = [
  "CÂY CẢNH ĐỦ LOẠI",
  "CHẬU TRỒNG CÂY",
  "BÌNH CẮM HOA",
  "PHỤ KIỆN TRANG TRÍ",
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
  "HẠT GIỐNG",
  "ĐĨA LÓT CHẬU",
  "DỤNG CỤ TRỒNG CÂY",
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM",
] as const;

/** Trong Phụ kiện: Tiểu cảnh lên đầu. */
const PHU_KIEN_L2_FIRST = ["PHỤ KIỆN TIỂU CẢNH"] as const;

function orderNodesByPreferredNames(
  nodes: ShopCategoryNavNode[],
  preferred: readonly string[]
): ShopCategoryNavNode[] {
  const used = new Set<number>();
  const ordered: ShopCategoryNavNode[] = [];
  for (const name of preferred) {
    const hit = nodes.find(
      (n) => !used.has(n.id) && nameMatchesAny(n.name, [name])
    );
    if (hit) {
      used.add(hit.id);
      ordered.push(hit);
    }
  }
  for (const n of nodes) {
    if (!used.has(n.id)) ordered.push(n);
  }
  return ordered;
}

function labelNode(name: string): string {
  return toTitleCaseVi(String(name || "").trim());
}

function foldName(name: string): string {
  return String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Ảnh tile mega menu — ưu tiên ảnh SP theo mã kho. */
const TILE_IMAGE_BY_MA: { match: RegExp; url: string }[] = [
  {
    match: /^SEN\s*DA\b|^SEN\s*BAU\b/,
    url: "https://cdn2-retail-images.kiotviet.vn/2026/05/06/alohanguyen/425912a964f342fd9748e1cdeb5fca97.jpg",
  },
  {
    match: /^XUONG\s*RONG\b/,
    url: "https://cdn2-retail-images.kiotviet.vn/2026/05/05/alohanguyen/cc48c124abeb423aa2eb4753757281b6.jpeg",
  },
  {
    match: /^CHAU\s*BONSAI\b|CHAU\s*BONSAI/,
    url: "https://cdn-images.kiotviet.vn/alohanguyen/85636eaaf54944daa810e6cd8b69d11e.png",
  },
  {
    match: /DIA\s*DAT\s*NUNG|LOT\s*CHAU/,
    url: "https://cdn2-retail-images.kiotviet.vn/alohanguyen/867b51f7219648f8aaff06b4575d3922.tmp",
  },
  {
    match: /HOP\s*TRONG\s*SUOT|HOP\s*TRONG/,
    url: "https://cdn2-retail-images.kiotviet.vn/2025/01/22/alohanguyen/81c3acb3184d49e59fb0a8eeca5353a6.jpg",
  },
];

function tileSrc(node: ShopCategoryNavNode): string {
  // L3 Cây phong thủy → ảnh minh họa cây (không dùng rule chậu BONSAI)
  if (isPhongThuyL3(node)) return navIllustrationSrc(node.name);
  const f = foldName(node.name);
  for (const row of TILE_IMAGE_BY_MA) {
    if (row.match.test(f)) return row.url;
  }
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
  const roots = useMemo(() => {
    const visible = tree.filter(
      (n) => !nameMatchesAny(n.name, ["KHÁC", "VẬT TƯ VÀ THIẾT BỊ", "QUÀ TẶNG CÂY"])
    );
    return orderNodesByPreferredNames(visible, MEGA_L1_ORDER);
  }, [tree]);
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

  const l2 = useMemo(() => {
    if (!active) return [];
    const kids = nodeSubs(active);
    if (nameMatchesAny(active.name, ["PHỤ KIỆN TRANG TRÍ"])) {
      return orderNodesByPreferredNames(kids, PHU_KIEN_L2_FIRST);
    }
    return kids;
  }, [active]);

  if (!roots.length) return null;

  return (
    <div
      ref={wrapRef}
      className="relative flex shrink-0 items-stretch"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-3 text-[15px] font-bold transition-colors xl:gap-2 xl:text-[16px] ${
          open
            ? "text-[var(--aloha-green)]"
            : "text-[var(--aloha-green-dark)] hover:text-[var(--aloha-green)]"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <Menu size={17} strokeWidth={2.25} aria-hidden />
        Danh mục sản phẩm
        <ChevronDown
          size={15}
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
            className={`flex overflow-hidden rounded-2xl border border-[var(--aloha-line)] bg-white shadow-[0_20px_50px_-18px_rgba(27,94,32,0.28)] ${
              l2.length ? "w-[min(96vw,58rem)]" : "w-[15rem]"
            }`}
            role="menu"
            aria-label="Danh mục sản phẩm"
          >
            {/* Cột 1 — L1 nền trắng */}
            <nav
              className={`w-[15rem] shrink-0 bg-white py-2.5 ${
                l2.length ? "border-r border-[var(--aloha-line)]" : ""
              }`}
              aria-label="Nhóm chính"
            >
              {roots.map((node) => {
                const selected = active?.id === node.id;
                const hasKids = nodeSubs(node).length > 0;
                const showProductCount = !hasKids && nameMatchesAny(node.name, [
                  "BÌNH CẮM HOA", "BÌNH HOA", "HẠT GIỐNG",
                ]);
                const productCount = Number.isFinite(node.count)
                  ? Math.max(0, Math.trunc(node.count))
                  : null;
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
                    ) : showProductCount && productCount !== null ? (
                      <span
                        title={`${productCount.toLocaleString("vi-VN")} sản phẩm`}
                        aria-label={`${productCount.toLocaleString("vi-VN")} sản phẩm`}
                        className={`inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-medium tabular-nums ${
                          selected
                            ? "bg-white/75 text-[var(--aloha-green-dark)]"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {productCount.toLocaleString("vi-VN")}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Cột 2 — chỉ khi L1 có nhóm con */}
            {l2.length ? (
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

                    <div className="max-h-[min(62vh,32rem)] space-y-6 overflow-y-auto overscroll-contain pr-1">
                      {l2.map((section) => {
                        const kids = nodeSubs(section);
                        const withImg = (
                          kids.length ? kids : tileSrc(section) ? [section] : []
                        )
                          .filter((n) => Boolean(tileSrc(n)))
                          .slice(0, L3_LIMIT);
                        // pl-8 ≈ icon + gap — thẳng hàng với chữ tiêu đề cột 2
                        if (!withImg.length && !kids.length) {
                          return (
                            <section key={section.id} className="pl-8">
                              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                                <span className="min-w-0 truncate text-[15px] font-extrabold leading-none text-[var(--aloha-green-dark)] sm:text-base">
                                  {labelNode(section.name)}
                                </span>
                                <Link
                                  href={categoryHref(section)}
                                  onClick={handleNavigate}
                                  className="shrink-0 text-[12px] font-semibold leading-none text-[var(--aloha-muted)] hover:text-[var(--aloha-green)]"
                                >
                                  Xem tất cả →
                                </Link>
                              </div>
                            </section>
                          );
                        }
                        if (!withImg.length) return null;
                        return (
                          <section key={section.id} className="pl-8">
                            <div className="mb-3 flex items-baseline justify-between gap-3">
                              <Link
                                href={categoryHref(section)}
                                onClick={handleNavigate}
                                className="min-w-0 truncate text-[15px] font-extrabold leading-none text-[var(--aloha-green-dark)] hover:text-[var(--aloha-green)] sm:text-base"
                              >
                                {labelNode(section.name)}
                              </Link>
                              <Link
                                href={categoryHref(section)}
                                onClick={handleNavigate}
                                className="shrink-0 text-[12px] font-semibold leading-none text-[var(--aloha-muted)] hover:text-[var(--aloha-green)]"
                              >
                                Xem tất cả →
                              </Link>
                            </div>
                            <div className="grid grid-cols-5 gap-x-2.5 gap-y-3 justify-items-start">
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
                </>
              ) : null}
            </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
