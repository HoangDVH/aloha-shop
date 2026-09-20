/** Nhãn merchandising web — đồng bộ với backend/shopCatalog/webBadge.ts */
export const WEB_BADGE_VALUES = [
  "noi_bat",
  "ban_chay_sap_het",
  "giam_gia",
  "dat_truoc",
  "moi",
] as const;

export type WebBadge = (typeof WEB_BADGE_VALUES)[number];

export const WEB_BADGE_LABELS: Record<WebBadge, string> = {
  noi_bat: "NỔI BẬT",
  ban_chay_sap_het: "BÁN CHẠY VÀ SẮP HẾT",
  giam_gia: "GIẢM GIÁ",
  dat_truoc: "ĐẶT TRƯỚC",
  moi: "MỚI",
};

/** Nhãn hiển thị trên card — luôn viết hoa hết. */
export function formatWebBadgeLabel(label: string): string {
  return String(label || "")
    .trim()
    .toLocaleUpperCase("vi-VN");
}

export function normalizeWebBadge(raw: unknown): WebBadge | "" {
  const b = String(raw || "").trim();
  if (!b) return "";
  if (b === "ban_chay") return "ban_chay_sap_het";
  if ((WEB_BADGE_VALUES as readonly string[]).includes(b)) return b as WebBadge;
  return "";
}
