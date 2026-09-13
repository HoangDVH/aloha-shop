export type GhnProvince = { id: number; name: string };
export type GhnDistrict = { id: number; provinceId: number; name: string };
export type GhnWard = { code: string; districtId: number; name: string };

async function locFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchGhnProvinces(): Promise<{ ok: boolean; source: string; items: GhnProvince[] }> {
  return locFetch("/api/shop/shipping/locations/provinces");
}

export async function fetchGhnDistricts(
  provinceId: number
): Promise<{ ok: boolean; items: GhnDistrict[] }> {
  return locFetch(`/api/shop/shipping/locations/districts?provinceId=${provinceId}`);
}

export async function fetchGhnWards(
  districtId: number
): Promise<{ ok: boolean; items: GhnWard[] }> {
  return locFetch(`/api/shop/shipping/locations/wards?districtId=${districtId}`);
}

export type CheckoutAddressValue = {
  province: string;
  district: string;
  ward: string;
  ghnProvinceId: number;
  ghnDistrictId: number;
  ghnWardCode: string;
};

export const EMPTY_CHECKOUT_ADDRESS: CheckoutAddressValue = {
  province: "",
  district: "",
  ward: "",
  ghnProvinceId: 0,
  ghnDistrictId: 0,
  ghnWardCode: "",
};
