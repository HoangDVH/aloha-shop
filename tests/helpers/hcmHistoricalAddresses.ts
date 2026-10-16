// Historical district/ward combinations, independently enumerated for boundary regression checks.
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
export const historicalNumberedWards: [string, number[]][] = [
  ["Quận 3", range(14)], ["Quận 4", [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 18]],
  ["Quận 5", range(15)], ["Quận 6", range(14)], ["Quận 8", range(16)], ["Quận 10", range(15)], ["Quận 11", range(16)],
  ["Bình Thạnh", [1, 2, 3, 5, 6, 7, 11, 12, 13, 14, 15, 17, 19, 21, 22, 24, 25, 26, 27, 28]],
  ["Gò Vấp", [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]],
  ["Phú Nhuận", [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17]],
];
export const historicalEasternDistricts: [string, string[]][] = [
  ["Quận 2", ["An Khánh", "An Lợi Đông", "An Phú", "Bình An", "Bình Khánh", "Bình Trưng Đông", "Bình Trưng Tây", "Cát Lái", "Thảo Điền", "Thạnh Mỹ Lợi", "Thủ Thiêm"]],
  ["Quận 9", ["Hiệp Phú", "Long Bình", "Long Phước", "Long Thạnh Mỹ", "Long Trường", "Phú Hữu", "Phước Bình", "Phước Long A", "Phước Long B", "Tăng Nhơn Phú A", "Tăng Nhơn Phú B", "Tân Phú", "Trường Thạnh"]],
  ["Quận Thủ Đức", ["Bình Chiểu", "Bình Thọ", "Hiệp Bình Chánh", "Hiệp Bình Phước", "Linh Chiểu", "Linh Đông", "Linh Tây", "Linh Trung", "Linh Xuân", "Tam Bình", "Tam Phú", "Trường Thọ"]],
];
