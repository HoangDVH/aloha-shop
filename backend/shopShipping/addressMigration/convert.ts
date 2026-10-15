import snapshot from "./snapshot.json";

export type AddressParts = { province: string; district?: string; ward: string; streetAddress?: string };
export type AddressMigration = {
  state: "converted" | "already_current" | "needs_review";
  original: AddressParts;
  current?: { province: string; ward: string; provinceCode: string; wardCode: string };
  candidates?: Array<{ province: string; ward: string }>;
  reason?: string;
  source: string;
  version: string;
};
type Snapshot = { metadata: { source: string; version: string }; provinces: string[][]; wards: string[][];
  legacy: Array<[string, string, string, string, string[], boolean]> };
const data = snapshot as unknown as Snapshot;
export function normalizeAddressUnit(s: string): string {
  let value = String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim()
    .replace(/^(thanh pho|thi tran|thi xa|phuong|huyen|tinh|quan|xa)\s+/, "")
    .replace(/^(tp|tx|tt|q|p|h)\.\s*/, "").replace(/\s+/g, " ");
  if (value === "hcm" || value === "tphcm") value = "ho chi minh";
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}
const key = (...s: string[]) => s.map(normalizeAddressUnit).join("|");
const provinces = new Map(data.provinces.map(([code, name]) => [code, name]));
const currentByCode = new Map(data.wards.map(([code, pcode, name]) => [code, { province: provinces.get(pcode)!, ward: name, provinceCode: pcode, wardCode: code }]));
const legacyIndex = new Map<string, Snapshot["legacy"]>();
for (const row of data.legacy) {
  const k = key(row[0], row[1], row[2]);
  legacyIndex.set(k, [...(legacyIndex.get(k) || []), row]);
}
const currentIndex = new Map<string, Array<NonNullable<AddressMigration["current"]>>>();
for (const row of currentByCode.values()) {
  const k = key(row.province, row.ward);
  currentIndex.set(k, [...(currentIndex.get(k) || []), row]);
}

/** Whole-unit moves only. A single partial candidate is still not proof of the customer's new ward. */
export function convertDeliveryAddress(original: AddressParts): AddressMigration {
  const base = { original: { ...original }, source: data.metadata.source, version: data.metadata.version };
  if (!original.district?.trim()) {
    const matches = currentIndex.get(key(original.province, original.ward)) || [];
    if (matches.length === 1) return { ...base, state: "already_current", current: matches[0] };
    return { ...base, state: "needs_review", reason: "Không xác định được địa chỉ 2 cấp; cần kiểm tra tỉnh và phường/xã." };
  }
  const rows = legacyIndex.get(key(original.province, original.district, original.ward)) || [];
  if (rows.length === 1 && rows[0][5] && rows[0][4].length === 1) {
    const current = currentByCode.get(rows[0][4][0]);
    if (current) return { ...base, state: "converted", current };
  }
  const candidates = [...new Set(rows.flatMap(r => r[4]))].map(code => currentByCode.get(code)).filter(Boolean)
    .map(row => ({ province: row!.province, ward: row!.ward }));
  return { ...base, state: "needs_review", reason: rows.length
    ? "Phường/xã cũ bị chia hoặc chưa có ánh xạ toàn bộ chắc chắn; cần xác nhận phường/xã mới."
    : "Chưa tìm thấy địa chỉ cũ trong bảng đối chiếu; cần xác nhận địa chỉ mới.", candidates };
}

export function newDeliveryAddressText(result: AddressMigration, fallback: string): string {
  if (!result.current) return fallback;
  let street = result.original.streetAddress?.trim();
  if (!street) {
    // Older callers supply the full legacy address. Remove only a matching administrative suffix.
    const parts = fallback.split(",").map(s => s.trim());
    for (const unit of [result.original.province, result.original.district, result.original.ward]) {
      if (unit && normalizeAddressUnit(parts.at(-1) || "") === normalizeAddressUnit(unit)) parts.pop();
    }
    street = parts.join(", ");
  }
  return [street, result.current.ward, result.current.province].filter(Boolean).join(", ");
}
