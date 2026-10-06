import type { Confidence, DoctorCard, PlantCandidate, PlantIdentity } from "./card.js";
import type { PlantProfile, Problem } from "./profiles/index.js";

/** Việc an toàn cho mọi cây khi chưa có hồ sơ loài: không gây hại dù chẩn đoán chưa rõ. */
export const SAFE_BASICS = [
  "Thử đất bằng ngón tay: đất còn ẩm thì chưa tưới thêm, đất khô hẳn thì tưới đẫm rồi đổ nước thừa.",
  "Để cây chỗ sáng, thoáng gió, tránh nắng gắt chiếu thẳng và gió máy lạnh.",
  "Tạm ngưng bón phân và không thay chậu cho tới khi cây ổn định.",
];

export const PHOTO_TIPS = [
  "Chụp toàn bộ cây trong một ảnh, thêm một ảnh cận lá hoặc chỗ bị bệnh.",
  "Chụp ở chỗ có ánh sáng tự nhiên, không dùng đèn flash, ảnh không bị mờ.",
];

const base = (over: Partial<DoctorCard>): DoctorCard => ({
  kind: "diagnosis",
  offTopic: false,
  plantName: "",
  scientificName: "",
  title: "",
  confidence: "vua",
  severity: "nhe",
  summary: "",
  steps: [],
  care: [],
  whyDetail: "",
  followUps: [],
  condition: "khac",
  plantGroup: "khac",
  needHelp: false,
  plant: null,
  problemId: null,
  basics: null,
  source: null,
  careByAloha: false,
  reviewed: false,
  ...over,
});

const fromProfile = (p: PlantProfile, plant: PlantIdentity) => ({
  plantName: p.nameVi,
  scientificName: plant.source === "plantnet" && plant.scientificName ? plant.scientificName : p.scientific,
  plantGroup: p.group,
  plant,
  basics: p.basics,
  source: p.source,
  careByAloha: Boolean(p.alohaDoc),
  reviewed: p.reviewed,
});

/** Độ chắc chắn của phiếu không vượt độ chắc chắn nhận diện loài. */
function capConfidence(c: Confidence, plant: PlantIdentity): Confidence {
  const idLevel: Confidence = plant.source !== "plantnet" || (plant.score ?? 0) >= 0.5 ? "cao" : "vua";
  const order: Confidence[] = ["thap", "vua", "cao"];
  return order[Math.min(order.indexOf(c), order.indexOf(idLevel))];
}

export const PICK_QUESTION = "Dấu hiệu nào giống cây của bạn nhất?";

export function diagnosisCard(o: {
  profile: PlantProfile;
  plant: PlantIdentity;
  problem: Problem;
  confidence: Confidence;
  observed?: string;
  alternatives?: Problem[];
}): DoctorCard {
  const alts = (o.alternatives ?? []).filter((a) => a.id !== o.problem.id).slice(0, 2);
  const confidence = capConfidence(o.confidence, o.plant);
  return base({
    ...fromProfile(o.profile, o.plant),
    kind: "diagnosis",
    title: o.problem.title,
    confidence,
    severity: o.problem.severity,
    summary: [o.observed, o.problem.summary].filter(Boolean).join(" "),
    steps: o.problem.steps,
    care: o.problem.care,
    whyDetail: o.problem.why,
    followUps:
      confidence !== "cao" && alts.length
        ? [{ question: "Dấu hiệu nào dưới đây giống cây của bạn hơn?", options: [o.problem.title, ...alts.map((a) => a.title)] }]
        : [],
    condition: o.problem.condition,
    needHelp: o.problem.needHelp || o.problem.severity === "nang",
    problemId: o.problem.id,
  });
}

