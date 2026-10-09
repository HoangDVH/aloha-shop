import { giftFilterLabel } from "@/lib/giftFilters";
import { useMemo } from "react";
import { formatVnd } from "@/lib/api";
import { leafLabel } from "./catalogLayoutUtils";

export function useActiveFilters({
  categoryLocked,
  selectedNhoms,
  selectedAttrs,
  selectedDvts,
  minPrice,
  maxPrice,
  gift = "",
  pushNhoms,
  removeAttr,
  removeDvt,
  pushParams,
}: {
  categoryLocked: boolean;
  selectedNhoms: string[];
  selectedAttrs: string[];
  selectedDvts: string[];
  minPrice: string;
  maxPrice: string;
  gift?: string;
  pushNhoms: (paths: string[]) => void;
  removeAttr: (value: string) => void;
  removeDvt: (value: string) => void;
  pushParams: (patch: Record<string, string | null>) => void;
}) {
  const secondaryFilterCount = useMemo(() => {
    let n = 0;
    if (!categoryLocked && selectedNhoms.length) n += selectedNhoms.length;
    n += selectedAttrs.length;
    n += selectedDvts.length;
    if (minPrice || maxPrice) n += 1;
    if (gift) n += 1;
    return n;
  }, [
    categoryLocked,
    selectedNhoms.length,
    selectedAttrs.length,
    selectedDvts.length,
    minPrice,
    maxPrice,
    gift,
  ]);

  const activeFilters = useMemo(() => {
    const tags: { key: string; label: string; clear: () => void }[] = [];
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
    if (gift) tags.push({ key: "gift", label: giftFilterLabel(gift), clear: () => pushParams({ gift: null }) });
    return tags;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoryLocked,
    selectedNhoms.join("|"),
    selectedAttrs,
    selectedDvts,
    minPrice,
    maxPrice,
    gift,
  ]);

  return { secondaryFilterCount, activeFilters };
}
