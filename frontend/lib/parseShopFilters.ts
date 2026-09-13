/** Đọc `?attr=Name:Value` (lặp) từ searchParams Next. */
export function parseAttrList(sp: { attr?: string | string[] }): string[] {
  const raw = sp.attr;
  const list = Array.isArray(raw)
    ? raw
    : raw != null && String(raw).trim()
      ? [String(raw)]
      : [];
  return list.map((s) => String(s).trim()).filter(Boolean);
}

/** Đọc `?dvt=Thùng` (lặp). */
export function parseDvtList(sp: { dvt?: string | string[] }): string[] {
  const raw = sp.dvt;
  const list = Array.isArray(raw)
    ? raw
    : raw != null && String(raw).trim()
      ? [String(raw)]
      : [];
  return list.map((s) => String(s).trim()).filter(Boolean);
}

/** Xóa hết attr/dvt khỏi URLSearchParams (đổi mục navbar). */
export function clearAttrDvtParams(next: URLSearchParams) {
  next.delete("attr");
  next.delete("dvt");
}
