const code = value => String(value ?? '').trim().toUpperCase();
export const identity = p => {
  const raw = p.id ?? p.kvId;
  if (typeof raw === 'number' && !Number.isSafeInteger(raw)) return '';
  const id = String(raw ?? '').trim();
  return /^[1-9]\d*$/.test(id) && p.source === 'kiotviet' ? id : '';
};

/** Validate the entire batch before any writes; simulate updates for identical dry-run results. */
export function planProductSync(source, destination) {
  const byCode = new Map(), byId = new Map();
  for (const original of destination) {
    const p = { ...original }, ma = code(p.ma), id = identity(p);
    if (byCode.has(ma)) throw new Error('Duplicate destination code: ' + ma);
    byCode.set(ma, p);
    if (id && !p.mergedInto) {
      if (byId.has(id)) throw new Error('Ambiguous destination identity: ' + id);
      byId.set(id, p);
    }
  }
  const actions = [], seenCodes = new Set(), seenIds = new Set();
  for (const sp of source) {
    const ma = code(sp.ma), id = identity(sp);
    if (!ma) continue;
    if (seenCodes.has(ma) || (id && seenIds.has(id))) throw new Error('Duplicate source identity: ' + ma);
    seenCodes.add(ma);
    if (id) seenIds.add(id);
    const owner = byCode.get(ma), existing = (id && byId.get(id)) || owner;
    if (owner?.mergedInto || existing?.mergedInto || (existing && code(existing.ma) !== ma
      && (existing.kvCodeAliases || []).map(code).includes(ma))) continue;
    if (existing && owner && owner !== existing) throw new Error('Occupied destination code: ' + ma);
    if (existing && id && identity(existing) && identity(existing) !== id) throw new Error('KiotViet identity collision: ' + ma);
    actions.push({ sp, ma, existing: existing ? { ...existing } : undefined });
    const next = existing || { ...sp, ma };
    if (existing && code(existing.ma) !== ma) {
      next.kvCodeAliases = [...new Set([...(existing.kvCodeAliases || []), existing.ma].map(code))].filter(m => m !== ma);
      next.ma = ma;
    }
    byCode.set(ma, next);
    if (id) byId.set(id, next);
  }
  return actions;
}
