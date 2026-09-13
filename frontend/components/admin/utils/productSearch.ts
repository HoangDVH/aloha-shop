/**
 * Minimal product/text search helpers ported from ALOHA Garden.
 * Only `textMatchesQuery` (+ deps) — no IndexedDB / KiotViet.
 */

function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VI_NUM: Record<string, string> = {
  khong: "0",
  mot: "1",
  hai: "2",
  ba: "3",
  bon: "4",
  nam: "5",
  sau: "6",
  bay: "7",
  tam: "8",
  chin: "9",
};

const STOP_WORDS = new Set(["va", "cua", "cho", "voi", "cac", "mot", "nhung", "dung", "loai"]);

/** Tách «2ly» → 2 + ly; map số chữ → số; bỏ từ thừa. */
function nameTokens(normQ: string): string[] {
  const out: string[] = [];
  for (const raw of normQ.split(/\s+/).filter(Boolean)) {
    const t0 = VI_NUM[raw] || raw;
    const glued = t0.match(/^(\d+)([a-z]+)$/i) || t0.match(/^([a-z]+)(\d+)$/i);
    const parts = glued ? [glued[1]!.toLowerCase(), glued[2]!.toLowerCase()] : [t0];
    for (const t of parts) {
      if (!t || STOP_WORDS.has(t)) continue;
      if (t.length < 1) continue;
      out.push(t);
    }
  }
  return out;
}

/**
 * Khớp chuỗi kiểu công ty: mọi từ khóa đều có trong text (không cần liền nhau).
 * «bach tuyet» khớp «CÂY BẠCH TUYẾT MAI».
 */
export function textMatchesQuery(text: string, query: string): boolean {
  const raw = String(query || "").trim();
  if (!raw) return true;
  const hay = normalizeString(text);
  if (!hay) return false;
  const normQ = normalizeString(raw);
  const tokens = nameTokens(normQ);
  if (!tokens.length) return hay.includes(normQ);
  if (tokens.length === 1) {
    const t = tokens[0]!;
    return hay.includes(t) || hay.replace(/\s+/g, "").includes(t);
  }
  return tokens.every((t) => hay.includes(t) || hay.replace(/\s+/g, "").includes(t));
}

export { normalizeString };
