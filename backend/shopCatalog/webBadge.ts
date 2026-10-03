/** Nhãn merchandising web — đồng bộ storefront / admin. */
export const WEB_BADGE_VALUES = [
  "noi_bat",
  "ban_chay_sap_het",
  "giam_gia",
  "dat_truoc",
  "moi",
  "uu_dai",
] as const;

export type WebBadge = (typeof WEB_BADGE_VALUES)[number];

export const WEB_BADGE_LABELS: Record<WebBadge, string> = {
  noi_bat: "Nổi bật",
  ban_chay_sap_het: "Bán chạy và sắp hết",
  giam_gia: "Giảm giá",
  dat_truoc: "Đặt trước",
  moi: "Mới",
  uu_dai: "Ưu đãi",
};

/** Chuẩn hóa nhãn lưu DB (kể cả alias cũ). */
export function normalizeWebBadge(raw: unknown): WebBadge | "" {
  const b = String(raw || "").trim();
  if (!b) return "";
  if (b === "ban_chay") return "ban_chay_sap_het";
  if ((WEB_BADGE_VALUES as readonly string[]).includes(b)) return b as WebBadge;
  return "";
}

/** Điều kiện Mongo khi lọc theo nhãn. `dealMas` = mã SP chiến dịch đang chạy, tính như nhãn «Ưu đãi». */
export function webBadgeMongoFilter(badge: WebBadge | "", dealMas: string[] = []): Record<string, unknown> | null {
  if (!badge) return null;
  if (badge === "ban_chay_sap_het") return { webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] } };
  if (badge === "uu_dai" && dealMas.length) {
    return { $or: [{ webBadge: "uu_dai" }, { ma: { $in: [...dealMas, ...dealMas.map((m) => m.toLowerCase())] } }] };
  }
  return { webBadge: badge };
}

/** «Giảm giá» trên thanh sắp xếp = chỉ SP đang giảm: SP chiến dịch đang chạy + SP gắn nhãn giam_gia. */
export function discountMongoFilter(dealMas: string[]): Record<string, unknown> {
  if (!dealMas.length) return { webBadge: "giam_gia" };
  return {
    $or: [{ webBadge: "giam_gia" }, { ma: { $in: [...dealMas, ...dealMas.map((m) => m.toLowerCase())] } }],
  };
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
