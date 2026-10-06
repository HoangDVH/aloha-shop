import { CONFIDENCES, parseCardJson, type Confidence, type DoctorCard, type PlantCandidate, type PlantIdentity } from "./card.js";
import { diagnosisCard, healthyCard, offTopicCard, pickPlantCard, pickProblemCard, unknownPlantCard } from "./cards.js";
import { generateText, geminiKey, type GeminiContent } from "./gemini.js";
import { resolvePlant, type PlantRef } from "./identify.js";
import { getProblem, getProfile, type PlantProfile, type Problem } from "./profiles/index.js";
import { HEALTHY_ID, buildPickSystem, buildPlantGuessSystem, pickSchema, plantGuessSchema } from "./prompt.js";

export type Pick = { offTopic: boolean; problemId: string; confidence: Confidence; alternatives: string[]; observed: string };

/** Làm sạch câu trả lời của AI; mã lạ bị loại, observed bị cắt ngắn. */
export function parsePick(raw: unknown, profile: PlantProfile): Pick | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ids = new Set(profile.problems.map((p) => p.id));
  const problemId = typeof r.problemId === "string" ? r.problemId : "";
  return {
    offTopic: r.offTopic === true,
    problemId: ids.has(problemId) || problemId === HEALTHY_ID ? problemId : "",
    confidence: (CONFIDENCES as readonly string[]).includes(r.confidence as string) ? (r.confidence as Confidence) : "thap",
    alternatives: (Array.isArray(r.alternatives) ? r.alternatives : []).filter((x): x is string => typeof x === "string" && ids.has(x)).slice(0, 2),
    observed: typeof r.observed === "string" ? r.observed.replace(/\s+/g, " ").trim().slice(0, 300) : "",
  };
}

/** Khách bấm đáp án nhanh: "câu hỏi → tên vấn đề" khớp đúng tiêu đề trong hồ sơ thì chọn luôn, không cần AI. */
export function answeredProblem(profile: PlantProfile, lastUserText: string): Problem | null {
  const idx = lastUserText.lastIndexOf("→");
  if (idx < 0) return null;
  const answer = lastUserText.slice(idx + 1).trim().toLowerCase();
  return profile.problems.find((p) => p.title.toLowerCase() === answer) ?? null;
}

const AI_BUSY_NOTE = "Trợ lý AI đang bận nên chưa xem kỹ ảnh được.";

export type PlantGuess = { kind: "plant"; candidate: PlantCandidate } | { kind: "no_plant" } | { kind: "none" };

/** Làm sạch câu trả lời AI đoán cây: mã lạ hoặc độ chắc "thap" thì bỏ, không đưa cho khách. */
export function parsePlantGuess(raw: unknown): PlantGuess {
  if (!raw || typeof raw !== "object") return { kind: "none" };
  const r = raw as Record<string, unknown>;
  if (r.plantInImage === false) return { kind: "no_plant" };
  const p = getProfile(r.profileId);
  if (!p || !(r.confidence === "cao" || r.confidence === "vua")) return { kind: "none" };
  return { kind: "plant", candidate: { profileId: p.id, name: p.nameVi, scientificName: p.scientific, score: 0, byAi: true } };
}

/** Chỉ gọi khi có ảnh và Pl@ntNet không chắc; lỗi hay hết lượt AI thì coi như không đoán được. */
export async function guessPlantWithAi(contents: GeminiContent[]): Promise<PlantGuess> {
  const key = geminiKey();
  if (!key || !contents.length) return { kind: "none" };
  try {
    const text = await generateText(key, buildPlantGuessSystem(), contents, 1024, plantGuessSchema());
    const guess = parsePlantGuess(parseCardJson(text));
    console.info("[plant-doctor] AI đoán cây:", guess.kind === "plant" ? guess.candidate.profileId : guess.kind);
    return guess;
  } catch (e) {
    console.warn("[plant-doctor] AI đoán cây lỗi:", (e as Error)?.message);
    return { kind: "none" };
  }
}

/** Gợi ý của AI đứng đầu danh sách (nếu Pl@ntNet cũng có loài đó thì gắn nhãn AI vào mục sẵn có). */
export function withAiGuess(candidates: PlantCandidate[], guess: PlantCandidate): PlantCandidate[] {
  const same = candidates.find((c) => c.profileId === guess.profileId);
  return [same ? { ...same, byAi: true } : guess, ...candidates.filter((c) => c !== same)];
}

async function pickWithAi(
  profile: PlantProfile,
  plant: PlantIdentity,
  contents: GeminiContent[]
): Promise<DoctorCard> {
  const key = geminiKey();
  if (!key) return pickProblemCard(profile, plant);
  let pick: Pick | null = null;
  try {
    const text = await generateText(key, buildPickSystem(profile), contents, 1024, pickSchema(profile));
    pick = parsePick(parseCardJson(text), profile);
  } catch (e) {
    console.warn("[plant-doctor] AI chọn vấn đề lỗi:", (e as Error)?.message);
    return pickProblemCard(profile, plant, AI_BUSY_NOTE);
  }
  if (!pick) return pickProblemCard(profile, plant);
  if (pick.offTopic) return offTopicCard("unrelated");
  if (pick.problemId === HEALTHY_ID) return healthyCard(profile, plant, pick.observed);
  const problem = getProblem(profile, pick.problemId);
  if (!problem) return pickProblemCard(profile, plant, pick.observed);
  const alternatives = pick.alternatives.map((id) => getProblem(profile, id)).filter((p): p is Problem => Boolean(p));
  return diagnosisCard({ profile, plant, problem, confidence: pick.confidence, observed: pick.observed, alternatives });
}

export async function diagnose(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  images: { mimeType: string; data: string }[];
  plant: PlantRef | null;
  contents: GeminiContent[];
  newPhotos?: boolean;
}): Promise<DoctorCard> {
  const userTexts = input.messages.filter((m) => m.role === "user").map((m) => m.content);
  const res = await resolvePlant({ ref: input.plant, images: input.images, userTexts, newPhotos: input.newPhotos });
  const hasImages = input.images.length > 0;
  if (hasImages && (res.kind === "not_plant" || res.kind === "none" || res.kind === "uncertain")) {
    const guess = await guessPlantWithAi(input.contents);
    const listed = res.kind === "uncertain" ? res.candidates : [];
    const bonsai = res.kind === "uncertain" && !!res.bonsai;
    if (guess.kind === "plant") return pickPlantCard(withAiGuess(listed, guess.candidate), true, bonsai);
    if (res.kind === "not_plant") return guess.kind === "no_plant" || !geminiKey() ? offTopicCard("not_plant") : pickPlantCard([], true);
    return pickPlantCard(listed, true, bonsai);
  }
  if (res.kind === "not_plant") return offTopicCard("not_plant");
  if (res.kind === "none") return pickPlantCard([], hasImages);
  if (res.kind === "uncertain") return pickPlantCard(res.candidates, hasImages, !!res.bonsai);
  if (res.kind === "unknown") return unknownPlantCard(res.identity);

  const profile = getProfile(res.identity.profileId);
  if (!profile) return unknownPlantCard(res.identity);
  const answered = answeredProblem(profile, userTexts[userTexts.length - 1] || "");
  if (answered) return diagnosisCard({ profile, plant: res.identity, problem: answered, confidence: "cao" });
  return pickWithAi(profile, res.identity, input.contents);
}
