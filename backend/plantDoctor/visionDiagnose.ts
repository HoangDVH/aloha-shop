import {
  CONDITIONS,
  CONFIDENCES,
  SEVERITIES,
  parseCardJson,
  type Condition,
  type Confidence,
  type DoctorCard,
  type PlantIdentity,
} from "./card.js";
import { healthyCard, offTopicCard, SAFE_BASICS } from "./cards.js";
import { generateText, geminiKey, type GeminiContent } from "./gemini.js";
import {
  PROFILES,
  getProfile,
  matchScientific,
  matchText,
  type PlantProfile,
  type Problem,
} from "./profiles/index.js";

export function buildVisionDoctorSystem(): string {
  const profileList = PROFILES.map((p) => `- ${p.id}: ${p.nameVi} (${p.scientific})`).join("\n");
  return `Bạn là Chuyên gia Bác sĩ Cây Cảnh cao cấp của Aloha – Thế Giới Chậu Cây (hệ thống chẩn đoán thị giác thông minh tương tự PictureThis/Plantix).
Nhiệm vụ: Phân tích ảnh chụp cây cảnh và câu hỏi/mô tả của khách hàng trong 1 lần duy nhất để:
1. Nhận diện chính xác tên cây cảnh (tên tiếng Việt và tên khoa học).
2. Phát hiện chính xác bệnh lý, tổn thương hoặc tình trạng thực tế của cây (ví dụ: cháy nắng do phơi nắng gắt/nhiệt cao, thối úng rễ do thừa nước, rệp sáp, thiếu vi lượng, đốm nấm...).
3. Đưa ra phác đồ xử lý cấp cứu từng bước rõ ràng, dễ làm theo và hướng dẫn chăm sóc phòng ngừa lâu dài.

DANH SÁCH HỒ SƠ CÂY ALOHA (nếu cây khớp loài nào thì điền matchedProfileId):
${profileList}

QUY TẮC BẮT BUỘC:
- Nếu trong ảnh có xuất hiện cây cảnh: HÃY TẬP TRUNG PHÂN TÍCH CÂY CẢNH ĐÓ (isPlant = true).
- CHỈ đặt isPlant = false và offTopic = true khi bức ảnh HOÀN TOÀN KHÔNG CÓ bất kỳ cây nào (ảnh chân dung người, xe cộ, đồ ăn...).
- condition: chọn 1 trong: ["ung_re", "thieu_sang", "chay_nang", "thieu_nuoc", "sau_hai", "nam_benh", "thieu_dinh_duong", "la_gia", "khoe_manh", "khac"].
- severity: "nhe" (mới chớm, 1-2 lá) | "chu_y" (ảnh hưởng 20-40% tán/lá) | "nang" (thối thân/gốc hoặc nguy cơ chết cây).
- title: Tên bệnh/tình trạng ngắn gọn, chuẩn xác tiếng Việt (VD: 'Thối nhũn gốc rễ do úng nước', 'Khô hạn do thiếu nước', 'Cháy nắng khô mép lá', 'Rệp sáp bông kẽ lá', 'Đốm nấm trên lá', 'Lá già rụng tự nhiên').
- observed: 1-2 câu tiếng Việt đời thường, gọi khách là 'bạn', mô tả chính xác những gì nhìn thấy trên cây trong ảnh.
- why: Giải thích ngắn gọn nguyên nhân cốt lõi khiến cây bị tình trạng này.

NGUYÊN TẮC PHÁC ĐỒ HÀNH ĐỘNG (STEPS & CARE) – DÀNH CHO NGƯỜI DÙNG PHỔ THÔNG KHÔNG BIẾT GÌ VỀ CÂY:
- Dùng từ ngữ bình dân, đồ vật có sẵn trong nhà (chiếc đũa ăn cơm, que tăm bông, thau nước, cồn y tế, nước rửa chén). KHÔNG dùng thuật ngữ nông nghiệp khó hiểu ("giá thể perlite, vermiculite, vi lượng, rễ hoại tử").
- CẤM TUYỆT ĐỐI: KHÔNG BAO GIỜ khuyên "thay chậu to/lớn hơn" khi cây bị úng rễ hoặc thối thân! (Chậu to chứa nhiều đất giữ nước lâu khô sẽ làm thối rễ nhanh hơn).
- BỆNH ÚNG RỄ (ung_re):
  + Bước 1: Đổ sạch nước đang đọng ở đĩa lót dưới đáy chậu đi. Kê 2 nắp chai hoặc viên sỏi dưới đáy chậu để thông gió.
  + Bước 2: Dùng 1 chiếc đũa ăn cơm chọc nhẹ 4–5 lỗ quanh mép đất để đất thở và thoát hơi nước nhanh gấp 3 lần.
  + Bước 3: Cắt bỏ các lá đã nhũn vàng. "Bỏ đói" không tưới nước trong 10–14 ngày tới.
  + Bước 4: Mẹo kiểm tra: Cắm que đũa sâu vào đất, khi nào rút lên thấy đũa khô cong thì mới tưới lại nửa cốc nước. (Nếu thân gốc đã mềm nhũn, lung lay bốc mùi thì mới cần nhấc cây ra cắt rễ thối và trồng vào chậu vừa khít rễ, tuyệt đối không dùng chậu to).
- BỆNH THIẾU NƯỚC (thieu_nuoc):
  + Áp dụng mẹo "ngâm mông cây": Đặt đáy chậu vào thau nước ngập 1/3 chậu trong 15–20 phút để đất hút ngược nước lên như miếng bọt biển, sau đó nhấc ra để ráo. Cây sẽ ngẩng đầu tươi lại sau 2–4 tiếng.
- BỆNH RỆP SÁP/SÂU HẠI (sau_hai):
  + Lấy que tăm bông chấm cồn y tế (hoặc rượu trắng) dí thẳng vào từng đốm bông trắng để rệp tan chảy chết ngay. Hoặc pha 3 giọt nước rửa chén vào bình xịt 500ml xịt kẽ lá rồi lau sạch.
- BỆNH CHÁY NẮNG (chay_nang):
  + Dời cây lùi sâu vào trong nhà cách cửa kính ít nhất 1m. Dùng kéo bấm bỏ viền lá cháy giòn. Xịt sương làm mát không khí, không tưới đẫm nước lúc cây đang sốc nhiệt.
- BỆNH ĐỐM LÁ/NẤM (nam_benh):
  + Cắt bỏ lá đốm bệnh cho vào túi rác. Lấy thìa cạo bỏ mốc trắng trên mặt đất. Chỉ tưới sát gốc cây vào ban ngày, không tưới phun ướt lá ban đêm.
- LÁ GIÀ TỰ NHIÊN (la_gia):
  + Trấn an khách đây là rụng lá già sinh lý tự nhiên như người rụng tóc mọc tóc non, cây không có bệnh. Bấm bỏ lá vàng cho gọn đẹp.
- CARE (CHĂM SÓC PHÒNG NGỪA): Định lượng cụ thể theo loài cây (VD: Kim tiền/Lưỡi hổ: 10–14 ngày/lần, cắm đũa khô mới tưới; Trầu bà/Kim ngân: 4–5 ngày/lần; để nơi thoáng mát có ánh sáng nhẹ).
- matchedProblemId: nếu cây thuộc hồ sơ Aloha và khớp bệnh nào của loài đó (vd: 'chay_nang', 'leafSpot', 'rootRot', 'rep_sap', 'nhen_do'...) thì ghi mã đó; không có thì để rỗng.
- followUpQuestion & followUpOptions: 1 câu hỏi tương tác ngắn gọn kèm 2-3 lựa chọn để khách kiểm tra thêm nếu cần.`;
}

