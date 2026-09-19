/** Giữ vị trí khối catalog sau khi lọc (Suspense remount làm mất queueMicrotask cũ). */
export const PIN_CATALOG_KEY = "shop-pin-catalog";

export function markPinCatalog() {
  try {
    sessionStorage.setItem(PIN_CATALOG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function scrollToCatalog(smooth = true) {
  document.getElementById("shop-catalog")?.scrollIntoView({
    behavior: smooth ? "smooth" : "instant",
    block: "start",
  });
}

export const PRICE_PRESETS = [
  { label: "Dưới 100.000đ", min: 0, max: 100000 },
  { label: "100.000 – 300.000đ", min: 100000, max: 300000 },
  { label: "300.000 – 500.000đ", min: 300000, max: 500000 },
  { label: "Trên 500.000đ", min: 500000, max: 0 },
];

export const SORT_OPTIONS = [
  { value: "ban_chay", label: "Bán chạy" },
  { value: "moi", label: "Mới nhất" },
  { value: "ten", label: "Tên A–Z" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
  { value: "ton_desc", label: "Tồn nhiều" },
];

/** Loại hàng — khớp tab Hàng hóa / KiotViet */
export const LOAI_HANG_OPTIONS = [
  { value: "thuong", label: "Hàng hóa thường" },
  { value: "san_xuat", label: "Hàng sản xuất" },
  { value: "combo", label: "Combo - đóng gói" },
  { value: "dich_vu", label: "Dịch vụ" },
];

export function normPath(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s*(?:▸|>)\s*/g, " >> ")
    .replace(/\s+/g, " ");
}

export function leafLabel(path: string): string {
  const parts = normPath(path).split(/\s*>>\s*/);
  return parts[parts.length - 1] || path;
}

export function catalogBase(homeMode: boolean, pathname: string): string {
  if (homeMode) return "/";
  if (pathname.startsWith("/danh-muc")) return pathname;
  return "/tim";
}
