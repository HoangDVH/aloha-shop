"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Sprout } from "lucide-react";
import {
  categoryHref,
  fetchCategoryTreeCached,
  type ShopCategoryNavNode,
} from "@/lib/api";

/** Tên gợi ý theo mock — chỉ hiện nếu khớp node thật trong category-tree. */
const MOCK_WANTED = [
  "cây để bàn",
  "cây phong thủy",
  "cây văn phòng",
  "chậu",
  "ngoại thất",
  "sen đá",
  "xương rồng",
  "cây treo",
  "phụ kiện",
  "cây giống",
  "hạt giống",
];

function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function flatten(nodes: ShopCategoryNavNode[], out: ShopCategoryNavNode[] = []) {
  for (const n of nodes || []) {
    out.push(n);
    if (n.subs?.length) flatten(n.subs, out);
  }
  return out;
}

function matchWanted(nodes: ShopCategoryNavNode[]) {
  const all = flatten(nodes);
  const picked: ShopCategoryNavNode[] = [];
  const used = new Set<string>();

  for (const want of MOCK_WANTED) {
    const w = norm(want);
    const hit = all.find((n) => {
      const id = String(n.id || n.path || n.slug || n.name);
      if (used.has(id)) return false;
      const name = norm(n.name);
      return name.includes(w) || w.includes(name);
    });
    if (hit) {
      const id = String(hit.id || hit.path || hit.slug || hit.name);
      used.add(id);
      picked.push(hit);
    }
  }

  // Nếu khớp ít: bổ sung root L1 chưa lấy (giữ cái shop đang có trên tree)
  if (picked.length < 6) {
    for (const root of nodes) {
      const id = String(root.id || root.path || root.slug || root.name);
      if (used.has(id)) continue;
      used.add(id);
      picked.push(root);
      if (picked.length >= 9) break;
    }
  }

  return picked.slice(0, 9);
}

function zaloWholesale() {
  return "https://zalo.me/0794901233";
}

/** Lưới danh mục tròn — map category-tree thật; ô Báo giá sỉ. */
export function HomeCategoryCircles() {
  const [tree, setTree] = useState<ShopCategoryNavNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchCategoryTreeCached().then((items) => {
      if (!cancelled) setTree(items || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => matchWanted(tree), [tree]);
  if (!items.length) return null;

  return (
    <section className="bg-white py-7 sm:py-9">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-5 text-center text-base font-extrabold uppercase tracking-wide text-[var(--aloha-ink)] sm:mb-7 sm:text-lg">
          Danh mục nổi bật
        </h2>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 lg:grid-cols-5">
          {items.map((n) => {
            const src = String(n.image || "").trim();
            return (
              <li key={String(n.id || n.path || n.slug || n.name)} className="min-w-0">
                <Link
                  href={categoryHref(n)}
                  className="group flex flex-col items-center gap-2 text-center"
                >
                  <span className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full bg-[var(--aloha-green-light)] ring-2 ring-[var(--aloha-line)] transition group-hover:ring-[var(--aloha-green)] sm:h-[5.25rem] sm:w-[5.25rem]">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Sprout
                        size={28}
                        className="text-[var(--aloha-green)]"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold text-[var(--aloha-ink)] sm:text-sm">
                    {n.name}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <a
              href={zaloWholesale()}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2 text-center"
            >
              <span className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center gap-1 rounded-full bg-[var(--aloha-green)] text-white shadow-sm transition group-hover:bg-[var(--aloha-green-hover)] sm:h-[5.25rem] sm:w-[5.25rem]">
                <BadgePercent size={22} aria-hidden />
                <span className="text-[10px] font-bold leading-tight sm:text-[11px]">
                  Báo giá sỉ
                </span>
              </span>
              <span className="line-clamp-2 text-xs font-semibold text-[var(--aloha-ink)] sm:text-sm">
                Báo giá sỉ
              </span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
