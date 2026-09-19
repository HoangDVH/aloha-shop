/** Nhãn merchandising web — đồng bộ với backend/shopCatalog/webBadge.ts */
export const WEB_BADGE_VALUES = [
  "ban_chay_sap_het",
  "giam_gia",
  "dat_truoc",
  "moi",
] as const;

export type WebBadge = (typeof WEB_BADGE_VALUES)[number];

export const WEB_BADGE_LABELS: Record<WebBadge, string> = {
  ban_chay_sap_het: "Bán chạy và sắp hết",
  giam_gia: "Giảm giá",
  dat_truoc: "Đặt trước",
  moi: "Mới",
};

export function normalizeWebBadge(raw: unknown): WebBadge | "" {
  const b = String(raw || "").trim();
  if (b === "ban_chay_sap_het" || b === "ban_chay") return "ban_chay_sap_het";
  if (b === "giam_gia") return "giam_gia";
  if (b === "dat_truoc") return "dat_truoc";
  if (b === "moi") return "moi";
  return "";
}
