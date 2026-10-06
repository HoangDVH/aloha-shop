import type { PlantBasics, PlantSource } from "./profiles/types.js";

/** Phiếu chẩn đoán gửi trình duyệt: nội dung chữa lấy từ hồ sơ loài (profiles/), AI chỉ chọn vấn đề. */
export const CONDITIONS = [
  "ung_re",
  "thieu_sang",
  "chay_nang",
  "thieu_nuoc",
  "sau_hai",
  "nam_benh",
  "thieu_dinh_duong",
  "la_gia",
  "khoe_manh",
  "khac",
] as const;
export const PLANT_GROUPS = ["sen_da_xuong_rong", "kieng_la", "bonsai_cay_go", "khac"] as const;
export const CONFIDENCES = ["cao", "vua", "thap"] as const;
export const SEVERITIES = ["nhe", "chu_y", "nang"] as const;

export type Condition = (typeof CONDITIONS)[number];
export type PlantGroup = (typeof PLANT_GROUPS)[number];
export type Confidence = (typeof CONFIDENCES)[number];

export type FollowUp = { question: string; options: string[] };

export type PlantCandidate = { profileId: string | null; name: string; scientificName: string; score: number };

/** Cây đã xác định: nguồn nhận diện, điểm Pl@ntNet và các khả năng khác để khách chọn lại. */
export type PlantIdentity = {
  profileId: string | null;
  name: string;
  scientificName: string;
  source: "plantnet" | "customer" | "text";
  score: number | null;
  candidates: PlantCandidate[];
};

export type CardKind = "diagnosis" | "healthy" | "pick_problem" | "pick_plant" | "unknown_plant" | "off_topic";

export type DoctorCard = {
  kind: CardKind;
  offTopic: boolean;
  plantName: string;
  scientificName: string;
  title: string;
  confidence: Confidence;
  severity: (typeof SEVERITIES)[number];
  summary: string;
  steps: string[];
  care: string[];
  whyDetail: string;
  followUps: FollowUp[];
  condition: Condition;
  plantGroup: PlantGroup;
  needHelp: boolean;
  plant: PlantIdentity | null;
  problemId: string | null;
  basics: PlantBasics | null;
  source: PlantSource | null;
  /** Ánh sáng / tưới nước lấy từ bài hướng dẫn của Aloha. */
  careByAloha: boolean;
  reviewed: boolean;
};

/** Bỏ khối ```json … ``` nếu model lỡ bọc, rồi parse. */
export function parseCardJson(text: string): unknown {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

const SEVERITY_TEXT = { nhe: "Nhẹ", chu_y: "Cần chú ý", nang: "Nặng" } as const;
const CONFIDENCE_TEXT = { cao: "khá chắc chắn", vua: "có thể", thap: "chưa chắc chắn" } as const;

/** Bản chữ của phiếu: lưu lịch sử hội thoại (gửi lại AI ở lượt sau) và để đọc thành tiếng. */
export function cardToText(c: DoctorCard): string {
  if (c.offTopic) return c.summary;
  const lines: string[] = [];
  const name = [c.plantName, c.scientificName ? `(${c.scientificName})` : ""].filter(Boolean).join(" ");
  if (name) lines.push(`Cây: ${name}`);
  if (c.kind === "diagnosis") {
    lines.push(`Vấn đề (${CONFIDENCE_TEXT[c.confidence]}): ${c.title}. Mức độ: ${SEVERITY_TEXT[c.severity]}.`);
  } else if (c.title) {
    lines.push(c.title);
  }
  lines.push(c.summary);
  if (c.steps.length) lines.push("Việc nên làm ngay:", ...c.steps.map((s, i) => `${i + 1}. ${s}`));
  if (c.care.length) lines.push("Chăm sóc để không tái phát:", ...c.care.map((s) => `- ${s}`));
  for (const f of c.followUps) lines.push(`${f.question} (${f.options.join(" / ")})`);
  return lines.join("\n");
}
