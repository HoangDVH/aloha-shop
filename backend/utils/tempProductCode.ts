/**
 * Mã tạm từ tab Đặt hàng / OCR chứng từ — không phải mã KiotViet chính thức.
 * VD: SPM-HANG-8853, NEW-..., SPCON-...
 */

/** Mã tạm (đặt hàng / combo con) — chưa lên KiotViet hoặc chỉ dùng nội bộ. */
export function isTempOrderProductMa(ma: unknown): boolean {
  return /^(SPM|NEW|SPCON)-/i.test(String(ma || "").trim());
}

/**
 * Gõ chưa đủ mã tạm (chỉ «SPM» hoặc «SPM-HANG») → không liệt kê rác trong Hàng hóa.
 * Mã đủ 3 phần: SPM-HANG-8853 → vẫn cho tìm.
 */
export function isPartialTempCodeSearch(query: unknown): boolean {
  const q = String(query || "").trim();
  if (!q || !/^(spm|new|spcon)/i.test(q)) return false;
  const parts = q.split("-").filter(Boolean);
  return parts.length < 3;
}

/** Ẩn mã tạm khỏi gợi ý / bảng trừ khi gõ đúng cả mã. */
export function shouldHideTempProductInCatalog(ma: unknown, query: unknown): boolean {
  if (!isTempOrderProductMa(ma)) return false;
  const q = String(query || "").trim();
  if (!q) return true;
  if (String(ma || "").trim().toUpperCase() === q.toUpperCase()) return false;
  return isPartialTempCodeSearch(q);
}
