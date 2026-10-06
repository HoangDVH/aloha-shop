import { FOLIAGE_A } from "./foliageA.js";
import { FOLIAGE_B } from "./foliageB.js";
import { FOLIAGE_C } from "./foliageC.js";
import { SUCCULENTS } from "./succulents.js";
import type { PlantProfile, Problem } from "./types.js";
import { WOODY } from "./woody.js";

export type { PlantProfile, Problem } from "./types.js";

export const PROFILES: PlantProfile[] = [...FOLIAGE_A, ...FOLIAGE_B, ...FOLIAGE_C, ...SUCCULENTS, ...WOODY];

/** Tên cây Aloha bán nhưng chưa có hồ sơ, chứa tên của loài khác (vd "kim ngân lượng" ≠ kim ngân). */
const NOT_IN_KB = ["kim ngân lượng", "sơn tùng", "tùng bồng lai", "kim thủy tùng", "kim thuỷ tùng", "lan dolla", "lan chi", "lan quân tử"];

const byId = new Map(PROFILES.map((p) => [p.id, p]));
const bySpecies = new Map<string, PlantProfile>();
const byGenus = new Map<string, PlantProfile>();
const byFamily = new Map<string, PlantProfile>();
for (const p of PROFILES) {
  for (const s of p.match.species ?? []) bySpecies.set(s.toLowerCase(), p);
  for (const g of p.match.genera ?? []) byGenus.set(g.toLowerCase(), p);
  for (const f of p.match.families ?? []) byFamily.set(f.toLowerCase(), p);
}

export function getProfile(id: unknown): PlantProfile | null {
  return typeof id === "string" ? (byId.get(id) ?? null) : null;
}

export function getProblem(profile: PlantProfile, id: unknown): Problem | null {
  return profile.problems.find((p) => p.id === id) ?? null;
}

/** Khớp tên khoa học (Pl@ntNet): loài trước, rồi chi, rồi họ. */
export function matchScientific(c: { species: string; genus: string; family: string }): PlantProfile | null {
  const species = c.species.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  return (
    bySpecies.get(species) ??
    byGenus.get(c.genus.trim().toLowerCase()) ??
    byGenus.get(species.split(" ")[0] ?? "") ??
    byFamily.get(c.family.trim().toLowerCase()) ??
    null
  );
}

const lower = (s: string) => s.normalize("NFC").toLowerCase();
export const stripVi = (s: string) =>
  lower(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "u");

type AliasRule = { re: RegExp; plain: boolean; len: number; profile: PlantProfile | null };

/**
 * Tên có dấu khớp trên câu có dấu. Bản không dấu chỉ dùng cho tên nhiều chữ hoặc tên Latin dài,
 * vì từ ngắn bỏ dấu dễ trùng từ thường ("câu" → "cau").
 */
const ALIAS_RULES: AliasRule[] = [
  ...PROFILES.flatMap((p) => [p.nameVi, ...p.aliases].map((a) => ({ a, p }))),
  ...NOT_IN_KB.map((a) => ({ a, p: null as PlantProfile | null })),
].flatMap(({ a, p }) => {
  const accented = lower(a);
  const plain = stripVi(a);
  const rules: AliasRule[] = [{ re: wordRe(accented), plain: false, len: accented.length, profile: p }];
  if (plain !== accented ? plain.includes(" ") : /^[a-z ]{5,}$/.test(plain)) {
    rules.push({ re: wordRe(plain), plain: true, len: plain.length, profile: p });
  }
  return rules;
});

/** "Bonsai" là kiểu tạo dáng, không phải loài: hỏi lại loài, gợi ý các hồ sơ nhóm cây gỗ thường làm bonsai. */
export const BONSAI_PROFILES = PROFILES.filter((p) => p.group === "bonsai_cay_go");
const BONSAI_RE = /(?<![\p{L}\p{N}])bon ?sa[iy](?![\p{L}\p{N}])/u;

export function mentionsBonsai(text: string): boolean {
  return BONSAI_RE.test(stripVi(text));
}

/** Tìm tên cây khách gõ trong câu; tên dài nhất thắng. Tên thuộc NOT_IN_KB trả null. */
export function matchText(text: string): PlantProfile | null {
  const accented = lower(text);
  const plain = stripVi(text);
  let best: AliasRule | null = null;
  for (const r of ALIAS_RULES) {
    if (best && r.len <= best.len) continue;
    if (r.re.test(r.plain ? plain : accented)) best = r;
  }
  return best?.profile ?? null;
}
