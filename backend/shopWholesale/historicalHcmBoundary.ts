/** Exact historic pairs for business-boundary classification, NOT postal-address conversion.
 * Split wards remain unambiguous for this purpose: all their parts were inside old HCM.
 * Sources:
 * 1278/NQ-UBTVQH15 (2024), Article 1:
 * https://xaydungchinhsach.chinhphu.vn/nghi-quyet-1278-nq-ubtvqh15-sap-xep-don-vi-hanh-chinh-cap-xa-cua-thanh-pho-ho-chi-minh-119241122153826282.htm
 * 1111/NQ-UBTVQH14 (2020), Articles 1–2:
 * https://congbao.chinhphu.vn/van-ban/nghi-quyet-so-1111-nq-ubtvqh14-32796/33933.htm
 * Eastern district membership (pre-2021): geographic names are intentionally scoped to their district.
 */
export const HISTORICAL_HCM_BOUNDARY_VERSION = "2026-10-16.1";
const removedNumberedWards: [string, number[]][] = [
  ["Quận 3", [6, 7, 8, 10, 13]], ["Quận 4", [5, 6, 10, 12, 14]],
  ["Quận 5", [3, 6, 8, 10, 15]], ["Quận 6", [3, 4, 5, 6]],
  ["Quận 8", [1, 2, 3, 8, 9, 10, 11, 12, 13]], ["Quận 10", [3, 5, 7, 11]],
  ["Quận 11", [2, 4, 6, 9, 12, 13]], ["Bình Thạnh", [3, 6, 15, 21, 24]],
  ["Gò Vấp", [4, 7, 9, 13]], ["Phú Nhuận", [3, 12, 14, 17]],
];
const formerEasternDistricts: [string, string[]][] = [
  ["Quận 2", ["An Khánh", "An Lợi Đông", "An Phú", "Bình An", "Bình Khánh", "Bình Trưng Đông", "Bình Trưng Tây", "Cát Lái", "Thảo Điền", "Thạnh Mỹ Lợi", "Thủ Thiêm"]],
  ["Quận 9", ["Hiệp Phú", "Long Bình", "Long Phước", "Long Thạnh Mỹ", "Long Trường", "Phú Hữu", "Phước Bình", "Phước Long A", "Phước Long B", "Tăng Nhơn Phú A", "Tăng Nhơn Phú B", "Tân Phú", "Trường Thạnh"]],
];

export function historicalHcmPairs(key: (district: string, ward: string) => string): Set<string> {
  return new Set([
    ...removedNumberedWards.flatMap(([district, numbers]) => numbers.map(n => key(district, `Phường ${n}`))),
    ...formerEasternDistricts.flatMap(([district, wards]) => wards.map(ward => key(district, ward))),
  ]);
}
