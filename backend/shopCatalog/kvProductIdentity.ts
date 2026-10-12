import type { Db } from "mongodb";

export function kvProductId(doc: Record<string, any>): string {
  const raw = doc.id ?? doc.Id ?? doc.kvId;
  if (typeof raw === "number" && !Number.isSafeInteger(raw)) return "";
  const value = String(raw ?? "").trim();
  return /^[1-9]\d*$/.test(value) ? value : "";
}
const code = (value: unknown) => String(value || "").trim().toUpperCase();

export function planKvIdentity(docs: Record<string, any>[], live: Record<string, any>) {
  const id = kvProductId(live), ma = String(live.code ?? live.Code ?? live.ma ?? "").trim();
  if (!id || !ma) throw new Error("invalid_kv_identity");
  const family = docs.filter(d => d.source === "kiotviet" && kvProductId(d) === id);
  const canonical = family.find(d => code(d.ma) === code(ma) && !d.mergedInto)
    || family.find(d => !d.mergedInto) || family.find(d => code(d.ma) === code(ma));
  if (!canonical) return null;
  const aliases = family.filter(d => d !== canonical);
  const aliasCodes = [...new Set(family.flatMap(d => [d.ma, ...(Array.isArray(d.kvCodeAliases) ? d.kvCodeAliases : [])])
    .map(code).filter(m => m && m !== code(ma)))];
  const set: Record<string, unknown> = { ma, isActive: live.isActive !== false, kvCodeAliases: aliasCodes };
  // Preserve CMS data, never add inventories or prices together across duplicate IDs.
  for (const key of ["description", "seoTitle", "seoDescription", "videoUrl", "anh"]) {
    if (!canonical[key]) {
      const previous = family.find(d => d[key]);
      if (previous) set[key] = previous[key];
    }
  }
  for (const key of ["videos", "images", "attachedItems"]) {
    const values = [...new Set(family.flatMap(d => Array.isArray(d[key]) ? d[key] : []))];
    if (values.length) set[key] = values;
  }
  if (!canonical.webBadge) {
    const previous = family.find(d => d.webBadge);
    if (previous) { set.webBadge = previous.webBadge; set.webPin = previous.webPin || 0; }
  } else if (!canonical.webPin) {
    const previous = family.find(d => d.webBadge === canonical.webBadge && d.webPin);
    if (previous) set.webPin = previous.webPin;
  }
  for (const [badge, pin] of [["webSiFeatured", "webSiFeaturedPin"], ["webSiDeals", "webSiDealsPin"]]) {
    if (canonical[badge] === undefined) {
      const previous = family.find(d => d[badge] !== undefined);
      if (previous) { set[badge] = previous[badge]; set[pin] = previous[pin] || 0; }
    }
  }
  if (family.some(d => !d.mergedInto && d.hienThiWeb === false)) set.hienThiWeb = false;
  return { id, ma, canonical, aliases, aliasCodes, set };
}

/** Reconcile only identities present in a verified KV response, including delta responses. */
export async function reconcileKvIdentities(db: Db, liveProducts: Record<string, any>[]) {
  const col = db.collection("aloha_products");
  await col.createIndex({ id: 1, source: 1 }, { name: "kv_product_identity" });
  await col.createIndex({ kvCodeAliases: 1 }, { name: "kv_code_aliases", sparse: true });
  const byId = new Map<string, Record<string, any>>(), ambiguous = new Set<string>();
  for (const p of liveProducts) {
    const id = kvProductId(p);
    if (!id) continue;
    if (byId.has(id) && code(byId.get(id)?.code ?? byId.get(id)?.ma) !== code(p.code ?? p.ma)) ambiguous.add(id);
    byId.set(id, p);
  }
  const changed: string[] = [];
  const lookupIds = [...byId.keys()].flatMap(id => Number.isSafeInteger(Number(id)) ? [id, Number(id)] : [id]);
  const all = await col.find({ source: "kiotviet", $or: [{ id: { $in: lookupIds } }, { kvId: { $in: lookupIds } }] }).toArray();
  for (const [id, live] of byId) {
    if (ambiguous.has(id)) throw new Error(`ambiguous_kv_identity:${id}`);
    const family = all.filter(d => kvProductId(d) === id);
    if (!family.length || (family.length === 1 && code(family[0].ma) === code(live.code ?? live.ma))) continue;
    const plan = planKvIdentity(family, live);
    if (!plan) continue;
    if (code(plan.canonical.ma) === code(plan.ma) && !plan.canonical.mergedInto
      && plan.aliases.every(d => d.mergedInto === plan.ma && d.isActive === false && d.hienThiWeb === false)
      && plan.aliasCodes.every(m => plan.canonical.kvCodeAliases?.includes(m))) continue;
    const collision = await col.findOne({ ma: plan.ma, _id: { $nin: family.map(d => d._id) } });
    if (collision) throw new Error(`kv_code_collision:${id}`);
    const held = await db.collection("aloha_shop_stock_holds").countDocuments({ ma: { $in: plan.aliasCodes }, status: "held",
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    if (held) throw new Error(`kv_rename_has_active_holds:${id}`);
    const now = new Date().toISOString();
    // Canonical is prepared first. A retry can complete retiring the old rows after interruption.
    await col.updateOne({ _id: plan.canonical._id }, {
      $set: { ...plan.set, kvIdentityReconciledAt: now }, $unset: { mergedInto: "" },
    });
    for (const old of plan.aliases) {
      await col.updateOne({ _id: old._id }, { $set: {
        mergedInto: plan.ma, isActive: false, hienThiWeb: false,
        kvIdentityMergedAt: now, kvIdentityMergeReason: "same_kiotviet_id",
      } });
    }
    changed.push(...family.map(d => String(d.ma)), plan.ma);
  }
  return [...new Set(changed)];
}
