/**
 * Parse dòng thành phần combo → mã / số lượng / tên hiển thị.
 * Hỗ trợ: "MA × 2", "MA x 2", "MA", hoặc text tự do.
 */
export type ThanhPhanRow = {
  ma: string;
  qty: number;
  label: string;
  raw: string;
};

export function parseThanhPhanLine(line: string): ThanhPhanRow {
  const raw = String(line || "").trim();
  if (!raw) return { ma: "", qty: 1, label: "", raw: "" };

  const m = raw.match(/^([A-Za-z0-9._\-]+)\s*[×xX*]\s*([\d]+(?:[.,]\d+)?)\s*(.*)$/);
  if (m) {
    const qty = parseFloat(String(m[2]).replace(",", ".")) || 1;
    const rest = String(m[3] || "").trim();
    return { ma: m[1], qty, label: rest || m[1], raw };
  }

  const onlyMa = raw.match(/^([A-Za-z0-9._\-]+)$/);
  if (onlyMa) {
    return { ma: onlyMa[1], qty: 1, label: onlyMa[1], raw };
  }

  // "MA - Tên hàng" hoặc "MA Tên…"
  const m2 = raw.match(/^([A-Za-z0-9._\-]+)\s*[-–:]\s*(.+)$/);
  if (m2) {
    return { ma: m2[1], qty: 1, label: m2[2].trim() || m2[1], raw };
  }

  return { ma: "", qty: 1, label: raw, raw };
}

export function parseThanhPhanList(lines: string[] | undefined | null): ThanhPhanRow[] {
  return (lines || []).map(parseThanhPhanLine).filter((r) => r.raw || r.ma || r.label);
}
