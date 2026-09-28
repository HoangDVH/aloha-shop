import { useEffect, useState } from "react";
import { fetchCategoryTreeCached, type ShopCategoryNavNode } from "@/lib/api";
import { normPath } from "./catalogLayoutUtils";

export function useCategoryScope(
  pathname: string,
  categoryLocked: boolean,
  selectedNhoms: string[],
  selectedCategoryIds: number[]
) {
  const [slugCategoryIds, setSlugCategoryIds] = useState<number[]>([]);
  const [categoryIdNhoms, setCategoryIdNhoms] = useState<string[]>([]);

  useEffect(() => {
    if (!categoryLocked) {
      setSlugCategoryIds([]);
      return;
    }
    const m = pathname.match(/^\/danh-muc\/([^/?#]+)/);
    if (!m) {
      setSlugCategoryIds([]);
      return;
    }
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* keep */
    }
    let cancelled = false;
    void fetchCategoryTreeCached()
      .then((items) => {
        if (cancelled) return;
        const want = slug.toLowerCase();
        const find = (nodes: ShopCategoryNavNode[]): number | null => {
          for (const n of nodes) {
            if (String(n.slug || "").toLowerCase() === want) return Number(n.id) || null;
            const hit = find(n.subs || []);
            if (hit) return hit;
          }
          return null;
        };
        const id = find(items);
        setSlugCategoryIds(id && id > 0 ? [id] : []);
      })
      .catch(() => {
        if (!cancelled) setSlugCategoryIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryLocked, pathname]);

  const effectiveCategoryIds =
    selectedCategoryIds.length > 0 ? selectedCategoryIds : slugCategoryIds;

  useEffect(() => {
    if (selectedNhoms.length || !effectiveCategoryIds.length) {
      setCategoryIdNhoms([]);
      return;
    }
    let cancelled = false;
    void fetchCategoryTreeCached()
      .then((items) => {
        if (cancelled) return;
        const want = new Set(effectiveCategoryIds);
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
  }, [selectedNhoms.join("|"), effectiveCategoryIds.join(",")]);

  const filterNhoms = selectedNhoms.length ? selectedNhoms : categoryIdNhoms;

  return { effectiveCategoryIds, filterNhoms };
}
