/**
 * Ảnh minh họa menu mobile — chỉ dùng cho L3 nhánh CÂY PHONG THỦY.
 * Các nhánh khác lấy ảnh SP từ kho (category-tree.image).
 */

const DEFAULT_ILLUSTRATION = "/nav-illustrations/nav-cay-chung.png";

function foldName(name: string): string {
  return String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Khớp đúng tên L3 Cây phong thủy (đã fold) → ảnh minh họa. */
const EXACT: Record<string, string> = {
  "CAY BINH AN": "/nav-illustrations/nav-binh-an.png",
  "CAY BONSAI": "/nav-illustrations/nav-bonsai.png",
  "CAY CANH TREO": "/nav-illustrations/nav-cay-treo.png",
  "CAY CAU TIEU TRAM": "/nav-illustrations/nav-cau-tieu-tram.png",
  "CAY DUONG XI": "/nav-illustrations/nav-duong-xi.png",
  "CAY DUOI CONG": "/nav-illustrations/nav-duoi-cong.png",
  "CAY HANH PHUC": "/nav-illustrations/nav-hanh-phuc.png",
  "CAY HO TUNG": "/nav-illustrations/nav-ho-tung.png",
  "CAY HONG MON": "/nav-illustrations/nav-hong-mon.png",
  "CAY KIM GIAO": "/nav-illustrations/nav-kim-giao.png",
  "CAY KIM NGAN": "/nav-illustrations/nav-kim-ngan.png",
  "CAY KIM NGAN LUONG": "/nav-illustrations/nav-kim-ngan.png",
  "CAY KIM TIEN": "/nav-illustrations/nav-kim-tien.png",
  "CAY LAN Y": "/nav-illustrations/nav-lan-y.png",
  "CAY LUOI HO": "/nav-illustrations/nav-luoi-ho.png",
  "CAY NGOC NGAN": "/nav-illustrations/nav-ngoc-ngan.png",
  "CAY NGU GIA BI": "/nav-illustrations/nav-ngu-gia-bi.png",
  "CAY PHONG THUY NHIEU LOAI": "/nav-illustrations/nav-cay-chung.png",
  "CAY TRAU BA": "/nav-illustrations/nav-trau-ba.png",
  "CAY TRUC PHAT TAI": "/nav-illustrations/nav-truc-phat-tai.png",
  "CAY TRUONG SINH": "/nav-illustrations/nav-truong-sinh.png",
  "CAY VAN LOC": "/nav-illustrations/nav-van-loc.png",
  "DE VUONG KIM CUONG": "/nav-illustrations/nav-de-vuong.png",
  "LAN HO DIEP": "/nav-illustrations/nav-lan-ho-diep.png",
};

/** Node L3 thuộc nhánh CÂY PHONG THỦY (path chứa đầy đủ). */
export function isPhongThuyL3(node: { path?: string; name?: string }): boolean {
  const path = foldName(node.path || "");
  if (path.includes("CAY PHONG THUY >>") || /CAY PHONG THUY\s*>/.test(path)) {
    return true;
  }
  // Fallback: tên L3 đã map minh họa phong thủy (kể cả khi API thiếu/lệch path)
  if (node.name && EXACT[foldName(node.name)]) return true;
  return false;
}

/** Ảnh minh họa L3 Cây phong thủy — không dùng cho nhánh khác. */
export function navIllustrationSrc(name: string): string {
  const f = foldName(name);
  if (!f) return DEFAULT_ILLUSTRATION;
  return EXACT[f] || DEFAULT_ILLUSTRATION;
}
