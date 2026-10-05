import type { Express, Request, Response } from "express";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { DEMO_IDENTIFY, demoReply } from "./demoReplies.js";
import { generateText, geminiKey, type GeminiContent } from "./gemini.js";
import { PLANT_DOCTOR_SYSTEM, PLANT_IDENTIFY_PROMPT, PLANT_IDENTIFY_SYSTEM, splitSuggestions } from "./prompt.js";

const MAX_MESSAGES = 16;
const MAX_TEXT = 4000;
const MAX_IMAGES = 4;
/** ~1.1 MB ảnh sau khi giải base64; client đã nén về ≤1000px JPEG. */
const MAX_IMAGE_B64 = 1_500_000;
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BUSY = "Bác sĩ AI đang bận, vui lòng thử lại sau ít phút.";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ImageIn = { mimeType: string; data: string };

export type PlantDoctorInput =
  | { error: string }
  | { mode: "diagnose" | "identify"; messages: ChatMessage[]; images: ImageIn[] };

/** Kiểm tra body từ trình duyệt: số tin, độ dài, số ảnh, định dạng và dung lượng ảnh. */
export function parsePlantDoctorBody(body: unknown): PlantDoctorInput {
  const b = (body || {}) as { mode?: unknown; messages?: unknown; images?: unknown };
  const mode = b.mode === "identify" ? "identify" : "diagnose";
  const rawMessages = Array.isArray(b.messages) ? b.messages : [];
  const messages: ChatMessage[] = rawMessages
    .slice(-MAX_MESSAGES)
    .map((m) => m as { role?: unknown; content?: unknown })
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as ChatMessage["role"], content: String(m.content).slice(0, MAX_TEXT).trim() }))
    .filter((m) => m.content.length > 0);

  const rawImages = Array.isArray(b.images) ? b.images : [];
  if (rawImages.length > MAX_IMAGES) return { error: `Chỉ gửi tối đa ${MAX_IMAGES} ảnh mỗi lần.` };
  const images: ImageIn[] = [];
  for (const raw of rawImages) {
    const img = (raw || {}) as { mimeType?: unknown; data?: unknown };
    const mimeType = String(img.mimeType || "");
    const data = String(img.data || "");
    if (!IMAGE_MIME.has(mimeType)) return { error: "Ảnh phải là JPG, PNG hoặc WebP." };
    if (!data || data.length > MAX_IMAGE_B64 || !BASE64.test(data)) {
      return { error: "Ảnh quá lớn hoặc bị lỗi, vui lòng chọn ảnh khác." };
    }
    images.push({ mimeType, data });
  }

  if (mode === "identify") {
    if (!images.length) return { error: "Cần ít nhất 1 ảnh để nhận diện cây." };
    return { mode, messages: [{ role: "user", content: PLANT_IDENTIFY_PROMPT }], images };
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { error: "Vui lòng mô tả triệu chứng hoặc gửi ảnh cây." };
  }
  return { mode, messages, images };
}

/** Lịch sử chat → định dạng Gemini; ảnh gắn vào tin nhắn mới nhất của khách. */
export function toGeminiContents(messages: ChatMessage[], images: ImageIn[]): GeminiContent[] {
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = contents[contents.length - 1];
  if (last && images.length) {
    last.parts = [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), ...last.parts];
  }
  return contents;
}

async function handle(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const input = parsePlantDoctorBody(req.body);
  if ("error" in input) return res.status(400).json({ ok: false, error: input.error });

  const identify = input.mode === "identify";
  const scope = identify ? "plant_doctor_identify" : "plant_doctor";
  if (!(await shopRateLimitOrReject(req as any, res as any, scope, identify ? 20 : 12, 10 * 60_000))) return;
  if (!(await shopRateLimitOrReject(req as any, res as any, "plant_doctor_day", 80, 24 * 3600_000))) return;

  const key = geminiKey();
  if (!key) {
    const lastText = input.messages[input.messages.length - 1]?.content || "";
    if (identify) return res.json({ ok: true, reply: DEMO_IDENTIFY, suggest: [], demo: true });
    const { reply, suggest } = splitSuggestions(demoReply(lastText, input.images.length > 0));
    return res.json({ ok: true, reply, suggest, demo: true });
  }

  try {
    const contents = toGeminiContents(input.messages, input.images);
    const system = identify ? PLANT_IDENTIFY_SYSTEM : PLANT_DOCTOR_SYSTEM;
    const text = await generateText(key, system, contents, identify ? 1024 : 4096);
    if (identify) return res.json({ ok: true, reply: text, suggest: [] });
    const { reply, suggest } = splitSuggestions(text);
    return res.json({ ok: true, reply, suggest });
  } catch (e) {
    console.warn("[plant-doctor] gemini lỗi:", (e as Error)?.message);
    return res.status(503).json({ ok: false, error: BUSY });
  }
}

export function registerPlantDoctorRoutes(app: Express) {
  app.post("/api/shop/plant-doctor", (req, res) => {
    handle(req, res).catch((e) => {
      console.warn("[plant-doctor] lỗi:", (e as Error)?.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: BUSY });
    });
  });
}
