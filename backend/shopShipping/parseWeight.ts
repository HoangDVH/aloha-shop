/** Parse cân nặng (gram) từ mã hoặc tên SP — ví dụ "2KG", "500G", "12kg". */
export function parseWeightGramFromText(text: string): number | null {
  const s = String(text || "").toUpperCase().replace(/,/g, ".");
  if (!s.trim()) return null;

  const kg = s.match(/(\d+(?:\.\d+)?)\s*(?:KG|KILO(?:GRAM)?)\b/i);
  if (kg) {
    const v = Math.round(parseFloat(kg[1]) * 1000);
    return v > 0 ? v : null;
  }

  const g = s.match(/(\d+(?:\.\d+)?)\s*(?:G|GRAM)\b/i);
  if (g) {
    const v = Math.round(parseFloat(g[1]));
    return v > 0 ? v : null;
  }

  return null;
}
