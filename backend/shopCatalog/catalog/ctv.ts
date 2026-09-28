/**
 * CTV helpers for catalog click tracking and code normalization.
 */

export function normalizeCtvCode(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

export function isValidCtvCode(code: string): boolean {
  const c = normalizeCtvCode(code);
  return c.length >= 3 && c.length <= 20;
}

/** Tránh lưu IP thô: chỉ lưu hash nhẹ. */
export function hashIpFvn1a32(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
