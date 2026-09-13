/** GHN master-data — cache từng tầng, gọi theo yêu cầu (dropdown checkout). */

export type GhnProvince = { ProvinceID: number; ProvinceName: string };
export type GhnDistrict = { DistrictID: number; ProvinceID: number; DistrictName: string };
export type GhnWard = { WardCode: string; DistrictID: number; WardName: string };

export type GhnLocationMatch = {
  provinceId: number;
  districtId: number;
  wardCode: string;
  provinceName: string;
  districtName: string;
  wardName: string;
};

const GHN_API = "https://online-gateway.ghn.vn/shiip/public-api/master-data";
const CACHE_MS = 24 * 60 * 60 * 1000;

let provincesCache: { at: number; items: GhnProvince[] } | null = null;
const districtsCache = new Map<number, { at: number; items: GhnDistrict[] }>();
const wardsCache = new Map<number, { at: number; items: GhnWard[] }>();

export function ghnToken(): string {
  return String(process.env.GHN_TOKEN || "").trim();
}

function normLoc(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?|quan|huyen|thi xa|phuong|xa|thi tran)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(a: string, b: string): number {
  const na = normLoc(a);
  const nb = normLoc(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const aw = new Set(na.split(" "));
  const bw = nb.split(" ");
  let hit = 0;
  for (const w of bw) if (aw.has(w)) hit++;
  return hit > 0 ? 40 + hit * 10 : 0;
}

async function ghnFetch<T>(path: string, token: string): Promise<T[]> {
  const res = await fetch(`${GHN_API}${path}`, {
    headers: { Token: token, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T[]; code?: number; message?: string };
  if (!res.ok || (json.code != null && json.code !== 200)) {
    throw new Error(json.message || `GHN master-data ${path} failed`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

export async function listGhnProvinces(): Promise<GhnProvince[]> {
  const token = ghnToken();
  if (!token) throw new Error("Chưa cấu hình GHN_TOKEN");
  const now = Date.now();
  if (provincesCache && now - provincesCache.at < CACHE_MS) return provincesCache.items;
  const items = await ghnFetch<GhnProvince>("/province", token);
  provincesCache = { at: now, items };
  return items;
}

export async function listGhnDistricts(provinceId: number): Promise<GhnDistrict[]> {
  const token = ghnToken();
  if (!token) throw new Error("Chưa cấu hình GHN_TOKEN");
  const pid = Math.floor(provinceId);
  if (!pid) return [];
  const now = Date.now();
  const hit = districtsCache.get(pid);
  if (hit && now - hit.at < CACHE_MS) return hit.items;
  const items = await ghnFetch<GhnDistrict>(`/district?province_id=${pid}`, token);
  districtsCache.set(pid, { at: now, items });
  return items;
}

export async function listGhnWards(districtId: number): Promise<GhnWard[]> {
  const token = ghnToken();
  if (!token) throw new Error("Chưa cấu hình GHN_TOKEN");
  const did = Math.floor(districtId);
  if (!did) return [];
  const now = Date.now();
  const hit = wardsCache.get(did);
  if (hit && now - hit.at < CACHE_MS) return hit.items;
  const items = await ghnFetch<GhnWard>(`/ward?district_id=${did}`, token);
  wardsCache.set(did, { at: now, items });
  return items;
}

/** Fuzzy match khi chỉ có tên (địa chỉ cũ). */
export function matchGhnLocationOffline(
  province: string,
  district: string,
  ward: string,
  data: { provinces: GhnProvince[]; districts: GhnDistrict[]; wards: GhnWard[] }
): GhnLocationMatch | null {
  let bestProv: GhnProvince | null = null;
  let bestProvScore = 0;
  for (const p of data.provinces) {
    const sc = scoreMatch(province, p.ProvinceName);
    if (sc > bestProvScore) {
      bestProvScore = sc;
      bestProv = p;
    }
  }
  if (!bestProv || bestProvScore < 40) return null;

  const dists = data.districts.filter((d) => d.ProvinceID === bestProv!.ProvinceID);
  let bestDist: GhnDistrict | null = null;
  let bestDistScore = 0;
  for (const d of dists) {
    const sc = Math.max(scoreMatch(district, d.DistrictName), scoreMatch(ward, d.DistrictName) * 0.6);
    if (sc > bestDistScore) {
      bestDistScore = sc;
      bestDist = d;
    }
  }
  if (!bestDist && dists.length) bestDist = dists[0];
  if (!bestDist) return null;

  let bestWard: GhnWard | null = null;
  let bestWardScore = 0;
  for (const w of data.wards.filter((x) => x.DistrictID === bestDist!.DistrictID)) {
    const sc = scoreMatch(ward, w.WardName);
    if (sc > bestWardScore) {
      bestWardScore = sc;
      bestWard = w;
    }
  }
  if (!bestWard) {
    bestWard = data.wards.find((w) => w.DistrictID === bestDist!.DistrictID) || null;
  }
  if (!bestWard) return null;

  return {
    provinceId: bestProv.ProvinceID,
    districtId: bestDist.DistrictID,
    wardCode: bestWard.WardCode,
    provinceName: bestProv.ProvinceName,
    districtName: bestDist.DistrictName,
    wardName: bestWard.WardName,
  };
}

export async function resolveGhnLocation(
  province: string,
  district: string,
  ward: string,
  ids?: { districtId?: number; wardCode?: string }
): Promise<GhnLocationMatch | null> {
  if (ids?.districtId && ids?.wardCode) {
    return {
      provinceId: 0,
      districtId: ids.districtId,
      wardCode: ids.wardCode,
      provinceName: province,
      districtName: district,
      wardName: ward,
    };
  }
  const token = ghnToken();
  if (!token) return null;
  try {
    const provinces = await listGhnProvinces();
    const prov =
      provinces.find((p) => scoreMatch(province, p.ProvinceName) >= 40) ||
      provinces.find((p) => normLoc(p.ProvinceName).includes(normLoc(province).slice(0, 6)));
    if (!prov) return null;
    const districts = await listGhnDistricts(prov.ProvinceID);
    const dist =
      districts.find((d) => scoreMatch(district, d.DistrictName) >= 40) ||
      districts.find((d) => scoreMatch(ward, d.DistrictName) >= 40) ||
      districts[0];
    if (!dist) return null;
    const wards = await listGhnWards(dist.DistrictID);
    const w =
      wards.find((x) => scoreMatch(ward, x.WardName) >= 40) || wards[0];
    if (!w) return null;
    return {
      provinceId: prov.ProvinceID,
      districtId: dist.DistrictID,
      wardCode: w.WardCode,
      provinceName: prov.ProvinceName,
      districtName: dist.DistrictName,
      wardName: w.WardName,
    };
  } catch (e) {
    console.warn("[shopShipping] resolveGhnLocation:", e);
    return null;
  }
}

export { normLoc };
