import { CONFIDENCES, parseCardJson, type Confidence, type DoctorCard, type PlantIdentity } from "./card.js";
import { diagnosisCard, healthyCard, offTopicCard, pickPlantCard, pickProblemCard, unknownPlantCard } from "./cards.js";
import { generateText, geminiKey, type GeminiContent } from "./gemini.js";
import { resolvePlant, type PlantRef } from "./identify.js";
import { getProblem, getProfile, type PlantProfile, type Problem } from "./profiles/index.js";
import { HEALTHY_ID, buildPickSystem, pickSchema } from "./prompt.js";

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
}): Promise<DoctorCard> {
  const userTexts = input.messages.filter((m) => m.role === "user").map((m) => m.content);
  const res = await resolvePlant({ ref: input.plant, images: input.images, userTexts });
  if (res.kind === "not_plant") return offTopicCard("not_plant");
  if (res.kind === "none") return pickPlantCard([], input.images.length > 0);
  if (res.kind === "uncertain") return pickPlantCard(res.candidates, true);
  if (res.kind === "unknown") return unknownPlantCard(res.identity);

  const profile = getProfile(res.identity.profileId);
  if (!profile) return unknownPlantCard(res.identity);
  const answered = answeredProblem(profile, userTexts[userTexts.length - 1] || "");
  if (answered) return diagnosisCard({ profile, plant: res.identity, problem: answered, confidence: "cao" });
  return pickWithAi(profile, res.identity, input.contents);
}
