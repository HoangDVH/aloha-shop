/**
 * Vùng giao hàng dùng cho voucher hỗ trợ phí ship (docs/KE_HOACH_UU_DAI_VOUCHER.md mục 24.7.1).
 * Lưu tại `config` { id/key: "shipping_regions", regions: [...] }; thiếu cấu hình thì dùng vùng mặc định.
 * Vùng xác định theo quận/huyện, không theo tên tỉnh: TP.HCM mới (sau 01/07/2025) gồm cả Bình Dương
 * và Bà Rịa – Vũng Tàu cũ, những địa chỉ đó không thuộc vùng "hcm_pre_2025".
 */
import type { Db } from "mongodb";

export const SHIPPING_REGIONS_CONFIG_ID = "shipping_regions";
/** Vùng ảo: mọi địa chỉ giao tận nơi đều khớp, không cần cấu hình quận/huyện. */
export const NATIONWIDE_REGION_ID = "toan_quoc";
const MEM_TTL_MS = 30_000;

export type ShippingRegion = {
  id: string;
  name: string;
  version: number;
  provinceAliases: string[];
  districtNames: string[];
  ghnDistrictIds?: number[];
};

export type RegionMatch =
  | { status: "matched"; regionId: string; regionVersion: number; source: "ghn_district" | "name" | "nationwide" }
  | { status: "outside"; reason: string }
  | { status: "unknown"; reason: string };

export const DEFAULT_SHIPPING_REGIONS: ShippingRegion[] = [
  {
    id: "hcm_pre_2025",
    name: "TP.HCM (ranh giới trước 01/07/2025)",
    version: 1,
    provinceAliases: ["ho chi minh", "hcm", "sai gon"],
    districtNames: [
      "quan 1", "quan 2", "quan 3", "quan 4", "quan 5", "quan 6", "quan 7", "quan 8",
      "quan 9", "quan 10", "quan 11", "quan 12",
      "binh tan", "binh thanh", "go vap", "phu nhuan", "tan binh", "tan phu", "thu duc",
      "binh chanh", "can gio", "cu chi", "hoc mon", "nha be",
    ],
  },
];

export function normalizePlaceName(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalProvince(raw: string): string {
  return normalizePlaceName(raw)
    .replace(/^(thanh pho|tp|tinh)\s+/, "")
    .trim();
}

/** "Quận 1" giữ "quan 1"; "Quận Bình Thạnh" → "binh thanh"; "Thành Phố Thủ Đức" → "thu duc". */
export function canonicalDistrict(raw: string): string {
  const s = normalizePlaceName(raw).replace(/^(thanh pho|tp|huyen|thi xa)\s+/, "");
  const q = s.match(/^quan\s+(.+)$/);
  if (!q) return s;
  return /^\d+$/.test(q[1]) ? `quan ${Number(q[1])}` : q[1];
}

function parseRegions(raw: unknown): ShippingRegion[] {
  if (!Array.isArray(raw)) return [];
  const out: ShippingRegion[] = [];
  for (const r of raw) {
    const id = String((r as any)?.id || "").trim();
    const districtNames = Array.isArray((r as any)?.districtNames)
      ? (r as any).districtNames.map((d: unknown) => canonicalDistrict(String(d))).filter(Boolean)
      : [];
    if (!id || !districtNames.length) continue;
    out.push({
      id,
      name: String((r as any)?.name || id),
      version: Math.max(1, Math.floor(Number((r as any)?.version) || 1)),
      provinceAliases: Array.isArray((r as any)?.provinceAliases)
        ? (r as any).provinceAliases.map((p: unknown) => canonicalProvince(String(p))).filter(Boolean)
        : [],
      districtNames,
      ghnDistrictIds: Array.isArray((r as any)?.ghnDistrictIds)
        ? (r as any).ghnDistrictIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
        : [],
    });
  }
  return out;
}

let memAt = 0;
let memRegions: ShippingRegion[] | null = null;

export async function loadShippingRegions(db: Db): Promise<ShippingRegion[]> {
  const now = Date.now();
  if (memRegions && now - memAt < MEM_TTL_MS) return memRegions;
  const doc = await db
    .collection("config")
    .findOne({ id: SHIPPING_REGIONS_CONFIG_ID }, { projection: { regions: 1 } });
  const parsed = parseRegions(doc?.regions);
  memRegions = parsed.length ? parsed : DEFAULT_SHIPPING_REGIONS;
  memAt = now;
  return memRegions;
}

export function matchShippingRegion(
  region: ShippingRegion,
  address: { province?: string; district?: string; ghnDistrictId?: number | null }
): RegionMatch {
  const ghnId = Number(address.ghnDistrictId) || 0;
  if (ghnId && region.ghnDistrictIds?.includes(ghnId)) {
    return { status: "matched", regionId: region.id, regionVersion: region.version, source: "ghn_district" };
  }
  const province = canonicalProvince(address.province || "");
  if (!province) {
    return { status: "unknown", reason: "Chưa xác định được khu vực — vui lòng chọn lại tỉnh/thành" };
  }
  const aliases = region.provinceAliases.map(canonicalProvince);
  if (aliases.length && !aliases.includes(province)) {
    return { status: "outside", reason: `Chỉ áp dụng cho đơn giao tới ${region.name}` };
  }
  const district = canonicalDistrict(address.district || "");
  if (!district) {
    return { status: "unknown", reason: "Chưa xác định được khu vực — vui lòng chọn lại quận/huyện, phường/xã" };
  }
  if (region.districtNames.map(canonicalDistrict).includes(district)) {
    return { status: "matched", regionId: region.id, regionVersion: region.version, source: "name" };
  }
  return { status: "outside", reason: `Chỉ áp dụng cho đơn giao tới ${region.name}` };
}

export function matchRegionById(
  regions: ShippingRegion[],
  regionId: string,
  address: { province?: string; district?: string; ghnDistrictId?: number | null }
): RegionMatch {
  if (regionId === NATIONWIDE_REGION_ID) {
    return { status: "matched", regionId, regionVersion: 1, source: "nationwide" };
  }
  const region = regions.find((r) => r.id === regionId);
  if (!region) return { status: "outside", reason: "Vùng áp dụng của ưu đãi chưa được cấu hình." };
  return matchShippingRegion(region, address);
}
