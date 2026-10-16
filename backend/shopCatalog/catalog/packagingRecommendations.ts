/**
 * Reviewed on 2026-10-16 against the public catalog and packaging-fit audit.
 * Dimension-reviewed defaults use whole-plant dimensions, never pot size alone.
 * Allow 2cm total horizontal clearance and 3cm above the plant.
 * User confirmed H3/H4/H5 dimensions are usable gusset × width × height.
 *
 * PTNTS: 14 × 14 × 21cm overall → H5 16 × 28 × 42, square 21 × 31,
 *        or round diameter 30 × height 35 (pot diagonal also fits).
 * TPTTCT: canopy ≤18, height ≤28cm → square 21 × 31 or round 30 × 35.
 * TPVLDB: canopy ≤20, height ≤30cm → round 30 × 35 only.
 * History-reviewed additions below are purchase associations, not measured fit.
 * These defaults augment catalog attachments without writing to MongoDB.
 */
const REVIEWED_PACKAGING: Readonly<Record<string, readonly string[]>> = {
  PTNTS: ["TNTSH5", "HKV21X31", "HKT30X35"],
  TPTTCT: ["HKV21X31", "HKT30X35"],
  TPVLDB: ["HKT30X35"],
};

/**
 * KiotViet 2025-10-16 through 2026-10-16: completed invoices with one
 * finished-plant SKU, one packaging SKU and matching quantities. See
 * docs/PACKAGING_PURCHASE_HISTORY.md for source invoice references.
 * Do not infer packaging allocations from multi-plant or mismatched-quantity orders.
 */
const PURCHASE_HISTORY_PACKAGING: Readonly<Record<string, readonly string[]>> = {
  CBCTAN: ["HKT32X46", "TKV31"],
  CBDLHP: ["TNTSH4"],
  CBDVAN: ["TKV31"],
  CBDVDP: ["TVTDDL"],
  CBDVPL: ["TNTSH4"],
  CBDVTU: ["TGMK", "TNTSH4", "TVTDDL"],
  CBHPMM: ["TNTSH4"],
  CBKNPL: ["TNTSH4"],
  CBKNTV: ["TGMK"],
  CBKTAN: ["TNTSH3", "TGMK"],
  CBKTTL: ["TGMK"],
  CBPTPQ: ["TGMK"],
  CBPTTT: ["TGMK"],
  CBVMHN: ["TGMK"],
  KN3GMOB: ["TGMK"],
  KNCT: ["TGMK"],
  KNHP: ["TGMK"],
  KTMM: ["TNTSH3", "TGMK"],
  KTPT: ["TKV31"],
  LYTS28: ["TCK60L"],
  TP160: ["TGMK"],
  TP80: ["TVMN"],
  TPKGCT: ["TNTSH4"],
  TPKNAK: ["TGMK"],
  TPKTNY: ["TGMK"],
  TPKTTV: ["TCK60L", "TGMK", "TNTSH4"],
  TPLCTC: ["TGMK"],
  TPPTNY: ["TGMK"],
  TPPTSL01: ["TKV31"],
  TPTCGS: ["TVMN"],
  TPTNCT: ["TGMK"],
  TPTSDC: ["TVMN"],
  TPTSDL: ["TVMN"],
  TPTTCT: ["TGMK", "TNTSH3"],
  TPTTP: ["TCK61"],
  TPXRMN: ["TVMN"],
  XRMT20: ["TCK60S"],
};

export function withPackagingRecommendations(ma: string, existing: string[]): string[] {
  const key = ma.trim().toUpperCase();
  const suggested = [
    ...(Object.hasOwn(REVIEWED_PACKAGING, key) ? REVIEWED_PACKAGING[key] : []),
    ...(Object.hasOwn(PURCHASE_HISTORY_PACKAGING, key) ? PURCHASE_HISTORY_PACKAGING[key] : []),
  ];
  if (!suggested.length) return existing;
  const seen = new Set<string>([key]);
  return [...existing, ...suggested].filter((code) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
