/**
 * Text, slug and regex helpers for shop catalog.
 */

export function slugify(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

/** Regex tìm không phân biệt dấu tiếng Việt (cay ≈ cây). */
export function viLooseRegex(raw: string): RegExp {
  const folded = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
  const map: Record<string, string> = {
    a: "[aáàảãạăắằẳẵặâấầẩẫậ]",
    e: "[eéèẻẽẹêếềểễệ]",
    i: "[iíìỉĩị]",
    o: "[oóòỏõọôốồổỗộơớờởỡợ]",
    u: "[uúùủũụưứừửữự]",
    y: "[yýỳỷỹỵ]",
    d: "[dđ]",
  };
  let pat = "";
  for (const ch of folded) {
    if (map[ch]) pat += map[ch];
    else if (/[a-z0-9]/.test(ch)) pat += ch;
    else if (/\s/.test(ch)) pat += "\\s+";
    else pat += `\\${ch}`;
  }
  return new RegExp(pat || ".^", "i");
}

export function regexEscapeLiteral(raw: string): string {
  return String(raw || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pathKey(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s*(?:▸|>)\s*/g, " >> ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeMa(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}
