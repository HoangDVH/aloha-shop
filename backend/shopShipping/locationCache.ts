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
  if (na.includes(nb) || nb.includes(na)) return 85;
  const aw = na.split(" ");
  const bw = nb.split(" ");
  const setA = new Set(aw);
  const common = bw.filter((w) => setA.has(w)).length;
  const total = new Set([...aw, ...bw]).size;
  const ratio = common / total;
  return ratio >= 0.5 ? Math.round(ratio * 100) : 0;
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

const CITY_TO_PROVINCE: Record<string, string> = {
  "nha trang": "Khánh Hòa",
  "cam ranh": "Khánh Hòa",
  "ninh hoa": "Khánh Hòa",
  "da lat": "Lâm Đồng",
  "bao loc": "Lâm Đồng",
  "vung tau": "Bà Rịa - Vũng Tàu",
  "ba ria": "Bà Rịa - Vũng Tàu",
  "quy nhon": "Bình Định",
  "an nhon": "Bình Định",
  "buon ma thuot": "Đắk Lắk",
  "bmt": "Đắk Lắk",
  "buon ho": "Đắk Lắk",
  "pleiku": "Gia Lai",
  "an khe": "Gia Lai",
  "ayun pa": "Gia Lai",
  "phan thiet": "Bình Thuận",
  "la gi": "Bình Thuận",
  "phan rang": "Ninh Thuận",
  "thap cham": "Ninh Thuận",
  "bien hoa": "Đồng Nai",
  "long khanh": "Đồng Nai",
  "thu dau mot": "Bình Dương",
  "di an": "Bình Dương",
  "thuan an": "Bình Dương",
  "ben cat": "Bình Dương",
  "tan uyen": "Bình Dương",
  "hue": "Thừa Thiên Huế",
  "ha long": "Quảng Ninh",
  "cam pha": "Quảng Ninh",
  "uong bi": "Quảng Ninh",
  "mong cai": "Quảng Ninh",
  "vinh": "Nghệ An",
  "cua lo": "Nghệ An",
  "thanh hoa": "Thanh Hóa",
  "sam son": "Thanh Hóa",
  "bim son": "Thanh Hóa",
  "rach gia": "Kiên Giang",
  "phu quoc": "Kiên Giang",
  "ha tien": "Kiên Giang",
  "my tho": "Tiền Giang",
  "go cong": "Tiền Giang",
  "ben tre": "Bến Tre",
  "long xuyen": "An Giang",
  "chau doc": "An Giang",
  "ca mau": "Cà Mau",
  "tuy hoa": "Phú Yên",
  "song cau": "Phú Yên",
  "tam ky": "Quảng Nam",
  "hoi an": "Quảng Nam",
  "quang ngai": "Quảng Ngãi",
  "dong hoi": "Quảng Bình",
  "dong ha": "Quảng Trị",
  "ha tinh": "Hà Tĩnh",
  "ky anh": "Hà Tĩnh",
  "nam dinh": "Nam Định",
  "thai binh": "Thái Bình",
  "ninh binh": "Ninh Bình",
  "tam diep": "Ninh Bình",
  "hai duong": "Hải Dương",
  "chi linh": "Hải Dương",
  "hung yen": "Hưng Yên",
  "bac ninh": "Bắc Ninh",
  "tu son": "Bắc Ninh",
  "bac giang": "Bắc Giang",
  "viet yen": "Bắc Giang",
  "vinh yen": "Vĩnh Phúc",
  "phuc yen": "Vĩnh Phúc",
  "viet tri": "Phú Thọ",
  "phu tho": "Phú Thọ",
  "thai nguyen": "Thái Nguyên",
  "song cong": "Thái Nguyên",
  "tuyen quang": "Tuyên Quang",
  "yen bai": "Yên Bái",
  "nghia lo": "Yên Bái",
  "son la": "Sơn La",
  "dien bien": "Điện Biên",
  "dien bien phu": "Điện Biên",
  "lai chau": "Lai Châu",
  "lao cai": "Lào Cai",
  "sa pa": "Lào Cai",
  "ha giang": "Hà Giang",
  "cao bang": "Cao Bằng",
  "lang son": "Lạng Sơn",
  "bac kan": "Bắc Kạn",
  "hoa binh": "Hòa Bình",
  "tan an": "Long An",
  "kien tuong": "Long An",
  "cao lanh": "Đồng Tháp",
  "sa dec": "Đồng Tháp",
  "hong ngu": "Đồng Tháp",
  "vinh long": "Vĩnh Long",
  "binh minh": "Vĩnh Long",
  "tra vinh": "Trà Vinh",
  "duyen hai": "Trà Vinh",
  "soc trang": "Sóc Trăng",
  "nga nam": "Sóc Trăng",
  "vinh chau": "Sóc Trăng",
  "bac lieu": "Bạc Liêu",
  "gia rai": "Bạc Liêu",
  "vi thanh": "Hậu Giang",
  "nga bay": "Hậu Giang",
  "long my": "Hậu Giang",
  "tay ninh": "Tây Ninh",
  "hoa thanh": "Tây Ninh",
  "trang bang": "Tây Ninh",
  "dong xoai": "Bình Phước",
  "binh long": "Bình Phước",
  "phuoc long": "Bình Phước",
  "gia nghia": "Đắk Nông",
  "kon tum": "Kon Tum",
  "thu duc": "Hồ Chí Minh",
  "binh thanh": "Hồ Chí Minh",
  "go vap": "Hồ Chí Minh",
  "tan binh": "Hồ Chí Minh",
  "tan phu": "Hồ Chí Minh",
  "phu nhuan": "Hồ Chí Minh",
  "binh tan": "Hồ Chí Minh",
  "binh chanh": "Hồ Chí Minh",
  "hoc mon": "Hồ Chí Minh",
  "cu chi": "Hồ Chí Minh",
  "nha be": "Hồ Chí Minh",
  "can gio": "Hồ Chí Minh",
  "quan 1": "Hồ Chí Minh",
  "quan 2": "Hồ Chí Minh",
  "quan 3": "Hồ Chí Minh",
  "quan 4": "Hồ Chí Minh",
  "quan 5": "Hồ Chí Minh",
  "quan 6": "Hồ Chí Minh",
  "quan 7": "Hồ Chí Minh",
  "quan 8": "Hồ Chí Minh",
  "quan 9": "Hồ Chí Minh",
  "quan 10": "Hồ Chí Minh",
  "quan 11": "Hồ Chí Minh",
  "quan 12": "Hồ Chí Minh",
  "sai gon": "Hồ Chí Minh",
  "tphcm": "Hồ Chí Minh",
  "hcm": "Hồ Chí Minh",
  "hoan kiem": "Hà Nội",
  "ba dinh": "Hà Nội",
  "dong da": "Hà Nội",
  "cau giay": "Hà Nội",
  "hai ba trung": "Hà Nội",
  "hoang mai": "Hà Nội",
  "thanh xuan": "Hà Nội",
  "long bien": "Hà Nội",
  "nam tu liem": "Hà Nội",
  "bac tu liem": "Hà Nội",
  "tay ho": "Hà Nội",
  "ha dong": "Hà Nội",
  "son tay": "Hà Nội",
  "hn": "Hà Nội",
  "hai chau": "Đà Nẵng",
  "thanh khe": "Đà Nẵng",
  "son tra": "Đà Nẵng",
  "ngu hanh son": "Đà Nẵng",
  "lien chieu": "Đà Nẵng",
  "cam le": "Đà Nẵng",
  "hoa vang": "Đà Nẵng",
  "da nang": "Đà Nẵng",
  "ninh kieu": "Cần Thơ",
  "binh thuy": "Cần Thơ",
  "cai rang": "Cần Thơ",
  "o mon": "Cần Thơ",
  "thot not": "Cần Thơ",
  "can tho": "Cần Thơ",
};

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
    const np = normLoc(province);
    const nd = normLoc(district);
    const nw = normLoc(ward);

    // 1. Tìm tỉnh: nếu province trống hoặc là tên thành phố trực thuộc tỉnh, tìm qua từ điển CITY_TO_PROVINCE
    let targetProvince = province;
    const cleanDist = nd.replace(/^(thanh pho|tp\.?|quan|huyen|thi xa)\s+/i, "").trim();

    const provDirect = provinces.find((p) => normLoc(p.ProvinceName) === np);
    if (provDirect) {
      targetProvince = provDirect.ProvinceName;
    } else {
      const cityKey = CITY_TO_PROVINCE[cleanDist] || CITY_TO_PROVINCE[nd] || CITY_TO_PROVINCE[np];
      if (cityKey) {
        targetProvince = cityKey;
      } else {
        // Tìm thành phố trong chuỗi địa chỉ đầy đủ (VD: "31 su van hanh vinh hai nha trang")
        for (const [k, pName] of Object.entries(CITY_TO_PROVINCE)) {
          if (nd.endsWith(k) || nd.includes(` ${k}`) || nd.includes(`${k} `)) {
            targetProvince = pName;
            break;
          }
        }
      }
    }

    const normTargetProv = normLoc(targetProvince);
    if (!normTargetProv || normTargetProv.length < 2) return null;

    const prov =
      provinces.find((p) => normLoc(p.ProvinceName) === normTargetProv) ||
      provinces.find((p) => scoreMatch(targetProvince, p.ProvinceName) >= 50);

    if (!prov) return null;

    // 2. Tìm quận/huyện
    const districts = await listGhnDistricts(prov.ProvinceID);
    const dist =
      districts.find((d) => normLoc(d.DistrictName) === cleanDist || normLoc(d.DistrictName) === nd) ||
      districts.find((d) => nd.includes(normLoc(d.DistrictName))) ||
      districts.find((d) => scoreMatch(district, d.DistrictName) >= 50) ||
      districts.find((d) => scoreMatch(ward, d.DistrictName) >= 50) ||
      null;

    // TUYỆT ĐỐI KHÔNG fallback districts[0] nếu không khớp
    if (!dist) {
      return {
        provinceId: prov.ProvinceID,
        districtId: 0,
        wardCode: "",
        provinceName: prov.ProvinceName,
        districtName: district,
        wardName: ward,
      };
    }

    // 3. Tìm phường/xã
    const cleanWard = nw.replace(/^(phuong|xa|thi tran|p\.?)\s+/i, "").trim();
    const wards = await listGhnWards(dist.DistrictID);
    const w =
      wards.find((x) => normLoc(x.WardName) === cleanWard || normLoc(x.WardName) === nw) ||
      wards.find((x) => (nw && scoreMatch(ward, x.WardName) >= 50) || (nd && nd.includes(normLoc(x.WardName)))) ||
      null;

    // TUYỆT ĐỐI KHÔNG fallback wards[0] nếu không khớp
    return {
      provinceId: prov.ProvinceID,
      districtId: dist.DistrictID,
      wardCode: w ? w.WardCode : "",
      provinceName: prov.ProvinceName,
      districtName: dist.DistrictName,
      wardName: w ? w.WardName : ward,
    };
  } catch (e) {
    console.warn("[shopShipping] resolveGhnLocation:", e);
    return null;
  }
}

export { normLoc };
