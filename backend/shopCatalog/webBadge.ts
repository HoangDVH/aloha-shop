/** Nhãn merchandising web — 4 nhãn chuẩn (kiểu sàn TMĐT). */
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

/** Chuẩn hóa nhãn lưu DB (kể cả nhãn cũ). */
export function normalizeWebBadge(raw: unknown): WebBadge | "" {
  const b = String(raw || "").trim();
  if (b === "ban_chay_sap_het" || b === "ban_chay") return "ban_chay_sap_het";
  if (b === "giam_gia") return "giam_gia";
  if (b === "dat_truoc") return "dat_truoc";
  if (b === "moi") return "moi";
  // noi_bat cũ → bỏ (không còn trong 4 nhãn)
  return "";
}

export function isWebBadge(raw: unknown): raw is WebBadge {
  return normalizeWebBadge(raw) !== "";
}

/** Tồn ≤ 0 → đặt trước (cùng logic shop). */
export function isPreOrderTon(ton: number | undefined | null): boolean {
  const n = Number(ton);
  return Number.isFinite(n) && n <= 0;
}

export function isLowStockTon(ton: number | undefined | null, max = 8): boolean {
  const n = Number(ton);
  return Number.isFinite(n) && n > 0 && n <= max;
}
