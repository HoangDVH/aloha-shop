import { CONFIDENCES } from "./card.js";
import { PROFILES, type PlantProfile } from "./profiles/index.js";

export const HEALTHY_ID = "khoe_manh";
export const UNSURE_ID = "khong_ro";
export const OTHER_PLANT_ID = "khac";

/** Khi Pl@ntNet không chắc: AI chỉ chọn trong các loài Aloha có hồ sơ, không đặt tên cây ngoài danh sách. */
export function buildPlantGuessSystem(): string {
  const list = PROFILES.map((p) => `- ${p.id}: ${p.nameVi} (${p.scientific}); tên khác: ${p.aliases.slice(0, 4).join(", ")}`).join("\n");
  return `Bạn là trợ lý nhận diện cây cảnh của Aloha – Thế Giới Chậu Cây.
Nhìn ảnh khách gửi và cho biết cây CHÍNH trong ảnh (cây khách đang hỏi, thường ở giữa ảnh) có phải một trong các loài dưới đây không.

DANH SÁCH LOÀI:
${list}
- ${OTHER_PLANT_ID}: không phải loài nào ở trên, hoặc ảnh không đủ rõ để chắc.

QUY TẮC:
- plantInImage = false khi ảnh không có cây.
- profileId chỉ được là một mã trong danh sách. Không chắc thì chọn "${OTHER_PLANT_ID}", không đoán bừa.
- Cây héo, khô lá hay uốn bonsai vẫn nhận theo thân, dáng, lá còn lại và chậu; bỏ qua cây và hoa ở nền phía sau.
- confidence: "cao" khi đặc điểm loài thấy rõ; "vua" khi khá giống nhưng còn thiếu chi tiết; "thap" khi chỉ đoán.`;
}

export function plantGuessSchema() {
  return {
    type: "OBJECT",
    properties: {
      plantInImage: { type: "BOOLEAN" },
      profileId: { type: "STRING", enum: [...PROFILES.map((p) => p.id), OTHER_PLANT_ID] },
      confidence: { type: "STRING", enum: [...CONFIDENCES] },
    },
    required: ["plantInImage", "profileId", "confidence"],
    propertyOrdering: ["plantInImage", "profileId", "confidence"],
  };
}

/** AI chỉ đối chiếu triệu chứng với danh sách vấn đề đã biết của loài; cách chữa do server lấy từ hồ sơ. */
export function buildPickSystem(p: PlantProfile): string {
  const list = p.problems.map((x) => `- ${x.id}: ${x.title}. Dấu hiệu: ${x.signs}`).join("\n");
  return `Bạn là trợ lý chẩn đoán cây của Aloha – Thế Giới Chậu Cây.
Cây của khách ĐÃ được xác định là: ${p.nameVi} (${p.scientific}). Không được đổi hay đoán lại tên cây.

Nhiệm vụ DUY NHẤT: đối chiếu ảnh và lời khách kể với danh sách vấn đề đã biết của loài này, rồi chọn mã khớp nhất.

DANH SÁCH VẤN ĐỀ:
${list}
- ${HEALTHY_ID}: cây khoẻ, không thấy dấu hiệu bất thường.
- ${UNSURE_ID}: dấu hiệu không khớp vấn đề nào ở trên, hoặc ảnh và lời kể chưa đủ để chọn.

QUY TẮC:
- problemId chỉ được là một mã trong danh sách. Không tự nghĩ ra bệnh, thuốc, cách chữa hay tên cây khác.
- confidence: "cao" khi dấu hiệu khớp rõ; "vua" khi còn 1–2 khả năng; "thap" khi ảnh mờ hoặc thiếu thông tin.
- alternatives: tối đa 2 mã khác trong danh sách cũng có thể đúng; để trống khi confidence là "cao".
- observed: 1–2 câu tiếng Việt đời thường, gọi khách là "bạn", chỉ mô tả đúng những gì thấy trên cây (màu lá, vị trí vết, thân, đất…). Không khuyên, không nêu cách chữa. Không có ảnh thì tóm tắt lời khách kể.
- offTopic = true chỉ khi câu hỏi không liên quan tới cây.
Khi khách trả lời thêm ở lượt sau, chọn lại theo toàn bộ thông tin mới.`;
}

export function pickSchema(p: PlantProfile) {
  const ids = p.problems.map((x) => x.id);
  return {
    type: "OBJECT",
    properties: {
      offTopic: { type: "BOOLEAN" },
      problemId: { type: "STRING", enum: [...ids, HEALTHY_ID, UNSURE_ID] },
      confidence: { type: "STRING", enum: [...CONFIDENCES] },
      alternatives: { type: "ARRAY", items: { type: "STRING", enum: ids } },
      observed: { type: "STRING" },
    },
    required: ["offTopic", "problemId", "confidence", "alternatives", "observed"],
    propertyOrdering: ["offTopic", "problemId", "confidence", "alternatives", "observed"],
  };
}