export function healthyCard(profile: PlantProfile, plant: PlantIdentity, observed?: string): DoctorCard {
  return base({
    ...fromProfile(profile, plant),
    kind: "healthy",
    title: "Cây đang khoẻ",
    confidence: capConfidence("vua", plant),
    summary: [observed, `Mình chưa thấy dấu hiệu bệnh rõ ràng. Bạn giữ cách chăm phù hợp với ${profile.nameVi} như bên dưới nhé.`]
      .filter(Boolean)
      .join(" "),
    care: [profile.basics.light, profile.basics.water, profile.basics.note],
    condition: "khoe_manh",
    followUps: [{ question: "Nếu cây vẫn có điểm bất thường, chọn dấu hiệu giống nhất:", options: profile.problems.slice(0, 4).map((p) => p.title) }],
  });
}

/** Cho khách tự chọn dấu hiệu khi AI không chắc hoặc đang hết lượt. */
export function pickProblemCard(profile: PlantProfile, plant: PlantIdentity, observed?: string): DoctorCard {
  return base({
    ...fromProfile(profile, plant),
    kind: "pick_problem",
    title: `Cây ${profile.nameVi} của bạn đang có dấu hiệu nào?`,
    confidence: "thap",
    summary: [observed, "Bạn chọn dấu hiệu giống cây nhất để mình hướng dẫn đúng cách chữa cho loài này."].filter(Boolean).join(" "),
    followUps: [{ question: PICK_QUESTION, options: profile.problems.map((p) => p.title) }],
  });
}

export function unknownPlantCard(plant: PlantIdentity): DoctorCard {
  const name = [plant.name, plant.scientificName && plant.scientificName !== plant.name ? `(${plant.scientificName})` : ""]
    .filter(Boolean)
    .join(" ");
  return base({
    kind: "unknown_plant",
    plantName: plant.name,
    scientificName: plant.scientificName,
    plant,
    title: "Aloha chưa có hồ sơ chăm sóc cho loài cây này",
    confidence: "thap",
    severity: "chu_y",
    summary: `Mình nhận ra cây có thể là ${name}, nhưng Aloha chưa có hướng dẫn đã kiểm chứng cho loài này nên mình không đoán cách chữa. Bạn làm tạm vài việc an toàn bên dưới và nhắn Zalo kèm ảnh để nhân viên Aloha xem giúp nhé.`,
    steps: SAFE_BASICS,
    needHelp: true,
  });
}

export function pickPlantCard(candidates: PlantCandidate[], hasImages: boolean): DoctorCard {
  const known = candidates.filter((c) => c.profileId);
  return base({
    kind: "pick_plant",
    title: hasImages ? "Mình chưa nhận ra chắc chắn đây là cây gì" : "Bạn cho mình biết đây là cây gì nhé",
    confidence: "thap",
    summary: known.length
      ? "Bạn chọn đúng tên cây bên dưới, hoặc gõ tên cây, hoặc gửi thêm ảnh rõ hơn để mình hướng dẫn đúng cho loài đó."
      : hasImages
        ? "Bạn gõ tên cây hoặc gửi thêm ảnh rõ hơn để mình nhận diện lại nhé."
        : "Bạn gửi ảnh cây (chụp cả cây và chỗ bị bệnh) hoặc gõ tên cây để mình hướng dẫn đúng cho loài đó.",
    care: PHOTO_TIPS,
    plant: { profileId: null, name: "", scientificName: "", source: "plantnet", score: null, candidates: known },
  });
}

export function offTopicCard(reason: "not_plant" | "unrelated"): DoctorCard {
  return base({
    kind: "off_topic",
    offTopic: true,
    summary:
      reason === "not_plant"
        ? "Mình chưa thấy cây trong ảnh. Bạn chụp lại rõ lá và thân cây ở chỗ có ánh sáng tự nhiên giúp mình nhé."
        : "Mình chỉ hỗ trợ được các câu hỏi về chăm sóc và bệnh của cây. Bạn gửi ảnh cây hoặc mô tả tình trạng cây giúp mình nhé.",
  });
}
