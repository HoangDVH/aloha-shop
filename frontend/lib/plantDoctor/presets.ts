/** Nội dung mẫu của Phòng khám (chép từ ALOHA-GARDEN-2, chỉnh lời cho khách mua lẻ). */
export const ALOHA_ZALO = { href: "https://zalo.me/0794901233", label: "079 490 1233" };

export const WELCOME_TEXT = `Chào bạn! Mình là Bác sĩ cây cảnh của Aloha.

Hãy gửi ảnh thực tế của cây (chụp toàn cây, cận lá và gốc nếu được), hoặc mô tả triệu chứng: lá nhũn trong suốt, mốc trắng ở nách lá, rễ khô teo, rụng lá hàng loạt…

Mình nhận diện loài cây trước, rồi hướng dẫn cách chữa và cách chăm đúng cho loài đó.`;

export type SymptomPreset = {
  id: string;
  name: string;
  label: string;
  description: string;
  prompt: string;
  severity: "high" | "warning" | "info";
};

export const SYMPTOM_PRESETS: SymptomPreset[] = [
  {
    id: "rep",
    name: "Rệp sáp bông trắng",
    label: "Bám kín nách lá",
    description: "Vệt trắng như bông bám ở nách lá, lá dưới teo sạm dần.",
    prompt:
      "Cây của tôi có nhiều mảng bông trắng li ti ở kẽ lá và mặt dưới lá. Đầu ngọn chớm héo. Tôi nên xử lý thế nào?",
    severity: "warning",
  },
  {
    id: "rot",
    name: "Thối nhũn, úng rễ",
    label: "Lá sũng nước",
    description: "Lá căng mọng, úng vàng trong suốt và rụng khi chạm nhẹ.",
    prompt:
      "Cây của tôi bị thâm gốc, lá dưới vàng úng, mềm nhũn rồi rụng dần từ dưới lên, đất lâu khô. Có cứu kịp không?",
    severity: "high",
  },
  {
    id: "long",
    name: "Mất dáng, vươn dài",
    label: "Thiếu sáng",
    description: "Thân vươn dài lêu nghêu, lá thưa, bẹt ra và nhạt màu.",
    prompt:
      "Cây để trên bàn làm việc phòng máy lạnh bị vươn dài, lá thưa và nhạt màu dần. Tôi nên làm gì?",
    severity: "info",
  },
  {
    id: "shock",
    name: "Héo, cháy nắng mùa hè",
    label: "Sốc nhiệt",
    description: "Viền lá cháy vàng khô, lá nhăn nheo, mềm rũ.",
    prompt:
      "Cây để ban công hướng Tây bị nắng chiều làm cháy vàng rìa lá, lá nhăn nheo héo dù đất trong chậu vẫn còn ẩm.",
    severity: "warning",
  },
];

export type GuidedQuestion = { id: "water" | "light" | "sign"; title: string; options: { value: string; label: string }[] };

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: "water",
    title: "Bạn tưới cây thế nào?",
    options: [
      { value: "Tưới hằng ngày, đất luôn sũng nước", label: "Tưới hằng ngày, đất luôn ẩm sũng" },
      { value: "Tưới thưa, chỉ khi đất khô hẳn (1–2 tuần/lần)", label: "Tưới thưa, khi đất khô hẳn (1–2 tuần/lần)" },
      { value: "Thường phun sương trực tiếp lên lá", label: "Thường phun sương lên lá" },
    ],
  },
  {
    id: "light",
    title: "Cây được nắng thế nào?",
    options: [
      { value: "Để hoàn toàn trong phòng kín máy lạnh, không có nắng", label: "Trong phòng kín, không có nắng" },
      { value: "Nắng gắt trực tiếp ngoài ban công 5–8 tiếng/ngày", label: "Nắng gắt trực tiếp 5–8 tiếng/ngày" },
      { value: "Nắng nhẹ, ánh sáng tán xạ, thoáng gió", label: "Nắng nhẹ, thoáng gió" },
    ],
  },
  {
    id: "sign",
    title: "Dấu hiệu bất thường rõ nhất?",
    options: [
      { value: "Lá úng vàng sũng nước như bị luộc, chạm nhẹ là rụng", label: "Lá úng vàng, sũng nước, dễ rụng" },
      { value: "Có các đốm phấn trắng như bông ở kẽ lá", label: "Đốm phấn trắng như bông ở kẽ lá" },
      { value: "Thân vươn dài, lỏng lẻo, mất dáng", label: "Thân vươn dài, mất dáng" },
    ],
  },
];

export const GUIDED_DEFAULTS = {
  water: GUIDED_QUESTIONS[0].options[1].value,
  light: GUIDED_QUESTIONS[1].options[2].value,
  sign: GUIDED_QUESTIONS[2].options[1].value,
};

export function guidedPrompt(plant: string, a: typeof GUIDED_DEFAULTS): string {
  return `**Phiếu thông tin chẩn đoán**
- **Loại cây:** ${plant}
- **Cách tưới:** ${a.water}
- **Ánh sáng:** ${a.light}
- **Dấu hiệu rõ nhất:** ${a.sign}

Dựa trên thông tin trên và ảnh tôi gửi, nhờ bác sĩ bắt bệnh, giải thích nguyên nhân và hướng dẫn cách chữa cho cây của tôi.`;
}