export function visionDoctorSchema() {
  return {
    type: "OBJECT",
    properties: {
      isPlant: { type: "BOOLEAN" },
      offTopic: { type: "BOOLEAN" },
      plantName: { type: "STRING" },
      scientificName: { type: "STRING" },
      matchedProfileId: { type: "STRING" },
      matchedProblemId: { type: "STRING" },
      isHealthy: { type: "BOOLEAN" },
      condition: {
        type: "STRING",
        enum: [
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
        ],
      },
      title: { type: "STRING" },
      confidence: { type: "STRING", enum: ["cao", "vua", "thap"] },
      severity: { type: "STRING", enum: ["nhe", "chu_y", "nang"] },
      observed: { type: "STRING" },
      why: { type: "STRING" },
      steps: { type: "ARRAY", items: { type: "STRING" } },
      care: { type: "ARRAY", items: { type: "STRING" } },
      followUpQuestion: { type: "STRING" },
      followUpOptions: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: [
      "isPlant",
      "plantName",
      "condition",
      "title",
      "confidence",
      "severity",
      "observed",
      "why",
      "steps",
      "care",
    ],
    propertyOrdering: [
      "isPlant",
      "offTopic",
      "plantName",
      "scientificName",
      "matchedProfileId",
      "matchedProblemId",
      "isHealthy",
      "condition",
      "title",
      "confidence",
      "severity",
      "observed",
      "why",
      "steps",
      "care",
      "followUpQuestion",
      "followUpOptions",
    ],
  };
}

type VisionResult = {
  isPlant?: boolean;
  offTopic?: boolean;
  plantName?: string;
  scientificName?: string;
  matchedProfileId?: string;
  matchedProblemId?: string;
  isHealthy?: boolean;
  condition?: Condition;
  title?: string;
  confidence?: Confidence;
  severity?: "nhe" | "chu_y" | "nang";
  observed?: string;
  why?: string;
  steps?: string[];
  care?: string[];
  followUpQuestion?: string;
  followUpOptions?: string[];
};

export async function diagnoseWithVisionAi(contents: GeminiContent[]): Promise<DoctorCard | null> {
  const key = geminiKey();
  if (!key || !contents.length) return null;
  try {
    const text = await generateText(key, buildVisionDoctorSystem(), contents, 1500, visionDoctorSchema());
    const raw = parseCardJson(text) as VisionResult | null;
    if (!raw || typeof raw !== "object") return null;

    if (raw.isPlant === false || raw.offTopic === true) {
      return offTopicCard("not_plant");
    }

    const plantName = typeof raw.plantName === "string" && raw.plantName.trim() ? raw.plantName.trim() : "Cây cảnh";
    const scientificName = typeof raw.scientificName === "string" ? raw.scientificName.trim() : "";

    const profile: PlantProfile | null =
      getProfile(raw.matchedProfileId) ??
      matchText(plantName) ??
      (scientificName ? matchScientific({ species: scientificName, genus: "", family: "" }) : null);

    const confidence: Confidence = (CONFIDENCES as readonly string[]).includes(raw.confidence as string)
      ? (raw.confidence as Confidence)
      : "vua";

    const plant: PlantIdentity = {
      profileId: profile?.id ?? null,
      name: profile?.nameVi ?? plantName,
      scientificName: profile?.scientific ?? scientificName,
      source: "ai_vision",
      score: confidence === "cao" ? 0.95 : 0.8,
      candidates: profile
        ? [{ profileId: profile.id, name: profile.nameVi, scientificName: profile.scientific, score: 0.95, byAi: true }]
        : [],
    };

    const condition: Condition = (CONDITIONS as readonly string[]).includes(raw.condition as string)
      ? (raw.condition as Condition)
      : "khac";

    const observed = typeof raw.observed === "string" ? raw.observed.trim() : "";
    const isHealthy = raw.isHealthy === true || condition === "khoe_manh";

    if (isHealthy) {
      if (profile) return healthyCard(profile, plant, observed);
      return {
        kind: "healthy",
        offTopic: false,
        plantName,
        scientificName,
        title: "Cây đang khoẻ mạnh",
        confidence,
        severity: "nhe",
        summary: [observed, "Cây đang phát triển bình thường, chưa thấy biểu hiện sâu bệnh nguy hiểm."].filter(Boolean).join(" "),
        steps: Array.isArray(raw.steps) && raw.steps.length > 0 ? raw.steps.slice(0, 4) : SAFE_BASICS,
        care: Array.isArray(raw.care) && raw.care.length > 0 ? raw.care.slice(0, 3) : [],
        whyDetail: raw.why || "",
        followUps: [],
        condition: "khoe_manh",
        plantGroup: "khac",
        needHelp: false,
        plant,
        problemId: null,
        basics: null,
        source: null,
        careByAloha: false,
        reviewed: true,
      };
    }

    const severity = (SEVERITIES as readonly string[]).includes(raw.severity as string)
      ? (raw.severity as "nhe" | "chu_y" | "nang")
      : "chu_y";

    let matchedProblem: Problem | null = null;
    if (profile) {
      matchedProblem =
        profile.problems.find((p) => p.id === raw.matchedProblemId) ??
        profile.problems.find((p) => p.condition === condition) ??
        null;
    }

    const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : (matchedProblem?.title ?? "Cần chú ý chăm sóc");
    const whyDetail = typeof raw.why === "string" ? raw.why.trim() : (matchedProblem?.why ?? "");

    // Đảm bảo an toàn thực vật học: loại bỏ hoàn toàn lỗi "thay chậu lớn hơn" khi úng rễ
    const sanitizeStep = (step: string) => {
      let s = String(step).trim();
      if (/thay chậu (lớn|to) hơn/i.test(s)) {
        s = s.replace(/thay chậu (lớn|to) hơn/gi, "trồng lại vào chậu vừa khít rễ (không dùng chậu to)");
      }
      return s;
    };

    let steps: string[];
    let care: string[];

    if (matchedProblem && matchedProblem.steps && matchedProblem.steps.length > 0) {
      // Ưu tiên phác đồ dân dã chuẩn y khoa thực vật học đã kiểm duyệt của Aloha
      steps = matchedProblem.steps.slice(0, 4);
      care = matchedProblem.care && matchedProblem.care.length > 0 ? matchedProblem.care.slice(0, 3) : (raw.care ? raw.care.slice(0, 3) : []);
    } else if (Array.isArray(raw.steps) && raw.steps.length > 0) {
      steps = raw.steps.map(sanitizeStep).filter(Boolean).slice(0, 4);
      care = Array.isArray(raw.care) && raw.care.length > 0 ? raw.care.map((c) => String(c).trim()).filter(Boolean).slice(0, 3) : [];
    } else {
      steps = SAFE_BASICS;
      care = [];
    }

    const followUps =
      typeof raw.followUpQuestion === "string" && raw.followUpQuestion.trim() && Array.isArray(raw.followUpOptions) && raw.followUpOptions.length
        ? [{ question: raw.followUpQuestion.trim(), options: raw.followUpOptions.map(String).slice(0, 3) }]
        : [];

    return {
      kind: "diagnosis",
      offTopic: false,
      plantName: profile?.nameVi ?? plantName,
      scientificName: profile?.scientific ?? scientificName,
      title,
      confidence,
      severity,
      summary: [observed, whyDetail].filter(Boolean).join(" "),
      steps,
      care,
      whyDetail,
      followUps,
      condition,
      plantGroup: profile?.group ?? "khac",
      needHelp: severity === "nang",
      plant,
      problemId: matchedProblem?.id ?? (raw.matchedProblemId || null),
      basics: profile?.basics ?? null,
      source: profile?.source ?? null,
      careByAloha: Boolean(profile?.alohaDoc),
      reviewed: profile ? profile.reviewed : true,
    };
  } catch (err) {
    console.warn("[plant-doctor] diagnoseWithVisionAi error:", (err as Error)?.message);
    return null;
  }
}
