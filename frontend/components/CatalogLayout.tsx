"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchCategoryTreeCached, fetchShopFacets, formatVnd, type ShopCategoryNavNode, type ShopFacets } from "@/lib/api";
import { clearAttrDvtParams } from "@/lib/parseShopFilters";
import { CatalogFilterPanel } from "@/components/catalog/CatalogFilterPanel";
import {
  PIN_CATALOG_KEY,
  SORT_OPTIONS,
  LOAI_HANG_OPTIONS,
  markPinCatalog,
  scrollToCatalog,
  leafLabel,
  catalogBase,
  normPath,
} from "@/components/catalog/catalogLayoutUtils";

type Props = {
  total: number;
  page?: number;
  pages?: number;
  title?: string;
  children: React.ReactNode;
  homeMode?: boolean;
  /** Trang chủ dạng mục: giữ sidebar lọc, ẩn tiêu đề/đếm kết quả catalog */
  filtersOnly?: boolean;
  /** Ẩn hết bộ lọc (vd. trang chủ shop) */
  hideFilters?: boolean;
};

export function CatalogLayout({
  total,
  page = 1,
  pages = 1,
  title,
  children,
  homeMode = false,
  filtersOnly = false,
  hideFilters = false,
}: Props) {
  const router = useShopRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [facets, setFacets] = useState<ShopFacets>({ attributes: {}, dvt: [] });
  const [facetsLoading, setFacetsLoading] = useState(false);
  const facetReqRef = useRef(0);
  const FILTER_SHEET_KEY = "aloha_filter_sheet_open";

  const setFilterSheetOpen = (v: boolean) => {
    setOpen(v);
    try {
      if (v) sessionStorage.setItem(FILTER_SHEET_KEY, "1");
      else sessionStorage.removeItem(FILTER_SHEET_KEY);
    } catch {
      /* ignore */
    }
  };

  // Remount sau lọc (Suspense) — giữ sheet mobile đang mở
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FILTER_SHEET_KEY) === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Sau khi lọc: Suspense remount — giữ/đưa viewport về khối catalog (không nhảy hero)
  useEffect(() => {
    let pinned = false;
    try {
      pinned = sessionStorage.getItem(PIN_CATALOG_KEY) === "1";
      if (pinned) sessionStorage.removeItem(PIN_CATALOG_KEY);
    } catch {
      return;
    }
    if (!pinned) return;
    const t0 = window.setTimeout(scrollToCatalog, 0);
    const t1 = window.setTimeout(scrollToCatalog, 120);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [sp]);

  const q = sp.get("q") || "";
  const selectedNhoms = useMemo(() => {
    const all = sp.getAll("nhom").map((s) => normPath(s)).filter(Boolean);
    if (all.length) return all;
    const single = sp.get("nhom");
    return single ? [normPath(single)] : [];
  }, [sp]);
  const selectedAttrs = useMemo(() => sp.getAll("attr").filter(Boolean), [sp]);
  const selectedDvts = useMemo(() => sp.getAll("dvt").filter(Boolean), [sp]);
  const selectedCategoryIds = useMemo(() => {
    const raw = [...sp.getAll("categoryId"), sp.get("categoryId") || ""]
      .flatMap((s) => String(s || "").split(/[,;\s]+/))
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(raw)];
  }, [sp]);
  const selectedLoai = sp.get("loai") || "";
  const minPrice = sp.get("minPrice") || "";
  const maxPrice = sp.get("maxPrice") || "";
  const inStock = sp.get("inStock") === "1";
  const sort = sp.get("sort") || (homeMode ? "ban_chay" : "ten");
  const loaiLabel =
    LOAI_HANG_OPTIONS.find((o) => o.value === selectedLoai)?.label || selectedLoai;
  /** Chỉ trang /tim — load đủ ĐVT + thuộc tính toàn shop khi chưa chọn nhóm/từ khóa. */
  const allProductsPage = !homeMode && pathname === "/tim";
  const [categoryIdNhoms, setCategoryIdNhoms] = useState<string[]>([]);

  useEffect(() => {
    if (selectedNhoms.length || !selectedCategoryIds.length) {
      setCategoryIdNhoms([]);
      return;
    }
    let cancelled = false;
    void fetchCategoryTreeCached()
      .then((items) => {
        if (cancelled) return;
        const want = new Set(selectedCategoryIds);
        const paths: string[] = [];
        const walk = (nodes: ShopCategoryNavNode[]) => {
          for (const n of nodes) {
            const id = Number(n.id) || 0;
            if (id > 0 && want.has(id) && n.path) paths.push(normPath(n.path));
            if (n.subs?.length) walk(n.subs);
          }
        };
        walk(items);
        setCategoryIdNhoms([...new Set(paths.filter(Boolean))]);
      })
      .catch(() => {
        if (!cancelled) setCategoryIdNhoms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedNhoms.join("|"), selectedCategoryIds.join(",")]);

  const filterNhoms = selectedNhoms.length ? selectedNhoms : categoryIdNhoms;

  // Facets theo mục navbar / từ khóa / phạm vi trang chủ (bán chạy + cây thành phẩm)
  useEffect(() => {
    if (hideFilters) {
      setFacets({ attributes: {}, dvt: [] });
      setFacetsLoading(false);
      return;
    }
    const reqId = ++facetReqRef.current;
    setFacetsLoading(true);
    void (async () => {
      try {
        const res = await fetchShopFacets({
          q: q || undefined,
          nhom: selectedNhoms.length ? selectedNhoms : undefined,
          categoryId: selectedCategoryIds.length ? selectedCategoryIds : undefined,
          // Không thu hẹp «home» khi đang lọc loại hàng / ĐVT / thuộc tính
          home:
            homeMode &&
            !selectedNhoms.length &&
            !selectedCategoryIds.length &&
            !q &&
            !selectedLoai &&
            !selectedAttrs.length &&
            !selectedDvts.length,
          all:
            allProductsPage &&
            !selectedNhoms.length &&
            !selectedCategoryIds.length &&
            !q,
        });
        if (reqId !== facetReqRef.current) return;
        setFacets(res || { attributes: {}, dvt: [] });
      } catch {
        if (reqId !== facetReqRef.current) return;
        setFacets({ attributes: {}, dvt: [] });
      } finally {
        if (reqId === facetReqRef.current) setFacetsLoading(false);
      }
    })();
  }, [
    hideFilters,
    q,
    selectedNhoms.join("|"),
    selectedCategoryIds.join(","),
    homeMode,
    allProductsPage,
    selectedLoai,
    selectedAttrs.join("|"),
    selectedDvts.join("|"),
  ]);

  const navigateQs = (next: URLSearchParams, opts?: { closeSheet?: boolean }) => {
    const base = catalogBase(homeMode, pathname);
    const qs = next.toString();
    markPinCatalog();
    router.push(qs ? `${base}?${qs}` : base, { scroll: false });
    if (opts?.closeSheet) setFilterSheetOpen(false);
  };

  const pushNhoms = (paths: string[]) => {
    const next = new URLSearchParams(sp.toString());
    next.delete("nhom");
    next.delete("categoryId"); // tránh categoryId navbar đè nhóm mới chọn
    next.delete("page");
    clearAttrDvtParams(next); // đổi mục → xóa filter attr/dvt cũ
    for (const p of paths.map(normPath).filter(Boolean)) {
      next.append("nhom", p);
    }
    navigateQs(next);
  };

  const pushParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!Object.prototype.hasOwnProperty.call(patch, "page")) next.delete("page");
    navigateQs(next);
  };

  const toggleMulti = (key: "attr" | "dvt", value: string) => {
    const next = new URLSearchParams(sp.toString());
    const cur = next.getAll(key);
    next.delete(key);
    const has = cur.some((x) => x === value);
    const rest = has ? cur.filter((x) => x !== value) : [...cur, value];
    for (const v of rest) next.append(key, v);
    next.delete("page");
    navigateQs(next);
  };

  const removeAttr = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    const rest = next.getAll("attr").filter((x) => x !== value);
    next.delete("attr");
    for (const v of rest) next.append("attr", v);
    next.delete("page");
    navigateQs(next);
  };

  const removeDvt = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    const rest = next.getAll("dvt").filter((x) => x !== value);
    next.delete("dvt");
    for (const v of rest) next.append("dvt", v);
    next.delete("page");
    navigateQs(next);
  };

  const goPage = (p: number) => {
    if (p < 1 || p > pages) return;
    pushParams({ page: p <= 1 ? null : String(p) });
  };

  const nhomTitle =
    filterNhoms.length === 0
      ? ""
      : filterNhoms.length === 1
        ? leafLabel(filterNhoms[0])
        : `${filterNhoms.length} nhóm hàng`;

  const attrMap = useMemo(() => facets.attributes || {}, [facets]);

  const activeFilters = useMemo(() => {
    const tags: { key: string; label: string; clear: () => void }[] = [];
    if (q) tags.push({ key: "q", label: `Tìm: ${q}`, clear: () => pushParams({ q: null }) });
    if (filterNhoms.length === 1) {
      tags.push({
        key: "nhom",
        label: leafLabel(filterNhoms[0]),
        clear: () => pushNhoms([]),
      });
    } else if (filterNhoms.length > 1) {
      filterNhoms.forEach((p, i) => {
        tags.push({
          key: `nhom-${i}`,
          label: leafLabel(p),
          clear: () => {
            if (selectedNhoms.length) {
              pushNhoms(selectedNhoms.filter((_, j) => j !== i));
            } else {
              pushNhoms([]);
            }
          },
        });
      });
    }
    for (const a of selectedAttrs) {
      const [n, ...rest] = a.split(":");
      const v = rest.join(":") || a;
      tags.push({
        key: `attr-${a}`,
        label: n && rest.length ? `${n}: ${v}` : a,
        clear: () => removeAttr(a),
      });
    }
    for (const d of selectedDvts) {
      tags.push({
        key: `dvt-${d}`,
        label: `ĐVT: ${d}`,
        clear: () => removeDvt(d),
      });
    }
    if (selectedLoai) {
      tags.push({
        key: "loai",
        label: loaiLabel || selectedLoai,
        clear: () => pushParams({ loai: null }),
      });
    }
    if (minPrice || maxPrice) {
      const minL = minPrice ? formatVnd(Number(minPrice) || 0) : "0đ";
      const maxL = maxPrice ? formatVnd(Number(maxPrice) || 0) : "∞";
      tags.push({
        key: "price",
        label: `Giá ${minL}–${maxL}`,
        clear: () => pushParams({ minPrice: null, maxPrice: null }),
      });
    }
    if (inStock) {
      tags.push({ key: "stock", label: "Còn hàng", clear: () => pushParams({ inStock: null }) });
    }
    return tags;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterNhoms.join("|"), selectedNhoms.join("|"), selectedAttrs, selectedDvts, selectedLoai, loaiLabel, minPrice, maxPrice, inStock]);

  const pageNums = useMemo(() => {
    const maxBtn = 5;
    let start = Math.max(1, page - Math.floor(maxBtn / 2));
    let end = Math.min(pages, start + maxBtn - 1);
    start = Math.max(1, end - maxBtn + 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, pages]);

  const filterPanel = (
    <CatalogFilterPanel
      selectedNhoms={filterNhoms}
      onNhomsChange={pushNhoms}
      selectedLoai={selectedLoai}
      onLoaiChange={(loai) => pushParams({ loai, page: null })}
      dvtItems={facets.dvt}
      selectedDvts={selectedDvts}
      onToggleDvt={(k) => toggleMulti("dvt", k)}
      attributes={attrMap}
      selectedAttrs={selectedAttrs}
      onToggleAttr={(token) => toggleMulti("attr", token)}
      facetsLoading={facetsLoading}
      q={q}
      homeMode={homeMode}
      allProductsPage={allProductsPage}
      hasCategoryScope={selectedCategoryIds.length > 0}
      minPrice={minPrice}
      maxPrice={maxPrice}
      onPricePreset={(min, max) => pushParams({ minPrice: min, maxPrice: max })}
      onMinPriceBlur={(v) => pushParams({ minPrice: v })}
      onMaxPriceBlur={(v) => pushParams({ maxPrice: v })}
      inStock={inStock}
      onInStockChange={(checked) => pushParams({ inStock: checked ? "1" : null })}
      onClearFilters={() => {
        const next = new URLSearchParams(sp.toString());
        next.delete("nhom");
        next.delete("minPrice");
        next.delete("maxPrice");
        next.delete("inStock");
        next.delete("loai");
        next.delete("page");
        clearAttrDvtParams(next);
        if (q) next.set("q", q);
        else next.delete("q");
        if (homeMode) next.set("sort", "ban_chay");
        else if (sort === "ban_chay") next.set("sort", "ban_chay");
        else next.delete("sort");
        navigateQs(next);
      }}
      onCloseMobile={() => setFilterSheetOpen(false)}
    />
  );

  return (
    <div id="shop-catalog" className="scroll-mt-24 space-y-4">
      {hideFilters ? (
        <div>
          <h1 className="text-xl font-extrabold text-[var(--aloha-ink)] sm:text-2xl">
            {title ||
              (q
                ? `Kết quả: “${q}”`
                : nhomTitle ||
                  (sort === "ban_chay"
                    ? "Sản phẩm bán chạy"
                    : "Tất cả sản phẩm"))}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} sản phẩm
            {pages > 1 ? ` · Trang ${page}/${pages}` : ""}
          </p>
        </div>
      ) : filtersOnly ? (
        <div className="flex justify-end lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E3D0] bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm"
          >
            <SlidersHorizontal size={16} />
            Lọc
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--aloha-green)] sm:text-2xl">
              {title ||
                (q
                  ? `Kết quả: “${q}”`
                  : nhomTitle ||
                    (sort === "ban_chay"
                      ? "Sản phẩm bán chạy"
                      : "Tất cả sản phẩm"))}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {total} sản phẩm
              {pages > 1 ? ` · Trang ${page}/${pages}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D5E3D0] bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm lg:hidden"
            >
              <SlidersHorizontal size={16} />
              Lọc
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              Sắp xếp
              <select
                value={sort}
                onChange={(e) => pushParams({ sort: e.target.value, page: null })}
                className="rounded-xl border border-[#D5E3D0] bg-white px-3 py-2 text-sm font-semibold text-[var(--aloha-green)] outline-none focus:border-[var(--aloha-green)]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {!hideFilters && !filtersOnly && activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={t.clear}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--aloha-green-light)] px-3 py-1 text-xs font-bold text-[var(--aloha-green)] ring-1 ring-[#D5E3D0]"
            >
              {t.label}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      <div
        className={
          hideFilters
            ? "space-y-4"
            : "grid gap-6 lg:grid-cols-[240px_1fr] lg:items-start"
        }
      >
        {!hideFilters ? (
          <div className="hidden lg:block lg:sticky lg:top-24 lg:z-10 lg:max-h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto lg:overflow-x-visible lg:overscroll-contain">
            {filterPanel}
          </div>
        ) : null}
        <div className="space-y-4">
          {!hideFilters && !filtersOnly && total === 0 && activeFilters.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-amber-900">
                Không có sản phẩm khớp bộ lọc
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-bold text-[var(--aloha-green)] underline"
                onClick={() => {
                  const next = new URLSearchParams(sp.toString());
                  clearAttrDvtParams(next);
                  next.delete("minPrice");
                  next.delete("maxPrice");
                  next.delete("inStock");
                  next.delete("loai");
                  next.delete("page");
                  navigateQs(next);
                }}
              >
                Xóa lọc thuộc tính / ĐVT / loại / giá
              </button>
            </div>
          ) : null}
          {children}

          {!filtersOnly && pages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
              aria-label="Phân trang"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D5E3D0] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Trước
              </button>
              {pageNums[0] > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => goPage(1)}
                    className="h-9 min-w-9 rounded-lg border border-[#D5E3D0] bg-white text-sm font-bold text-[var(--aloha-green)]"
                  >
                    1
                  </button>
                  {pageNums[0] > 2 && <span className="px-1 text-slate-400">…</span>}
                </>
              )}
              {pageNums.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goPage(n)}
                  className={`h-9 min-w-9 rounded-lg text-sm font-bold ${
                    n === page
                      ? "bg-[var(--aloha-green)] text-white"
                      : "border border-[#D5E3D0] bg-white text-[var(--aloha-green)]"
                  }`}
                >
                  {n}
                </button>
              ))}
              {pageNums[pageNums.length - 1] < pages && (
                <>
                  {pageNums[pageNums.length - 1] < pages - 1 && (
                    <span className="px-1 text-slate-400">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => goPage(pages)}
                    className="h-9 min-w-9 rounded-lg border border-[#D5E3D0] bg-white text-sm font-bold text-[var(--aloha-green)]"
                  >
                    {pages}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => goPage(page + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D5E3D0] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
              >
                Sau <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </div>

      {!hideFilters && open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Đóng"
            onClick={() => setFilterSheetOpen(false)}
          />
          <div className="shop-sticky-bottom absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">{filterPanel}</div>
            <div className="shrink-0 border-t border-[var(--aloha-line)] bg-white px-3 py-2.5">
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="w-full rounded-xl bg-[var(--aloha-green)] py-3 text-sm font-bold text-white"
              >
                Xem {total} kết quả
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
