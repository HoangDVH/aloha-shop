/** Đọc danh sách nhóm từ query `?nhom=a&nhom=b` hoặc `?nhom=a`. */
export function parseNhomList(sp: { nhom?: string | string[] }): string[] {
  const raw = sp.nhom;
  const list = Array.isArray(raw) ? raw : raw != null && String(raw).trim() ? [String(raw)] : [];
  return list.map((s) => String(s).trim()).filter(Boolean);
}
