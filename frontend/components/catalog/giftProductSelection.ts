import type { ShopProduct } from "@/lib/api";

export const GIFT_FIELDS = ["Kiểu quà", "Vị trí đặt", "Loại cây"];
const desktop = new Set("TPBADB CBKTDP CBKTYT TPKNDP CBKNTV CBKNPL KNCT TPVLBA TPKNAK CBHPMM TPKGCT TPDC CBHNTL TPKTTL".split(" "));
const floor = new Set("KNBL BS3MHP TPKTB3 BS3MKT TPTXB2 TXTVDL TPB3MX TPKTDC".split(" "));
// Total plant + pot heights confirmed in the previous product audit.
const heights: Record<string, string> = { TPBADB: "25–35", CBKTYT: "25–35", CBKNPL: "30–35", KNCT: "39", TPVLBA: "15–30", CBHPMM: "30–40", TPKGCT: "35", BS3MHP: "140" };
const species = ["Kim Ngân", "Kim Tiền", "Hạnh Phúc", "Bình An", "Vạn Lộc", "Kim Giao", "Đuôi Công", "Hồng Ngọc", "Trầu Bà", "Sen Đá", "Xương Rồng", "Bàng Singapore"];
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const verifiedSpecies: Record<string, string[]> = { TXTVDL: ["Trầu Bà", "Vạn Lộc"], TPB3MX: ["Kim Tiền"] };

/** Gift-only presentation metadata; unknown placement and dimensions stay unassigned. */
export function withGiftSelection(product: ShopProduct): ShopProduct {
  const name = normalize(product.ten);
  const code = product.ma.toUpperCase();
  const attrs = (product.attributes || []).filter(a => !GIFT_FIELDS.includes(a.attributeName));
  const add = (attributeName: string, attributeValue: string) => attrs.push({ attributeName, attributeValue });
  if (["TXTVDL", "TPB3MX"].includes(code) || (/tieu canh|mix|phoi/.test(name) && !["BS3MKT", "BS3MHP"].includes(code))) add("Kiểu quà", "Tiểu cảnh phối sẵn");
  else if (/cay|kim ngan|kim tien|hanh phuc|binh an|van loc|kim giao|duoi cong|hong ngoc|trau ba/.test(name) || desktop.has(code) || floor.has(code)) add("Kiểu quà", "Chậu cây đơn");
  if (desktop.has(code) || /de ban/.test(name)) add("Vị trí đặt", "Để bàn");
  if (floor.has(code)) add("Vị trí đặt", "Đặt sàn / sảnh");
  for (const label of species) if (name.includes(normalize(label)) || verifiedSpecies[code]?.includes(label)) add("Loại cây", label);
  return { ...product, attributes: attrs, giftDimensions: heights[code] ? `Cây + chậu cao ${heights[code]} cm` : undefined };
}
