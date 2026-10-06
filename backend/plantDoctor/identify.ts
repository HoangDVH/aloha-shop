import type { PlantCandidate, PlantIdentity } from "./card.js";
import { identifyPlant, plantNetKey, type PlantNetCandidate } from "./plantnet.js";
import { BONSAI_PROFILES, getProfile, matchScientific, matchText, mentionsBonsai, type PlantProfile } from "./profiles/index.js";

/** Điểm Pl@ntNet (đã cộng theo hồ sơ): từ CONFIDENT trở lên tin hẳn; dưới POSSIBLE thì hỏi khách. */
export const CONFIDENT = 0.5;
export const POSSIBLE = 0.2;
/** Khả năng dưới mức này không đưa ra cho khách chọn (Pl@ntNet hay trả thêm loài gần 0%). */
const MIN_SHOWN = 0.05;

/** Cây của lượt trước do trình duyệt gửi lại; source/score chỉ để hiển thị, profileId được tra lại trên server. */
export type PlantRef = {
  profileId: string | null;
  name: string;
  confirmed: boolean;
  source: PlantIdentity["source"];
  score: number | null;
};

const SOURCES = ["plantnet", "customer", "text"] as const;

export function parsePlantRef(raw: unknown): PlantRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { profileId?: unknown; name?: unknown; confirmed?: unknown; source?: unknown; score?: unknown };
  const profileId = getProfile(r.profileId)?.id ?? null;
  const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!profileId && !name) return null;
  const confirmed = r.confirmed === true;
  const source = confirmed ? "customer" : SOURCES.find((s) => s === r.source) ?? "text";
  const score = typeof r.score === "number" && Number.isFinite(r.score) ? Math.max(0, Math.min(1, r.score)) : null;
  return { profileId, name, confirmed, source, score: source === "plantnet" ? score : null };
}

