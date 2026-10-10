/**
 * Ảnh cây thật từ kho Aloha — dùng cho L3 CÂY PHONG THỦY trên desktop và mobile.
 * Các nhánh khác lấy ảnh SP từ kho (category-tree.image).
 */

const DEFAULT_ILLUSTRATION = "/nav-real-plants/cay-chung.jpg";

function foldName(name: string): string {
  return String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Ảnh đã đối chiếu từng loại cây; nguồn và mã hàng trong nav-real-plants/sources.json. */
const EXACT: Record<string, string> = {
  "CAY BINH AN": "/nav-real-plants/binh-an.jpg",
  "CAY BONSAI": "/nav-real-plants/bonsai.jpg",
  "CAY CANH TREO": "/nav-real-plants/cay-treo-tpdl.jpg",
  "CAY CAU TIEU TRAM": "/nav-real-plants/cau-tieu-tram.jpg",
  "CAY DUONG XI": "/nav-real-plants/duong-xi.jpg",
  "CAY DUOI CONG": "/nav-real-plants/duoi-cong.jpg",
  "CAY HANH PHUC": "/nav-real-plants/hanh-phuc.jpg",
  "CAY HO TUNG": "/nav-real-plants/ho-tung-tlhbs.png",
  "CAY HONG MON": "/nav-real-plants/hong-mon.jpg",
  "CAY KIM GIAO": "/nav-real-plants/kim-giao.png",
  "CAY KIM NGAN": "/nav-real-plants/kim-ngan.jpg",
  "CAY KIM NGAN LUONG": "/nav-real-plants/kim-ngan-luong.jpg",
  "CAY KIM TIEN": "/nav-real-plants/kim-tien.jpg",
  "CAY LAN Y": "/nav-real-plants/lan-y.jpg",
  "CAY LUOI HO": "/nav-real-plants/luoi-ho.jpg",
  "CAY NGOC NGAN": "/nav-real-plants/ngoc-ngan.jpg",
  "CAY NGU GIA BI": "/nav-real-plants/ngu-gia-bi.jpg",
  "CAY PHONG THUY NHIEU LOAI": "/nav-real-plants/cay-chung.jpg",
  "CAY TRAU BA": "/nav-real-plants/trau-ba.jpg",
  "CAY TRUC PHAT TAI": "/nav-real-plants/truc-phat-tai.png",
  "CAY TRUONG SINH": "/nav-real-plants/truong-sinh.jpg",
  "CAY VAN LOC": "/nav-real-plants/van-loc.jpg",
  "DE VUONG KIM CUONG": "/nav-real-plants/de-vuong.jpg",
  "LAN HO DIEP": "/nav-real-plants/lan-ho-diep.png",
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

/** Ảnh kho đã chọn cho L3 Cây phong thủy — không dùng cho nhánh khác. */
export function navIllustrationSrc(name: string): string {
  const f = foldName(name);
  if (!f) return DEFAULT_ILLUSTRATION;
  return EXACT[f] || DEFAULT_ILLUSTRATION;
}
