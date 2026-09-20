"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  fetchCategoryTreeCached,
  fetchProducts,
  fetchShopFacets,
  formatVnd,
  type ShopCategoryNavNode,
  type ShopFacets,
} from "@/lib/api";
import { clearAttrDvtParams } from "@/lib/parseShopFilters";
import { CatalogFilterPanel } from "@/components/catalog/CatalogFilterPanel";
import { CatalogSubcatBar } from "@/components/catalog/CatalogSubcatBar";
import {
  PIN_CATALOG_KEY,
  SORT_TOOLBAR,
  markPinCatalog,
  scrollToCatalog,
  leafLabel,
  catalogBase,
  normPath,
  isCategoryCatalogPath,
  normalizeCatalogSort,
} from "@/components/catalog/catalogLayoutUtils";

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

type DraftState = {
  nhoms: string[];
  attrs: string[];
  dvts: string[];
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
};

function draftFromUrl(sp: URLSearchParams, selectedNhoms: string[]): DraftState {
  return {
    nhoms: [...selectedNhoms],
    attrs: sp.getAll("attr").filter(Boolean),
    dvts: sp.getAll("dvt").filter(Boolean),
    minPrice: sp.get("minPrice") || "",
    maxPrice: sp.get("maxPrice") || "",
    inStock: sp.get("inStock") === "1",
  };
}

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
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
  const [draftTotalLoading, setDraftTotalLoading] = useState(false);
  const facetReqRef = useRef(0);
  const draftCountRef = useRef(0);
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
      setDraftTotal(null);
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
          badge: badge || undefined,
          home:
            homeMode &&
            !selectedNhoms.length &&
            !selectedCategoryIds.length &&
            !q &&
            !badge &&
            !selectedAttrs.length &&
            !selectedDvts.length,
          all:
            allProductsPage &&
            !selectedNhoms.length &&
            !selectedCategoryIds.length &&
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
    selectedCategoryIds.join(","),
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

  /** Clear lọc phụ — giữ sticky: q, badge, maxTon, categoryId+nhom trên /danh-muc, sort. */
  const clearSecondaryFilters = (base?: URLSearchParams) => {
    const next = new URLSearchParams((base || sp).toString());
    if (!categoryLocked) {
      next.delete("nhom");
      // không xóa categoryId trên /tim nếu có (hiếm)
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
      for (const id of selectedCategoryIds) {
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

  // Preview total theo draft
  useEffect(() => {
    if (!open || !draft) return;
    const reqId = ++draftCountRef.current;
    setDraftTotalLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchProducts({
            q: q || undefined,
            nhom:
              categoryLocked
                ? selectedNhoms.length
                  ? selectedNhoms
                  : filterNhoms.length
                    ? filterNhoms
                    : undefined
                : draft.nhoms.length
                  ? draft.nhoms
                  : undefined,
            categoryId: selectedCategoryIds.length ? selectedCategoryIds : undefined,
            attr: draft.attrs.length ? draft.attrs : undefined,
            dvt: draft.dvts.length ? draft.dvts : undefined,
            minPrice: draft.minPrice ? Number(draft.minPrice) : undefined,
            maxPrice: draft.maxPrice ? Number(draft.maxPrice) : undefined,
            inStock: draft.inStock || undefined,
            badge: (badge || undefined) as
              | "ban_chay_sap_het"
              | "giam_gia"
              | "dat_truoc"
              | "moi"
              | "noi_bat"
              | "ban_chay"
              | undefined,
            maxTon: maxTon ? Number(maxTon) : undefined,
            sort,
            page: 1,
            limit: 1,
          });
          if (reqId !== draftCountRef.current) return;
          setDraftTotal(res.total);
        } catch {
          if (reqId !== draftCountRef.current) return;
          setDraftTotal(null);
        } finally {
          if (reqId === draftCountRef.current) setDraftTotalLoading(false);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [
    open,
    draft?.nhoms.join("|"),
    draft?.attrs.join("|"),
    draft?.dvts.join("|"),
    draft?.minPrice,
    draft?.maxPrice,
    draft?.inStock,
    q,
    badge,
    maxTon,
    sort,
    categoryLocked,
    selectedNhoms.join("|"),
    selectedCategoryIds.join(","),
    filterNhoms.join("|"),
  ]);

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
    // click (không mousedown) — tránh đóng ngay khi vừa mở
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

  const attrMap = useMemo(() => facets.attributes || {}, [facets]);

  const secondaryFilterCount = useMemo(() => {
    let n = 0;
    if (!categoryLocked && selectedNhoms.length) n += selectedNhoms.length;
    n += selectedAttrs.length;
    n += selectedDvts.length;
    if (minPrice || maxPrice) n += 1;
    if (inStock) n += 1;
    return n;
  }, [
    categoryLocked,
    selectedNhoms.length,
    selectedAttrs.length,
    selectedDvts.length,
    minPrice,
    maxPrice,
    inStock,
  ]);

  const activeFilters = useMemo(() => {
    const tags: { key: string; label: string; clear: () => void }[] = [];
    // q / badge sticky — hiện chip nhưng không clear (hoặc clear q trên /tim sạch? plan: sticky)
    if (!categoryLocked && selectedNhoms.length === 1) {
      tags.push({
        key: "nhom",
        label: leafLabel(selectedNhoms[0]),
        clear: () => pushNhoms([]),
      });
    } else if (!categoryLocked && selectedNhoms.length > 1) {
      selectedNhoms.forEach((p, i) => {
        tags.push({
          key: `nhom-${i}`,
          label: leafLabel(p),
          clear: () => pushNhoms(selectedNhoms.filter((_, j) => j !== i)),
        });
      });
    }
    for (const a of selectedAttrs) {
      const [name, ...rest] = a.split(":");
      const v = rest.join(":") || a;
      tags.push({
        key: `attr-${a}`,
        label: name && rest.length ? `${name}: ${v}` : a,
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
  }, [
    categoryLocked,
    selectedNhoms.join("|"),
    selectedAttrs,
    selectedDvts,
    minPrice,
    maxPrice,
    inStock,
  ]);

  const pageNums = useMemo(() => {
    const maxBtn = 5;
    let start = Math.max(1, page - Math.floor(maxBtn / 2));
    let end = Math.min(pages, start + maxBtn - 1);
    start = Math.max(1, end - maxBtn + 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, pages]);

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

  const activeDraft = draft;

  const filterPanel =
    activeDraft && open ? (
      <CatalogFilterPanel
        embedded
        hideClearButton
        selectedNhoms={categoryLocked ? filterNhoms : activeDraft.nhoms}
        onNhomsChange={(paths) => {
          if (categoryLocked) return;
          setDraft((d) => (d ? { ...d, nhoms: paths.map(normPath).filter(Boolean), attrs: [], dvts: [] } : d));
        }}
        dvtItems={facets.dvt}
        selectedDvts={activeDraft.dvts}
        onToggleDvt={(k) =>
          setDraft((d) => {
            if (!d) return d;
            const has = d.dvts.includes(k);
            return { ...d, dvts: has ? d.dvts.filter((x) => x !== k) : [...d.dvts, k] };
          })
        }
        attributes={attrMap}
        selectedAttrs={activeDraft.attrs}
        onToggleAttr={(token) =>
          setDraft((d) => {
            if (!d) return d;
            const has = d.attrs.includes(token);
            return { ...d, attrs: has ? d.attrs.filter((x) => x !== token) : [...d.attrs, token] };
          })
        }
        facetsLoading={facetsLoading}
        q={q}
        homeMode={homeMode}
        allProductsPage={allProductsPage}
        hasCategoryScope={selectedCategoryIds.length > 0 || categoryLocked}
        lockCategory={categoryLocked}
        categoryIds={selectedCategoryIds}
        categoryLockLabel={nhomTitle ? `Danh mục: ${nhomTitle}` : "Đang lọc trong danh mục này"}
        minPrice={activeDraft.minPrice}
        maxPrice={activeDraft.maxPrice}
        onPricePreset={(min, max) =>
          setDraft((d) => (d ? { ...d, minPrice: min, maxPrice: max || "" } : d))
        }
        onMinPriceBlur={(v) => setDraft((d) => (d ? { ...d, minPrice: v || "" } : d))}
        onMaxPriceBlur={(v) => setDraft((d) => (d ? { ...d, maxPrice: v || "" } : d))}
        inStock={activeDraft.inStock}
        onInStockChange={(checked) => setDraft((d) => (d ? { ...d, inStock: checked } : d))}
        onClearFilters={clearDraftSecondary}
        onClose={closeFilterModal}
      />
    ) : null;

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
          <h1 className="text-xl font-extrabold text-[var(--aloha-green)] sm:text-2xl">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} sản phẩm
            {pages > 1 ? ` · Trang ${page}/${pages}` : ""}
          </p>
        </div>
      ) : null}

      {/* Toolbar: Lọc + L2/L3 (TGDĐ) · Sort */}
      {!filtersOnly ? (
        <div className="flex flex-col gap-2.5">
          {categoryLocked ? (
            <CatalogSubcatBar
              categoryIds={selectedCategoryIds}
              filterButton={
                <button
                  type="button"
                  onClick={openFilterModal}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition ${
                    secondaryFilterCount > 0
                      ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)] text-[var(--aloha-green)]"
                      : "border-[var(--aloha-green)] bg-white text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                  }`}
                >
                  <span className="relative">
                    <SlidersHorizontal size={16} />
                    {secondaryFilterCount > 0 ? (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" />
                    ) : null}
                  </span>
                  Lọc
                </button>
              }
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={openFilterModal}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition ${
                  secondaryFilterCount > 0
                    ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
                    : "border-[var(--aloha-green)] bg-white text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                }`}
              >
                <SlidersHorizontal size={16} />
                Lọc
                {secondaryFilterCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-black">
                    {secondaryFilterCount}
                  </span>
                ) : null}
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeFilters.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={t.clear}
                    className="inline-flex h-10 max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-[var(--aloha-line)] bg-white px-3 text-xs font-semibold text-slate-700"
                  >
                    <span className="truncate">{t.label}</span>
                    <X size={14} className="shrink-0 text-slate-400" />
                  </button>
                ))}
                {secondaryFilterCount >= 1 ? (
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 items-center text-xs font-semibold text-slate-500 underline-offset-2 hover:text-[var(--aloha-green)] hover:underline"
                    onClick={() => navigateQs(clearSecondaryFilters())}
                  >
                    Xóa lọc
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {categoryLocked && activeFilters.length ? (
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pl-[4.25rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeFilters.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={t.clear}
                  className="inline-flex h-9 max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-[var(--aloha-line)] bg-white px-2.5 text-xs font-semibold text-slate-700"
                >
                  <span className="truncate">{t.label}</span>
                  <X size={14} className="shrink-0 text-slate-400" />
                </button>
              ))}
              {secondaryFilterCount >= 1 ? (
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center text-xs font-semibold text-slate-500 underline-offset-2 hover:text-[var(--aloha-green)] hover:underline"
                  onClick={() => navigateQs(clearSecondaryFilters())}
                >
                  Xóa lọc
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Sort — mobile full-bleed kiểu TGDĐ; desktop giữ nhãn */}
          <div className="-mx-4 border-y border-[#eee] bg-white sm:mx-0 sm:border-0 sm:bg-transparent">
            <div className="flex w-full items-center justify-around overflow-x-auto px-2 [scrollbar-width:none] sm:justify-start sm:gap-x-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
              <span className="mr-1 hidden shrink-0 text-sm font-semibold text-slate-500 sm:inline">
                Sắp xếp theo:
              </span>
              {SORT_TOOLBAR.map((o, idx) => {
                const isPrice = o.value === "price";
                const active = isPrice
                  ? sort === "price_asc" || sort === "price_desc"
                  : sort === o.value;
                return (
                  <span key={o.value} className="inline-flex items-center">
                    {idx > 0 ? (
                      <span
                        className="mx-1 h-1 w-1 shrink-0 rounded-full bg-[#cfcfcf] sm:hidden"
                        aria-hidden
                      />
                    ) : null}
                    {isPrice ? (
                      <div className="relative shrink-0" data-price-sort-menu>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSortClick("price");
                          }}
                          className={`inline-flex h-10 items-center gap-0.5 px-1.5 text-[13px] transition sm:h-11 sm:px-0 sm:text-sm ${
                            active || priceMenuOpen
                              ? "font-bold text-[var(--aloha-green)]"
                              : "font-medium text-[#444] hover:text-[var(--aloha-green)]"
                          }`}
                        >
                          Giá
                          <ChevronUp
                            size={14}
                            className={`transition ${priceMenuOpen ? "" : "rotate-180 opacity-70"}`}
                          />
                        </button>
                        {priceMenuOpen ? (
                          <div className="absolute right-0 top-full z-[60] mt-1 min-w-[168px] overflow-hidden rounded-2xl bg-white py-1.5 shadow-lg ring-1 ring-black/8">
                            <button
                              type="button"
                              className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--aloha-cream)] ${
                                sort === "price_asc"
                                  ? "font-bold text-[var(--aloha-green)]"
                                  : "font-medium text-slate-600"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPriceMenuOpen(false);
                                pushParams({ sort: "price_asc", page: null });
                              }}
                            >
                              Giá thấp - cao
                            </button>
                            <button
                              type="button"
                              className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--aloha-cream)] ${
                                sort === "price_desc"
                                  ? "font-bold text-[var(--aloha-green)]"
                                  : "font-medium text-slate-600"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPriceMenuOpen(false);
                                pushParams({ sort: "price_desc", page: null });
                              }}
                            >
                              Giá cao - thấp
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSortClick(o.value)}
                        className={`inline-flex h-10 shrink-0 items-center px-1.5 text-[13px] transition sm:h-11 sm:px-0 sm:text-sm ${
                          active
                            ? "font-bold text-[var(--aloha-green)]"
                            : "font-medium text-[#444] hover:text-[var(--aloha-green)]"
                        }`}
                      >
                        {o.label}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          <button
            type="button"
            onClick={openFilterModal}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm font-bold transition ${
              secondaryFilterCount > 0
                ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
                : "border-[var(--aloha-green)] bg-white text-[var(--aloha-green)]"
            }`}
          >
            <SlidersHorizontal size={16} />
            Lọc
          </button>
        </div>
      )}

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

        {!filtersOnly && pages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
            aria-label="Phân trang"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--aloha-line)] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            {pageNums[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goPage(1)}
                  className="h-9 min-w-9 rounded-lg border border-[var(--aloha-line)] bg-white text-sm font-bold text-[var(--aloha-green)]"
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
                    : "border border-[var(--aloha-line)] bg-white text-[var(--aloha-green)]"
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
                  className="h-9 min-w-9 rounded-lg border border-[var(--aloha-line)] bg-white text-sm font-bold text-[var(--aloha-green)]"
                >
                  {pages}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => goPage(page + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--aloha-line)] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
            >
              Sau <ChevronRight size={16} />
            </button>
          </nav>
        )}
      </div>

      {/* Modal lọc — desktop + mobile */}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
            aria-label="Đóng bộ lọc"
            onClick={closeFilterModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filter-title"
            className="shop-sticky-bottom relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--aloha-line)] px-4 py-3">
              <h2
                id="catalog-filter-title"
                className="inline-flex items-center gap-2 text-base font-extrabold text-[var(--aloha-ink)]"
              >
                <SlidersHorizontal size={18} className="text-[var(--aloha-green)]" />
                Bộ lọc
              </h2>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--aloha-cream)]"
                onClick={closeFilterModal}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{filterPanel}</div>
            <div className="flex shrink-0 gap-2 border-t border-[var(--aloha-line)] bg-white px-4 py-3">
              <button
                type="button"
                onClick={clearDraftSecondary}
                className="min-h-11 flex-1 rounded-full border border-[var(--aloha-line)] text-sm font-bold text-slate-600 transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                onClick={commitDraft}
                className="min-h-11 flex-[1.4] rounded-full bg-[var(--aloha-green)] text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-hover)]"
              >
                {draftTotalLoading
                  ? "Đang đếm…"
                  : draftTotal != null
                    ? `Xem ${draftTotal} kết quả`
                    : "Xem kết quả"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