/** Gộp kết quả Pl@ntNet theo hồ sơ (nhiều loài sen đá → một "Sen đá"), sắp theo điểm. */
export function rankCandidates(list: PlantNetCandidate[]): PlantCandidate[] {
  const merged = new Map<string, PlantCandidate>();
  for (const c of list) {
    const p = matchScientific(c);
    const key = p ? `p:${p.id}` : `s:${c.species}`;
    const prev = merged.get(key);
    if (prev) prev.score += c.score;
    else merged.set(key, { profileId: p?.id ?? null, name: p?.nameVi ?? (c.commonNames[0] || c.species), scientificName: c.species, score: c.score });
  }
  return [...merged.values()]
    .map((c) => ({ ...c, score: Math.round(Math.min(1, c.score) * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .filter((c, i) => i === 0 || c.score >= MIN_SHOWN)
    .slice(0, 4);
}

export function identityFromProfile(p: PlantProfile, source: PlantIdentity["source"], score: number | null = null, candidates: PlantCandidate[] = []): PlantIdentity {
  return { profileId: p.id, name: p.nameVi, scientificName: p.scientific, source, score, candidates };
}

function fromRef(ref: PlantRef | null): PlantIdentity | null {
  if (!ref) return null;
  const p = getProfile(ref.profileId) ?? (ref.name ? matchText(ref.name) : null);
  if (p) return identityFromProfile(p, ref.source, ref.score);
  return ref.confirmed && ref.name ? { profileId: null, name: ref.name, scientificName: "", source: "customer", score: null, candidates: [] } : null;
}

function fromText(userTexts: string[]): PlantIdentity | null {
  for (const t of [...userTexts].reverse()) {
    const p = matchText(t);
    if (p) return identityFromProfile(p, "text");
  }
  return null;
}

export type Resolution =
  | { kind: "known"; identity: PlantIdentity }
  | { kind: "unknown"; identity: PlantIdentity }
  | { kind: "uncertain"; candidates: PlantCandidate[]; bonsai?: boolean }
  | { kind: "not_plant" }
  | { kind: "none" };

/** Ảnh mới có thể là cây khác: cây lượt trước chỉ được đưa ra cho khách chọn lại, không tự dùng. */
function withPrevious(ranked: PlantCandidate[], previous: PlantIdentity | null): PlantCandidate[] {
  if (!previous?.profileId || ranked.some((c) => c.profileId === previous.profileId)) return ranked;
  return [...ranked, { profileId: previous.profileId, name: previous.name, scientificName: previous.scientificName, score: 0 }];
}

function withBonsai(ranked: PlantCandidate[]): PlantCandidate[] {
  const extra = BONSAI_PROFILES.filter((p) => !ranked.some((c) => c.profileId === p.id));
  return [...ranked, ...extra.map((p) => ({ profileId: p.id, name: p.nameVi, scientificName: p.scientific, score: 0 }))];
}

/**
 * Thứ tự tin cậy: khách đã chọn (trừ khi vừa gõ tên cây khác) > Pl@ntNet chắc chắn > tên khách gõ > cây của lượt trước > Pl@ntNet điểm vừa.
 * Pl@ntNet chỉ chạy khi có ảnh mới. `newPhotos`: khách vừa gửi ảnh mới (không phải ảnh cũ gửi lại khi chọn cây),
 * nên bỏ qua cây của lượt trước và tên cây trong các tin cũ.
 */
export async function resolvePlant(opts: {
  ref: PlantRef | null;
  images: { mimeType: string; data: string }[];
  userTexts: string[];
  newPhotos?: boolean;
}): Promise<Resolution> {
  const previous = fromRef(opts.ref);
  const carried = opts.newPhotos ? null : previous;
  const lastText = opts.userTexts[opts.userTexts.length - 1] ?? "";
  const latest = lastText.includes("→") ? null : fromText([lastText]);
  if (carried && opts.ref?.confirmed) {
    if (latest && latest.profileId !== carried.profileId) return { kind: "known", identity: latest };
    return { kind: carried.profileId ? "known" : "unknown", identity: carried };
  }
  const typedOrCarried = () => (opts.newPhotos ? latest : (latest ?? carried ?? fromText(opts.userTexts)));
  const askBonsai = !latest && mentionsBonsai(lastText);
  const unsure = (list: PlantCandidate[]): Resolution => ({
    kind: "uncertain",
    candidates: withPrevious(askBonsai ? withBonsai(list) : list, opts.newPhotos ? previous : null),
    ...(askBonsai ? { bonsai: true } : {}),
  });

  const key = plantNetKey();
  if (opts.images.length && key) {
    const r = await identifyPlant(key, opts.images);
    if (r.status === "ok") {
      const ranked = rankCandidates(r.candidates);
      console.info("[plant-doctor] Pl@ntNet:", ranked.map((c) => `${c.profileId ?? c.scientificName} ${c.score}`).join(", "));
      const top = ranked[0];
      if (top.score >= CONFIDENT) {
        const p = getProfile(top.profileId);
        if (p) return { kind: "known", identity: identityFromProfile(p, "plantnet", top.score, ranked) };
        return { kind: "unknown", identity: { ...top, source: "plantnet", score: top.score, candidates: ranked } };
      }
      const typed = typedOrCarried();
      if (typed?.profileId) return { kind: "known", identity: { ...typed, candidates: ranked } };
      const p = getProfile(top.profileId);
      if (p && top.score >= POSSIBLE) return { kind: "known", identity: identityFromProfile(p, "plantnet", top.score, ranked) };
      return unsure(ranked);
    }
    if (r.status === "not_plant") {
      const fallback = typedOrCarried();
      if (fallback?.profileId) return { kind: "known", identity: fallback };
      return askBonsai ? unsure([]) : { kind: "not_plant" };
    }
  }

  const fallback = typedOrCarried();
  if (fallback?.profileId) return { kind: "known", identity: fallback };
  if (askBonsai || (opts.newPhotos && previous?.profileId)) return unsure([]);
  return { kind: "none" };
}
