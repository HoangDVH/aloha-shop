/**
 * Ghim vị trí tuyệt đối trong một nhãn (scope).
 * Không dùng field DB mới — chỉ webPin + webBadge trên item.
 */
import { normalizeWebBadge } from "./webBadge.js";

export type Pinable = {
  webPin?: number;
  webBadge?: string;
};

/**
 * @param pinBadgeScope nhãn đang xếp (vd ban_chay_sap_het). null/"" = không áp ghim.
 */
export function arrangeByAbsolutePin<T extends Pinable>(
  items: T[],
  secondaryCompare: (a: T, b: T) => number,
  pinBadgeScope?: string | null
): T[] {
  const scope = normalizeWebBadge(pinBadgeScope || "");
  const effectivePin = (p: T): number => {
    if (!scope) return 0;
    if (normalizeWebBadge(p.webBadge) !== scope) return 0;
    const n = Math.round(Number(p.webPin));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const pinMap = new Map<number, T>();
  const unpinned: T[] = [];
  for (const p of items) {
    const n = effectivePin(p);
    if (n > 0) {
      if (!pinMap.has(n)) pinMap.set(n, p);
      else unpinned.push(p);
    } else {
      unpinned.push(p);
    }
  }
  unpinned.sort(secondaryCompare);

  if (!pinMap.size) return unpinned;

  const out: T[] = [];
  let u = 0;
  const maxPin = Math.max(...pinMap.keys());
  for (let slot = 1; slot <= maxPin; slot++) {
    const hit = pinMap.get(slot);
    if (hit) out.push(hit);
    else if (u < unpinned.length) out.push(unpinned[u++]);
  }
  while (u < unpinned.length) out.push(unpinned[u++]);
  return out;
}

/** Scope ghim theo query sort/badge (storefront). */
export function resolvePinBadgeScope(opts: {
  sort?: string;
  badge?: string;
  maxTon?: number;
}): string {
  const badge = normalizeWebBadge(opts.badge || "");
  if (badge) return badge;
  const sort = String(opts.sort || "").trim();
  if (sort === "ban_chay" || (Number(opts.maxTon) > 0 && sort === "ban_chay")) {
    return "ban_chay_sap_het";
  }
  if (sort === "ban_chay") return "ban_chay_sap_het";
  if (sort === "giam_gia") return "giam_gia";
  if (sort === "moi" || sort === "newest") return "moi";
  // giá / tên: không ghim theo nhãn
  return "";
}
