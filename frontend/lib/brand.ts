/** Tên thương hiệu chuẩn — luôn viết hoa toàn bộ chữ. */
export const SHOP_BRAND = "ALOHA THẾ GIỚI CHẬU CÂY";

/**
 * Chuẩn hoá tên shop về dạng viết hoa hết khi là thương hiệu Aloha.
 * Dùng cho UI, footer, SEO title/description.
 */
export function shopBrand(name?: string | null): string {
  const t = String(name || "").trim();
  if (!t) return SHOP_BRAND;
  const upper = t.toLocaleUpperCase("vi-VN").replace(/\s+/g, " ").trim();
  if (upper === SHOP_BRAND) return SHOP_BRAND;
  // Biến thể gần đúng (thiếu dấu / viết tắt)
  if (/^ALOHA\b/.test(upper) && /CH[AẬ]U\s*C[AÂ]Y/.test(upper)) {
    return SHOP_BRAND;
  }
  return t;
}

/** Thay mọi chỗ viết sai casing thương hiệu trong một đoạn văn. */
export function ensureBrandCapsInText(text: string): string {
  return String(text || "").replace(
    /ALOHA\s+Th[eế]?\s*[Gg]i[oớ]i\s+[Cc]h[aậ]u\s+[Cc][aâ]y/gi,
    SHOP_BRAND
  );
}
