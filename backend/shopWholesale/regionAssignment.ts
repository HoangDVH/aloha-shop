import snapshot from "../shopShipping/addressMigration/snapshot.json";
import { normalizeAddressUnit } from "../shopShipping/addressMigration/convert.js";
import type { SiRegion } from "./policy.js";
import { historicalHcmPairs, HISTORICAL_HCM_BOUNDARY_VERSION } from "./historicalHcmBoundary.js";

type Address = { province: string; district?: string; ward: string };
type Legacy = [string, string, string, string, string[], boolean];
const data = snapshot as unknown as { metadata: { version: string }; provinces: string[][]; wards: string[][]; legacy: Legacy[] };
const norm = (value: string) => normalizeAddressUnit(value.replace(/^tp\s+/i, ""));
const hcm = norm("Hồ Chí Minh");
const provinces = new Map(data.provinces.map(([code, name]) => [code, norm(name)]));
const provinceByWard = new Map(data.wards.map(([code, province]) => [code, provinces.get(province)]));
const knownProvinces = new Set([...provinces.values(), ...data.legacy.map(row => norm(row[0]))]);
const wardOrigins = new Map<string, Legacy[]>();
const legacyByDistrictWard = new Map<string, Legacy[]>();
const key = (district: string, ward: string) => `${norm(district)}|${norm(ward)}`;
const historicalPairs = historicalHcmPairs(key);
for (const row of data.legacy) {
  const k = key(row[1], row[2]);
  legacyByDistrictWard.set(k, [...(legacyByDistrictWard.get(k) || []), row]);
  for (const code of row[4]) wardOrigins.set(code, [...(wardOrigins.get(code) || []), row]);
}
const currentHcmWards = new Map<string, string[]>();
for (const [code, province, name] of data.wards) {
  if (provinces.get(province) !== hcm) continue;
  currentHcmWards.set(norm(name), [...(currentHcmWards.get(norm(name)) || []), code]);
}
function originRegion(rows: Legacy[]): SiRegion | null {
  const regions = new Set(rows.map(row => norm(row[0]) === hcm ? "HCM" : "TINH"));
  return regions.size === 1 ? [...regions][0] as SiRegion : null;
}

/** Business boundary: pre-merger HCM only. New HCM province names alone prove nothing. */
export function assignWholesaleRegion(address: Address) {
  const base = { policy: "hcm_pre_merger_v1", datasetVersion: data.metadata.version };
  const province = norm(address.province);
  if (!knownProvinces.has(province)) return { ...base, region: null, basis: "needs_review" };
  if (province !== hcm) return { ...base, region: "TINH" as SiRegion, basis: "outside_old_hcm" };
  const district = address.district?.trim();
  if (district) {
    if (historicalPairs.has(key(district, address.ward))) {
      return { ...base, region: "HCM" as SiRegion, basis: "historical_district_ward", historicalVersion: HISTORICAL_HCM_BOUNDARY_VERSION };
    }
    // Accept old administrative names, including districts now under enlarged HCM.
    const legacy = (legacyByDistrictWard.get(key(district, address.ward)) || [])
      .filter(row => norm(row[0]) === hcm || row[4].some(code => provinceByWard.get(code) === hcm));
    const region = originRegion(legacy);
    if (region) return { ...base, region, basis: "legacy_district_ward" };
  }
  const codes = currentHcmWards.get(norm(address.ward)) || [];
  if (codes.length !== 1) return { ...base, region: null, basis: "needs_review" };
  const rows = wardOrigins.get(codes[0]) || [];
  if (district && !rows.some(row => norm(row[1]) === norm(district))) {
    return { ...base, region: null, basis: "needs_review" };
  }
  // Mixed/unknown origins fail closed, including partial mappings across the business boundary.
  return { ...base, region: originRegion(rows), basis: rows.length ? "current_ward_origins" : "needs_review", wardCode: codes[0] };
}
