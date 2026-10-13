/** Apply the absolute offer positions configured by admin; keep other products in source order. */
export function placeDealPins<T extends { webBadge?: string; webPin?: number }>(list: T[]): T[] {
  const pinned = new Map<number, T>();
  const rest: T[] = [];
  for (const p of list) {
    const n = p.webBadge === "uu_dai" ? Math.round(Number(p.webPin) || 0) : 0;
    if (Number.isFinite(n) && n > 0 && !pinned.has(n)) pinned.set(n, p);
    else rest.push(p);
  }
  if (!pinned.size) return [...list];
  const out: T[] = [];
  let u = 0;
  // Empty positions are skipped once all unpinned products have been placed.
  for (const slot of [...pinned.keys()].sort((a, b) => a - b)) {
    while (out.length < slot - 1 && u < rest.length) out.push(rest[u++]);
    out.push(pinned.get(slot)!);
  }
  return [...out, ...rest.slice(u)];
}
