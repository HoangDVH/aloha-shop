import { useEffect, useRef, useState } from "react";
import { fetchProducts } from "@/lib/api";

export type DraftState = {
  nhoms: string[];
  attrs: string[];
  dvts: string[];
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
};

export function draftFromUrl(sp: URLSearchParams, selectedNhoms: string[]): DraftState {
  return {
    nhoms: [...selectedNhoms],
    attrs: sp.getAll("attr").filter(Boolean),
    dvts: sp.getAll("dvt").filter(Boolean),
    minPrice: sp.get("minPrice") || "",
    maxPrice: sp.get("maxPrice") || "",
    inStock: sp.get("inStock") === "1",
  };
}

export function useDraftPreviewTotal({
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
}: {
  open: boolean;
  draft: DraftState | null;
  q: string;
  badge: string;
  maxTon: string;
  sort: string | null;
  categoryLocked: boolean;
  selectedNhoms: string[];
  effectiveCategoryIds: number[];
  filterNhoms: string[];
}) {
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
  const [draftTotalLoading, setDraftTotalLoading] = useState(false);
  const draftCountRef = useRef(0);

  useEffect(() => {
    if (!open || !draft) return;
    const reqId = ++draftCountRef.current;
    const abortController = new AbortController();
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
            categoryId: effectiveCategoryIds.length ? effectiveCategoryIds : undefined,
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
            sort: sort || undefined,
            page: 1,
            limit: 1,
            signal: abortController.signal,
          });
          if (reqId !== draftCountRef.current) return;
          setDraftTotal(res.total);
        } catch (err: any) {
          if (err?.name === "AbortError" || abortController.signal.aborted) {
            return;
          }
          if (reqId !== draftCountRef.current) return;
          setDraftTotal(null);
        } finally {
          if (reqId === draftCountRef.current) setDraftTotalLoading(false);
        }
      })();
    }, 280);
    return () => {
      window.clearTimeout(t);
      abortController.abort();
    };
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
    effectiveCategoryIds.join(","),
    filterNhoms.join("|"),
  ]);

  return { draftTotal, setDraftTotal, draftTotalLoading };
}
