"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import {
  fetchCategoryTree,
  type ShopCategoryNavNode,
} from "@/lib/api";
import { markPinCatalog } from "@/components/catalog/catalogLayoutUtils";

function foldKey(name: string): string {
  return String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toTitleCaseVi(name: string): string {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  return s
    .split(/(\s+|[-–—])/)
    .map((part) => {
      if (!part || /^[\s\-–—]+$/.test(part)) return part;
      if (/^ctp$/i.test(part)) return "CTP";
      const lower = part.toLocaleLowerCase("vi");
      return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1);
    })
    .join("");
}

function chipLabel(name: string): string {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  const f = foldKey(s);
  const hasPrice =
    /\d\s*K\b/.test(f) ||
    /\d\s*TR\b/.test(f) ||
    /\d+TR/.test(f) ||
    (/\d/.test(s) &&
      (f.includes("DUOI") ||
        f.includes("TREN") ||
        f.includes("DONG GIA") ||
        /SALE[- ]?\d/.test(f)));
  if (hasPrice && f.startsWith("CAY THANH PHAM")) {
    const rest = s.replace(/^CÂY\s+THÀNH\s+PHẨM\s*/i, "").trim();
    return toTitleCaseVi(rest ? `CTP ${rest}` : "CTP");
  }
  return toTitleCaseVi(s);
}

function findPathById(
  nodes: ShopCategoryNavNode[],
  id: number
): ShopCategoryNavNode[] | null {
  for (const n of nodes) {
    if (Number(n.id) === id) return [n];
    const hit = findPathById(n.subs || [], id);
    if (hit) return [n, ...hit];
  }
  return null;
}

function hrefForIds(
  slug: string,
  ids: number[],
  nhomPath: string | undefined,
  sp: URLSearchParams
): string {
  const next = new URLSearchParams(sp.toString());
  next.delete("categoryId");
  next.delete("nhom");
  next.delete("page");
  for (const id of ids) {
    if (id > 0) next.append("categoryId", String(id));
  }
  if (nhomPath) next.set("nhom", nhomPath);
  const qs = next.toString();
  return `/danh-muc/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
}

/** Hàng cuộn ngang + fade mép + chevron — gợi ý còn item như sàn TMĐT. */
function ScrollHintRow({
  children,
  className = "",
  nudgeKey,
}: {
  children: ReactNode;
  className?: string;
  nudgeKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const sl = el.scrollLeft;
    setCanLeft(sl > 4);
    setCanRight(max > 8 && sl < max - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update, children]);

  // Nudge nhẹ 1 lần / session — gợi ý kéo ngang
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max < 24) return;
    const storageKey = `aloha-scroll-nudge:${nudgeKey || "row"}`;
    try {
      if (sessionStorage.getItem(storageKey) === "1") return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    const t0 = window.setTimeout(() => {
      el.scrollTo({ left: Math.min(40, max), behavior: "smooth" });
    }, 400);
    const t1 = window.setTimeout(() => {
      el.scrollTo({ left: 0, behavior: "smooth" });
    }, 900);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [nudgeKey, children]);

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <div
        ref={ref}
        className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <span className="w-3 shrink-0" aria-hidden />
      </div>
      {canLeft ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent"
          aria-hidden
        />
      ) : null}
      {canRight ? (
        <>
          <span
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white via-white/90 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            aria-label="Xem thêm"
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              el.scrollBy({ left: Math.min(160, el.clientWidth * 0.55), behavior: "smooth" });
            }}
            className="absolute inset-y-0 right-0 z-[1] my-auto mr-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--aloha-line)] bg-white text-[#9CA3AF] shadow-sm transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
          >
            <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}

function OptionChip({
  node,
  active,
  href,
  onClick,
}: {
  node: ShopCategoryNavNode;
  active: boolean;
  href: string;
  onClick?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = String(node.image || "").trim();
  const showImg = Boolean(src) && !imgFailed;

  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        markPinCatalog();
        onClick?.();
      }}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border bg-white px-2.5 transition ${
        active
          ? "border-[var(--aloha-green)] ring-1 ring-[var(--aloha-green)]"
          : "border-[#e5e5e5] hover:border-[var(--aloha-green)]/40"
      }`}
      aria-current={active ? "true" : undefined}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-7 w-7 rounded-md object-contain"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <span
        className={`max-w-[7.5rem] truncate text-[12px] leading-tight sm:max-w-[9rem] ${
          active ? "font-bold text-[var(--aloha-green)]" : "font-semibold text-[#333]"
        }`}
      >
        {chipLabel(node.name)}
      </span>
    </Link>
  );
}

