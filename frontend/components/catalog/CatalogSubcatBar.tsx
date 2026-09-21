"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
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

function findPathBySlug(
  nodes: ShopCategoryNavNode[],
  slug: string
): ShopCategoryNavNode[] | null {
  const want = String(slug || "").trim().toLowerCase();
  if (!want) return null;
  for (const n of nodes) {
    if (String(n.slug || "").toLowerCase() === want) return [n];
    const hit = findPathBySlug(n.subs || [], want);
    if (hit) return [n, ...hit];
  }
  return null;
}

function danhMucHref(
  slug: string,
  ids: number[],
  sp: URLSearchParams,
  opts?: { keepFilters?: boolean }
): string {
  const next = opts?.keepFilters
    ? new URLSearchParams(sp.toString())
    : new URLSearchParams();
  if (opts?.keepFilters) {
    next.delete("categoryId");
    next.delete("nhom");
    next.delete("page");
  }
  // Chỉ gắn categoryId khi multi-select L3 (nhiều id) — URL L1/L2 giữ sạch theo slug.
  if (ids.length > 1) {
    for (const id of ids) {
      if (id > 0) next.append("categoryId", String(id));
    }
  } else if (ids.length === 1 && ids[0] > 0) {
    // Một id: slug đã đủ; không cần query (SEO + khớp canonical).
  }
  const qs = next.toString();
  return `/danh-muc/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
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
  const label = chipLabel(node.name);

  return (
    <Link
      href={href}
      scroll={false}
      title={label}
      onClick={() => {
        markPinCatalog();
        onClick?.();
      }}
      className={`inline-flex h-10 max-w-full shrink-0 items-center gap-1.5 rounded-md border bg-white px-2.5 transition ${
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
          className="h-7 w-7 shrink-0 rounded-md object-contain"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <span
        className={`whitespace-nowrap text-[12px] leading-none ${
          active ? "font-bold text-[var(--aloha-green)]" : "font-semibold text-[#333]"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

/** Hàng chip — hết chỗ thì xuống dòng (ô chip), chữ trong ô vẫn 1 dòng. */
function WrapChipRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 ${className}`}>
      {children}
    </div>
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
  /** Nút Lọc — layout toolbar */
  filterButton?: ReactNode;
  /** Trang /tim: hiện L1 cạnh nút Lọc */
  showRootL1?: boolean;
  /** Chip lọc phụ (giá, ĐVT…) — cùng hàng nút Lọc */
  filterResultChips?: ReactNode;
};

/**
 * UX kiểu Thế Giới Di Động:
 * - Chưa chọn: [Lọc] + chip L1 (hoặc L2 nếu đã vào danh mục L1)
 * - Sau khi chọn: hàng Lọc chỉ còn chip kết quả (✕); hàng dưới hiện cấp con
 */
export function CatalogSubcatPicker({
  categoryIds,
  onNavigate,
  inFilterSheet = false,
  filterButton,
  showRootL1 = false,
  filterResultChips,
}: PickerProps) {
  const sp = useSearchParams();
  const pathname = usePathname();
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

  const pathFromUrl = useMemo(() => {
    if (!tree.length) return null as ShopCategoryNavNode[] | null;

    if (categoryIds.length) {
      const paths = categoryIds
        .map((id) => findPathById(tree, id))
        .filter((p): p is ShopCategoryNavNode[] => Boolean(p?.length));
      if (paths.length) {
        // Ưu tiên path sâu nhất
        paths.sort((a, b) => b.length - a.length);
        const deepest = paths[0];
        // Multi L3 cùng L2
        if (paths.every((p) => p.length >= 3 && p[1]?.id === deepest[1]?.id)) {
          return deepest;
        }
        return deepest;
      }
    }

    const m = pathname.match(/^\/danh-muc\/([^/?#]+)/);
    if (m) {
      try {
        return findPathBySlug(tree, decodeURIComponent(m[1]));
      } catch {
        return findPathBySlug(tree, m[1]);
      }
    }
    return null;
  }, [tree, categoryIds, pathname]);

  const selectedL3s = useMemo(() => {
    if (!tree.length || !pathFromUrl || pathFromUrl.length < 2) {
      return [] as ShopCategoryNavNode[];
    }
    const l2Id = pathFromUrl[1]?.id;
    if (categoryIds.length >= 1) {
      const fromIds = categoryIds
        .map((id) => findPathById(tree, id))
        .filter(
          (p): p is ShopCategoryNavNode[] =>
            Boolean(p && p.length >= 3 && p[1]?.id === l2Id)
        )
        .map((p) => p[p.length - 1])
        .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i);
      if (fromIds.length) return fromIds;
    }
    if (pathFromUrl.length >= 3) {
      return [pathFromUrl[pathFromUrl.length - 1]];
    }
    return [];
  }, [tree, categoryIds, pathFromUrl]);

  const roots = tree;
  const l1 = pathFromUrl?.[0] || null;
  const l2 = pathFromUrl && pathFromUrl.length >= 2 ? pathFromUrl[1] : null;
  // depth UI: L3 chọn → coi như đã khóa L2
  const depth =
    selectedL3s.length > 0 ? 3 : pathFromUrl?.length || 0;
  const allL2 = l1?.subs || [];
  const allL3 = l2?.subs || [];
  const selectedL3Ids = new Set(selectedL3s.map((n) => n.id));
  const prefix = inFilterSheet ? "sheet" : "bar";

  const clearToTim = "/tim";
  const clearToL1 = l1 ? danhMucHref(l1.slug, [], sp) : clearToTim;

  const selectL1Href = (n: ShopCategoryNavNode) => danhMucHref(n.slug, [], sp);
  const selectL2Href = (n: ShopCategoryNavNode) => danhMucHref(n.slug, [], sp);

  const toggleL3Href = (l3: ShopCategoryNavNode) => {
    if (!l2) return "#";
    let nextIds: number[];
    if (selectedL3Ids.has(l3.id)) {
      nextIds = selectedL3s.filter((n) => n.id !== l3.id).map((n) => n.id);
    } else {
      nextIds = [...selectedL3s.map((n) => n.id), l3.id];
    }
    if (!nextIds.length) return danhMucHref(l2.slug, [], sp);
    if (nextIds.length === 1) {
      const only =
        selectedL3s.find((n) => n.id === nextIds[0]) ||
        (l3.id === nextIds[0] ? l3 : null);
      return danhMucHref(only?.slug || l2.slug, [], sp);
    }
    return danhMucHref(l2.slug, nextIds, sp);
  };

  const clearOneL3Href = (l3Id: number) => {
    if (!l2) return clearToL1;
    const next = selectedL3s.filter((n) => n.id !== l3Id);
    if (!next.length) return danhMucHref(l2.slug, [], sp);
    if (next.length === 1) return danhMucHref(next[0].slug || l2.slug, [], sp);
    return danhMucHref(
      l2.slug,
      next.map((n) => n.id),
      sp
    );
  };

  // —— Chip danh mục đã chọn (chưa gồm «Xóa tất cả») ——
  const selectedCatChips: ReactNode[] = [];
  if (l1 && depth >= 1) {
    selectedCatChips.push(
      <SelectedChip
        key={`l1-${l1.id}`}
        label={chipLabel(l1.name)}
        clearHref={clearToTim}
        onClick={onChipClick}
      />
    );
  }
  if (l2 && depth >= 2) {
    selectedCatChips.push(
      <SelectedChip
        key={`l2-${l2.id}`}
        label={chipLabel(l2.name)}
        clearHref={clearToL1}
        onClick={onChipClick}
      />
    );
  }
  for (const n of selectedL3s) {
    selectedCatChips.push(
      <SelectedChip
        key={`l3-${n.id}`}
        label={chipLabel(n.name)}
        clearHref={clearOneL3Href(n.id)}
        onClick={onChipClick}
      />
    );
  }

  const hasCategoryNav = Boolean(pathFromUrl);
  const hasFilterChips = Boolean(filterResultChips);
  /** TGDĐ: chỉ browse L1 khi chưa lọc phụ và chưa vào danh mục */
  const showL1Browse =
    showRootL1 && !hasCategoryNav && !hasFilterChips && roots.length > 0;

  const clearAllChip =
    selectedCatChips.length > 0 ? (
      <Link
        key="clear-all"
        href={clearToTim}
        scroll={false}
        onClick={() => {
          markPinCatalog();
          onChipClick();
        }}
        className="inline-flex h-9 shrink-0 items-center px-1 text-[12px] font-semibold text-[var(--aloha-green)] underline-offset-2 hover:underline"
      >
        Xóa tất cả
      </Link>
    ) : null;

  // —— Hàng tùy chọn cấp hiện tại ——
  // Browse L1 chỉ khi showL1Browse; đã chọn L1 → L2; đã chọn L2 → L3
  let optionNodes: ShopCategoryNavNode[] = [];
  let optionHref: (n: ShopCategoryNavNode) => string = () => "#";
  let optionActive: (n: ShopCategoryNavNode) => boolean = () => false;
  let optionsLabel = "";

  if (showL1Browse) {
    optionNodes = roots;
    optionHref = selectL1Href;
    optionsLabel = "Danh mục";
  } else if (depth === 1 && allL2.length) {
    optionNodes = allL2;
    optionHref = selectL2Href;
    optionsLabel = "Nhóm";
  } else if (depth >= 2 && allL3.length) {
    optionNodes = allL3;
    optionHref = toggleL3Href;
    optionActive = (n) => selectedL3Ids.has(n.id);
    optionsLabel = "Nhóm";
  }

  const optionsRow =
    optionNodes.length > 0 ? (
      <WrapChipRow className={inFilterSheet ? "" : "bg-white"}>
        {optionNodes.map((n) => (
          <OptionChip
            key={n.id}
            node={n}
            active={optionActive(n)}
            href={optionHref(n)}
            onClick={onChipClick}
          />
        ))}
      </WrapChipRow>
    ) : null;

  // Sheet Lọc: vẫn cho chọn danh mục (L1) kể cả khi đang có lọc phụ trên URL
  const sheetOptionsRow =
    inFilterSheet && !pathFromUrl && showRootL1 && roots.length ? (
      <WrapChipRow>
        {roots.map((n) => (
          <OptionChip
            key={n.id}
            node={n}
            active={false}
            href={selectL1Href(n)}
            onClick={onChipClick}
          />
        ))}
      </WrapChipRow>
    ) : optionsRow;

  // Chỉ nút Lọc, không danh mục / không chip
  if (!pathFromUrl && !showRootL1 && !hasFilterChips) {
    if (filterButton) {
      return <div className="flex min-w-0 items-center gap-2">{filterButton}</div>;
    }
    return null;
  }

  if (!pathFromUrl && showRootL1 && !roots.length && !hasFilterChips) {
    if (filterButton) {
      return <div className="flex min-w-0 items-center gap-2">{filterButton}</div>;
    }
    return null;
  }

  /* —— Trong sheet Lọc —— */
  if (inFilterSheet) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--aloha-line)] bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[var(--aloha-ink)]">Danh mục</h3>
          {l1 ? (
            <span className="truncate text-[11px] font-semibold text-slate-500">
              {chipLabel(l1.name)}
              {l2 ? ` › ${chipLabel(l2.name)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">Chọn danh mục</span>
          )}
        </div>

        {sheetOptionsRow ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {pathFromUrl ? optionsLabel || "Nhóm" : "Danh mục"}
            </p>
            {sheetOptionsRow}
          </div>
        ) : null}
      </div>
    );
  }

  /* —— Toolbar: lọc phụ trước → chỉ chip kết quả; có chọn L1/L2/L3 mới hiện nhánh —— */
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-white">
        {filterButton}
        {hasCategoryNav ? (
          <>
            {selectedCatChips}
            {filterResultChips}
            {clearAllChip}
          </>
        ) : hasFilterChips ? (
          <>{filterResultChips}</>
        ) : showL1Browse ? (
          optionNodes.map((n) => (
            <OptionChip
              key={n.id}
              node={n}
              active={optionActive(n)}
              href={optionHref(n)}
              onClick={onChipClick}
            />
          ))
        ) : null}
      </div>
      {hasCategoryNav ? optionsRow : null}
    </div>
  );
}

type BarProps = {
  categoryIds: number[];
  filterButton: ReactNode;
  showRootL1?: boolean;
  filterResultChips?: ReactNode;
};

export function CatalogSubcatBar({
  categoryIds,
  filterButton,
  showRootL1 = false,
  filterResultChips,
}: BarProps) {
  return (
    <CatalogSubcatPicker
      categoryIds={categoryIds}
      filterButton={filterButton}
      showRootL1={showRootL1}
      filterResultChips={filterResultChips}
    />
  );
}
