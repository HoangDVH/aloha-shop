import type { Express, Request, Response } from "express";
import type { GetDb } from "../auth/middleware.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { FEATURE_DISABLED_MESSAGE, readPlantDoctorAccess, registerPlantDoctorAccessRoutes } from "./access.js";
import { cardToText, type DoctorCard } from "./card.js";
import { diagnose } from "./diagnose.js";
import type { GeminiContent } from "./gemini.js";
import { parsePlantRef, rankCandidates, type PlantRef } from "./identify.js";
import { identifyPlant, plantNetKey } from "./plantnet.js";
import { getProfile } from "./profiles/index.js";
import { isProfileReviewed, loadProfileReviews } from "./reviews.js";

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
  | { mode: "diagnose" | "identify"; messages: ChatMessage[]; images: ImageIn[]; plant: PlantRef | null };

/** Kiểm tra body từ trình duyệt: số tin, độ dài, số ảnh, định dạng và dung lượng ảnh. */
export function parsePlantDoctorBody(body: unknown): PlantDoctorInput {
  const b = (body || {}) as { mode?: unknown; messages?: unknown; images?: unknown; plant?: unknown };
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
    return { mode, messages: [], images, plant: null };
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { error: "Vui lòng mô tả triệu chứng hoặc gửi ảnh cây." };
  }
  return { mode, messages, images, plant: parsePlantRef(b.plant) };
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

/** Lỗi đọc DB thì giữ trạng thái chờ duyệt, không chặn khách nhận phiếu. */
async function markReviewed(getDb: GetDb, card: DoctorCard): Promise<DoctorCard> {
  const profile = card.basics ? getProfile(card.plant?.profileId) : null;
  if (!profile || card.reviewed) return card;
  try {
    return { ...card, reviewed: isProfileReviewed(profile, await loadProfileReviews(await getDb())) };
  } catch {
    return card;
  }
}

async function handle(getDb: GetDb, req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const input = parsePlantDoctorBody(req.body);
  if ("error" in input) return res.status(400).json({ ok: false, error: input.error });

  const identify = input.mode === "identify";
  const scope = identify ? "plant_doctor_identify" : "plant_doctor";
  if (!(await shopRateLimitOrReject(req as any, res as any, scope, identify ? 20 : 12, 10 * 60_000))) return;
  if (!(await shopRateLimitOrReject(req as any, res as any, "plant_doctor_day", 80, 24 * 3600_000))) return;

  if (identify) {
    const key = plantNetKey();
    if (!key) return res.json({ ok: true, reply: "", candidates: [] });
    const r = await identifyPlant(key, input.images);
    if (r.status === "unavailable") return res.status(503).json({ ok: false, error: BUSY });
    const candidates = r.status === "ok" ? rankCandidates(r.candidates) : [];
    return res.json({ ok: true, reply: candidates.map((c) => c.name).join("\n"), candidates });
  }

  const card = await markReviewed(
    getDb,
    await diagnose({
      messages: input.messages,
      images: input.images,
      plant: input.plant,
      contents: toGeminiContents(input.messages, input.images),
    })
  );
  return res.json({ ok: true, reply: cardToText(card), card });
}

export function registerPlantDoctorRoutes(app: Express, getOpsDb: GetDb, getDb: GetDb) {
  registerPlantDoctorAccessRoutes(app, getOpsDb, getDb);
  app.post("/api/shop/plant-doctor", (req, res) => {
    readPlantDoctorAccess(getDb, req)
      .then((access) => {
        if (!access.allowed) {
          res.setHeader("Cache-Control", "no-store");
          return void res.status(403).json({ ok: false, code: "feature_disabled", error: FEATURE_DISABLED_MESSAGE });
        }
        return handle(getDb, req, res);
      })
      .catch((e) => {
      console.warn("[plant-doctor] lỗi:", (e as Error)?.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: BUSY });
    });
  });
}
