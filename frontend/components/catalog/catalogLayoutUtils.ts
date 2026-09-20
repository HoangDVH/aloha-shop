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
  { label: "500.000 – 2.000.000đ", min: 500000, max: 2000000 },
  { label: "Trên 2.000.000đ", min: 2000000, max: 0 },
];

/** Toolbar sort — kiểu TGDĐ (mobile full-width, chấm phân cách). */
export const SORT_TOOLBAR = [
  { value: "ban_chay", label: "Nổi bật" },
  { value: "giam_gia", label: "Giảm giá" },
  { value: "moi", label: "Mới" },
  { value: "price", label: "Giá" },
] as const;

/** Select / legacy — map đủ giá trị URL. */
export const SORT_OPTIONS = [
  { value: "ban_chay", label: "Bán chạy" },
  { value: "moi", label: "Mới" },
  { value: "giam_gia", label: "Giảm giá" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
];

export const DEFAULT_CATALOG_SORT = "ban_chay";

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

export function isCategoryCatalogPath(pathname: string): boolean {
  return pathname.startsWith("/danh-muc");
}

export function normalizeCatalogSort(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return DEFAULT_CATALOG_SORT;
  if (s === "newest") return "moi";
  if (s === "bestsellers" || s === "ban-chay") return "ban_chay";
  if (s === "ten" || s === "ton_desc") return DEFAULT_CATALOG_SORT;
  return s;
}
