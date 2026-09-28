"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchShopFacets,
  type ShopFacets,
} from "@/lib/api";
import { clearAttrDvtParams } from "@/lib/parseShopFilters";
import {
  PIN_CATALOG_KEY,
  markPinCatalog,
  scrollToCatalog,
  leafLabel,
  catalogBase,
  normPath,
  isCategoryCatalogPath,
  normalizeCatalogSort,
} from "@/components/catalog/catalogLayoutUtils";
import {
  draftFromUrl,
  useDraftPreviewTotal,
  type DraftState,
} from "@/components/catalog/draft";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { CatalogFilterModal } from "@/components/catalog/CatalogFilterModal";
import { useCategoryScope } from "@/components/catalog/useCategoryScope";
import { useActiveFilters } from "@/components/catalog/useActiveFilters";

type Props = {
  total: number;
  page?: number;
  pages?: number;
  title?: string;
  children: React.ReactNode;
  homeMode?: boolean;
  filtersOnly?: boolean;
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
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const [facets, setFacets] = useState<ShopFacets>({ attributes: {}, dvt: [] });
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const facetReqRef = useRef(0);
  const FILTER_SHEET_KEY = "aloha_filter_sheet_open";
  const categoryLocked = isCategoryCatalogPath(pathname);

  const setFilterOpen = (v: boolean) => {
    setOpen(v);
    try {
      if (v) sessionStorage.setItem(FILTER_SHEET_KEY, "1");
      else sessionStorage.removeItem(FILTER_SHEET_KEY);
    } catch {
      /* ignore */
    }
    if (!v) {
      setDraft(null);
    }
  };

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FILTER_SHEET_KEY) === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

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
  const badge = sp.get("badge") || "";
  const maxTon = sp.get("maxTon") || "";
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
  const minPrice = sp.get("minPrice") || "";
  const maxPrice = sp.get("maxPrice") || "";
  const inStock = sp.get("inStock") === "1";
  const sort = normalizeCatalogSort(sp.get("sort") || (homeMode ? "ban_chay" : null));
  const allProductsPage = !homeMode && pathname === "/tim";

  const { effectiveCategoryIds, filterNhoms } = useCategoryScope(
    pathname,
    categoryLocked,
    selectedNhoms,
    selectedCategoryIds
  );

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
          categoryId: effectiveCategoryIds.length ? effectiveCategoryIds : undefined,
          badge: badge || undefined,
          home:
            homeMode &&
            !selectedNhoms.length &&
            !effectiveCategoryIds.length &&
            !q &&
            !badge &&
            !selectedAttrs.length &&
            !selectedDvts.length,
          all:
            allProductsPage &&
            !selectedNhoms.length &&
            !effectiveCategoryIds.length &&
            !q &&
            !badge,
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
    badge,
    selectedNhoms.join("|"),
    effectiveCategoryIds.join(","),
    homeMode,
    allProductsPage,
    selectedAttrs.join("|"),
    selectedDvts.join("|"),
  ]);

  const navigateQs = (next: URLSearchParams, opts?: { closeModal?: boolean }) => {
    const base = catalogBase(homeMode, pathname);
    const qs = next.toString();
    markPinCatalog();
    router.push(qs ? `${base}?${qs}` : base, { scroll: false });
    if (opts?.closeModal) setFilterOpen(false);
  };

  const pushNhoms = (paths: string[]) => {
    if (categoryLocked) return;
    const next = new URLSearchParams(sp.toString());
    next.delete("nhom");
    next.delete("categoryId");
    next.delete("page");
    clearAttrDvtParams(next);
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

  /** Clear lọc phụ — giữ sticky: q, badge, maxTon, categoryId+nhom trên /danh-muc, sort. */
  const clearSecondaryFilters = (base?: URLSearchParams) => {
    const next = new URLSearchParams((base || sp).toString());
    if (!categoryLocked) {
      next.delete("nhom");
    }
    next.delete("minPrice");
    next.delete("maxPrice");
    next.delete("inStock");
    next.delete("loai");
    next.delete("page");
    clearAttrDvtParams(next);
    if (q) next.set("q", q);
    if (badge) next.set("badge", badge);
    if (maxTon) next.set("maxTon", maxTon);
    if (categoryLocked) {
      for (const id of effectiveCategoryIds) {
        if (![...next.getAll("categoryId")].includes(String(id))) {
          next.append("categoryId", String(id));
        }
      }
      if (selectedNhoms.length) {
        next.delete("nhom");
        for (const p of selectedNhoms) next.append("nhom", p);
      }
    }
    const keepSort = normalizeCatalogSort(next.get("sort") || sort);
    next.set("sort", keepSort);
    return next;
  };

  const openFilterModal = () => {
    setDraft(draftFromUrl(sp, categoryLocked ? filterNhoms : selectedNhoms));
    setDraftTotal(total);
    setFilterOpen(true);
  };

  const closeFilterModal = () => setFilterOpen(false);

  // ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFilterModal();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Sync draft khi remount với sheet còn mở
  useEffect(() => {
    if (open && !draft) {
      setDraft(draftFromUrl(sp, categoryLocked ? filterNhoms : selectedNhoms));
      setDraftTotal(total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { draftTotal, setDraftTotal, draftTotalLoading } = useDraftPreviewTotal({
    open,
    draft,
    q,
    badge,
    maxTon,
    sort,
    categoryLocked,
    selectedNhoms,
    effectiveCategoryIds,
    filterNhoms,
  });

  const commitDraft = () => {
    if (!draft) {
      closeFilterModal();
      return;
    }
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    clearAttrDvtParams(next);
    next.delete("minPrice");
    next.delete("maxPrice");
    next.delete("inStock");
    if (!categoryLocked) {
      next.delete("nhom");
      next.delete("categoryId");
      for (const p of draft.nhoms.map(normPath).filter(Boolean)) {
        next.append("nhom", p);
      }
    }
    for (const a of draft.attrs) next.append("attr", a);
    for (const d of draft.dvts) next.append("dvt", d);
    if (draft.minPrice) next.set("minPrice", draft.minPrice);
    if (draft.maxPrice) next.set("maxPrice", draft.maxPrice);
    if (draft.inStock) next.set("inStock", "1");
    if (q) next.set("q", q);
    if (badge) next.set("badge", badge);
    if (maxTon) next.set("maxTon", maxTon);
    navigateQs(next, { closeModal: true });
  };

  const clearDraftSecondary = () => {
    setDraft((d) => {
      if (!d) return d;
      return {
        nhoms: categoryLocked ? d.nhoms : [],
        attrs: [],
        dvts: [],
        minPrice: "",
        maxPrice: "",
        inStock: false,
      };
    });
  };

  const goPage = (p: number) => {
    if (p < 1 || p > pages) return;
    pushParams({ page: p <= 1 ? null : String(p) });
  };

  const onSortClick = (key: string) => {
    if (key === "price") {
      setPriceMenuOpen((v) => !v);
      return;
    }
    setPriceMenuOpen(false);
    pushParams({ sort: key, page: null });
  };

  useEffect(() => {
    if (!priceMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-price-sort-menu]")) return;
      setPriceMenuOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("click", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDoc);
    };
  }, [priceMenuOpen]);

  const nhomTitle =
    filterNhoms.length === 0
      ? ""
      : filterNhoms.length === 1
        ? leafLabel(filterNhoms[0])
        : `${filterNhoms.length} nhóm hàng`;

  const { secondaryFilterCount, activeFilters } = useActiveFilters({
    categoryLocked,
    selectedNhoms,
    selectedAttrs,
    selectedDvts,
    minPrice,
    maxPrice,
    inStock,
    pushNhoms,
    removeAttr,
    removeDvt,
    pushParams,
  });

  const heading =
    title ||
    (q
      ? `Kết quả: “${q}”`
      : nhomTitle ||
        (sort === "ban_chay"
          ? "Sản phẩm bán chạy"
          : sort === "moi"
            ? "Sản phẩm mới"
            : sort === "giam_gia"
              ? "Sản phẩm giảm giá"
              : "Tất cả sản phẩm"));

  if (hideFilters) {
    return (
      <div id="shop-catalog" className="scroll-mt-24 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--aloha-ink)] sm:text-2xl">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} sản phẩm
            {pages > 1 ? ` · Trang ${page}/${pages}` : ""}
          </p>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div id="shop-catalog" className="scroll-mt-24 space-y-4">
      {!filtersOnly ? (
        <div>
          <h1 className="truncate text-xl font-bold text-stone-900 sm:text-2xl sm:text-[var(--aloha-green)]">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} sản phẩm
            {pages > 1 ? ` · Trang ${page}/${pages}` : ""}
          </p>
        </div>
      ) : null}

      <CatalogToolbar
        filtersOnly={filtersOnly}
        categoryLocked={categoryLocked}
        allProductsPage={allProductsPage}
        effectiveCategoryIds={effectiveCategoryIds}
        activeFilters={activeFilters}
        secondaryFilterCount={secondaryFilterCount}
        onOpenFilterModal={openFilterModal}
        sort={sort}
        priceMenuOpen={priceMenuOpen}
        onSortClick={onSortClick}
        onSelectPriceSort={(val) => {
          setPriceMenuOpen(false);
          pushParams({ sort: val, page: null });
        }}
      />

      <div className="space-y-4">
        {!filtersOnly && total === 0 && secondaryFilterCount > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-amber-900">Không có sản phẩm khớp bộ lọc</p>
            <button
              type="button"
              className="mt-3 text-sm font-bold text-[var(--aloha-green)] underline"
              onClick={() => navigateQs(clearSecondaryFilters())}
            >
              Xóa lọc phụ
            </button>
          </div>
        ) : null}

        {children}

        {!filtersOnly && (
          <CatalogPagination
            page={page}
            pages={pages}
            onPageChange={goPage}
          />
        )}
      </div>

      <CatalogFilterModal
        open={open}
        onClose={closeFilterModal}
        activeDraft={draft}
        setDraft={setDraft}
        facets={facets}
        facetsLoading={facetsLoading}
        filterNhoms={filterNhoms}
        effectiveCategoryIds={effectiveCategoryIds}
        categoryLocked={categoryLocked}
        nhomTitle={nhomTitle}
        q={q}
        homeMode={homeMode}
        allProductsPage={allProductsPage}
        clearDraftSecondary={clearDraftSecondary}
        onCommit={commitDraft}
        draftTotalLoading={draftTotalLoading}
        draftTotal={draftTotal}
      />
    </div>
  );
}