function SelectedChip({
  label,
  clearHref,
  onClick,
}: {
  label: string;
  clearHref: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={clearHref}
      scroll={false}
      onClick={() => {
        markPinCatalog();
        onClick?.();
      }}
      className="inline-flex h-9 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 text-[12px] font-semibold text-[#333] transition hover:bg-[#e6e6e6]"
      title={`Xóa ${label}`}
    >
      <span className="truncate">{label}</span>
      <X size={14} className="shrink-0 text-[#888]" aria-hidden />
    </Link>
  );
}

type PickerProps = {
  categoryIds: number[];
  onNavigate?: () => void;
  inFilterSheet?: boolean;
  /** Nút Lọc — chỉ dùng layout toolbar */
  filterButton?: ReactNode;
};

/** Chọn L2/L3 — toolbar (cạnh Lọc) hoặc trong sheet Lọc. */
export function CatalogSubcatPicker({
  categoryIds,
  onNavigate,
  inFilterSheet = false,
  filterButton,
}: PickerProps) {
  const sp = useSearchParams();
  const [tree, setTree] = useState<ShopCategoryNavNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchCategoryTree()
      .then((res) => {
        if (!cancelled) setTree(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setTree([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onChipClick = () => {
    onNavigate?.();
  };

  const ctx = useMemo(() => {
    if (!tree.length || !categoryIds.length) return null;

    const paths = categoryIds
      .map((id) => ({ id, path: findPathById(tree, id) }))
      .filter((x): x is { id: number; path: ShopCategoryNavNode[] } => Boolean(x.path?.length));

    if (!paths.length) return null;

    const l1 = paths[0].path[0];
    const allL2 = l1.subs || [];
    if (!allL2.length) return null;

    if (paths.every((p) => p.path.length === 1)) {
      return {
        l1,
        allL2,
        selectedL2: null as ShopCategoryNavNode | null,
        selectedL3s: [] as ShopCategoryNavNode[],
        allL3: [] as ShopCategoryNavNode[],
      };
    }

    let selectedL2: ShopCategoryNavNode | null = null;
    for (const p of paths) {
      if (p.path.length >= 2) {
        selectedL2 = p.path[1];
        break;
      }
    }
    if (!selectedL2) {
      return { l1, allL2, selectedL2: null, selectedL3s: [], allL3: [] };
    }

    const allL3 = selectedL2.subs || [];
    const selectedL3s = paths
      .filter((p) => p.path.length >= 3 && p.path[1]?.id === selectedL2!.id)
      .map((p) => p.path[p.path.length - 1])
      .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i);

    return { l1, allL2, selectedL2, selectedL3s, allL3 };
  }, [tree, categoryIds]);

  if (!ctx) {
    if (filterButton) {
      return <div className="flex min-w-0 items-center gap-2">{filterButton}</div>;
    }
    return null;
  }

  const { l1, allL2, selectedL2, selectedL3s, allL3 } = ctx;
  const l2Selected = Boolean(selectedL2);
  const selectedL3Ids = new Set(selectedL3s.map((n) => n.id));
  const prefix = inFilterSheet ? "sheet" : "bar";

  const clearAllHref = hrefForIds(l1.slug, [l1.id], l1.path, sp);
  const clearOneL3Href = (l3Id: number) => {
    if (!selectedL2) return clearAllHref;
    const next = selectedL3s.filter((n) => n.id !== l3Id).map((n) => n.id);
    if (!next.length) {
      return hrefForIds(selectedL2.slug, [selectedL2.id], selectedL2.path, sp);
    }
    return hrefForIds(selectedL2.slug, next, selectedL2.path, sp);
  };

  const toggleL3Href = (l3: ShopCategoryNavNode) => {
    if (!selectedL2) return "#";
    let next: number[];
    if (selectedL3Ids.has(l3.id)) {
      next = selectedL3s.filter((n) => n.id !== l3.id).map((n) => n.id);
    } else {
      next = [...selectedL3s.map((n) => n.id), l3.id];
    }
    if (!next.length) {
      return hrefForIds(selectedL2.slug, [selectedL2.id], selectedL2.path, sp);
    }
    return hrefForIds(selectedL2.slug, next, selectedL2.path, sp);
  };

  const selectL2Href = (l2: ShopCategoryNavNode) =>
    hrefForIds(l2.slug, [l2.id], l2.path, sp);

  const chipsRow = !l2Selected ? (
    allL2.map((n) => (
      <OptionChip
        key={n.id}
        node={n}
        active={false}
        href={selectL2Href(n)}
        onClick={onChipClick}
      />
    ))
  ) : (
    <>
      {selectedL2 ? (
        <SelectedChip
          label={chipLabel(selectedL2.name)}
          clearHref={clearAllHref}
          onClick={onChipClick}
        />
      ) : null}
      {selectedL3s.map((n) => (
        <SelectedChip
          key={n.id}
          label={chipLabel(n.name)}
          clearHref={clearOneL3Href(n.id)}
          onClick={onChipClick}
        />
      ))}
      {selectedL2 || selectedL3s.length ? (
        <Link
          href={clearAllHref}
          scroll={false}
          onClick={() => {
            markPinCatalog();
            onChipClick();
          }}
          className="inline-flex h-9 shrink-0 items-center px-1 text-[12px] font-semibold text-[var(--aloha-green)] underline-offset-2 hover:underline"
        >
          Xóa tất cả
        </Link>
      ) : null}
    </>
  );

  const l3Row =
    l2Selected && allL3.length ? (
      <ScrollHintRow className="bg-white" nudgeKey={`${prefix}-l3-${selectedL2?.id}`}>
        {allL3.map((n) => (
          <OptionChip
            key={n.id}
            node={n}
            active={selectedL3Ids.has(n.id)}
            href={toggleL3Href(n)}
            onClick={onChipClick}
          />
        ))}
      </ScrollHintRow>
    ) : null;

  /* —— Trong sheet Lọc (giống hàng ngoài: kết quả L2 + L3 dưới) —— */
  if (inFilterSheet) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--aloha-line)] bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[var(--aloha-ink)]">Danh mục</h3>
          <span className="truncate text-[11px] font-semibold text-slate-500">
            {chipLabel(l1.name)}
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {l2Selected ? "Đã chọn" : "Chọn nhóm (L2)"}
          </p>
          <ScrollHintRow nudgeKey={`${prefix}-chips-${l2Selected ? selectedL2?.id : l1.id}`}>
            {chipsRow}
          </ScrollHintRow>
        </div>

        {l3Row ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Nhóm con (L3)
            </p>
            {l3Row}
          </div>
        ) : null}
      </div>
    );
  }

  /* —— Toolbar cạnh nút Lọc —— */
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 rounded-md bg-white">
        {filterButton}
        <ScrollHintRow nudgeKey={`${prefix}-chips-${l2Selected ? selectedL2?.id : l1.id}`}>
          {chipsRow}
        </ScrollHintRow>
      </div>
      {l3Row}
    </div>
  );
}

type BarProps = {
  categoryIds: number[];
  filterButton: ReactNode;
};

export function CatalogSubcatBar({ categoryIds, filterButton }: BarProps) {
  return <CatalogSubcatPicker categoryIds={categoryIds} filterButton={filterButton} />;
}
