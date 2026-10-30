/** Gọi Gemini qua REST (không cần thư viện @google/genai). Key chỉ đọc từ env, không bao giờ trả về client. */
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const PRIMARY_TIMEOUT_MS = 14_000;
const FALLBACK_TIMEOUT_MS = 10_000;
/** Tổng thời gian cho 1 câu hỏi, tối ưu phản hồi nhanh trong vòng 25s. */
const TOTAL_BUDGET_MS = 25_000;
const MIN_ATTEMPT_MS = 4_000;
/** Model báo 429 thì tạm nghỉ 60s (hạn mức RPM reset theo phút), không chặn 15 phút. */
const QUOTA_COOLDOWN_MS = 60_000;

const cooldownUntil = new Map<string, number>();

export function resetGeminiCooldowns() {
  cooldownUntil.clear();
}

export function geminiKey(): string | null {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (key.length < 20 || /your|xxx|placeholder/i.test(key)) return null;
  return key;
}

export function geminiModel(): string {
  return String(process.env.GEMINI_MODEL || "").trim() || "gemini-flash-lite-latest";
}

/**
 * Model dự phòng:
 * Khi có hình ảnh (multimodal): BẮT BUỘC dùng các model hỗ trợ thị giác (Gemini Flash), tuyệt đối không dùng Gemma thuần văn bản.
 */
export function geminiFallbackModels(hasImage = false): string[] {
  if (hasImage) {
    const list = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];
    const cur = geminiModel();
    return list.filter((m) => m !== cur).slice(0, 2);
  }
  const raw = String(process.env.GEMINI_FALLBACK_MODEL || "").trim() || "gemini-2.0-flash,gemini-1.5-flash";
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 2);
}

type SchemaNode = { type?: string; enum?: string[]; items?: SchemaNode; properties?: Record<string, SchemaNode> };

function describe(node: SchemaNode): string {
  if (node.enum) return `một trong: ${node.enum.join(" | ")}`;
  if (node.type === "ARRAY") return `mảng ${node.items ? describe(node.items) : "string"}`;
  if (node.type === "OBJECT" && node.properties) {
    return `object {${Object.entries(node.properties).map(([k, v]) => `${k}: ${describe(v)}`).join(", ")}}`;
  }
  return String(node.type || "string").toLowerCase();
}

/** Gemma bị lặp chữ khi ép responseSchema → chỉ bật JSON và mô tả khoá ngay trong lời dặn. */
export function schemaHint(schema: unknown): string {
  const props = (schema as SchemaNode)?.properties || {};
  const keys = Object.entries(props).map(([k, v]) => `- ${k}: ${describe(v)}`);
  return `\n\nCHỈ trả về đúng một object JSON (không markdown, không chữ nào ngoài JSON) với các khoá:\n${keys.join("\n")}`;
}

const isGemma = (model: string) => /^gemma-/i.test(model);

function requestBody(model: string, system: string, contents: GeminiContent[], maxOutputTokens: number, schema?: unknown) {
  if (!schema) {
    return { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.6, maxOutputTokens } };
  }
  if (isGemma(model)) {
    return {
      systemInstruction: { parts: [{ text: system + schemaHint(schema) }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens, responseMimeType: "application/json" },
    };
  }
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens, responseMimeType: "application/json", responseSchema: schema },
  };
}

async function callOnce(key: string, model: string, body: unknown, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trả về chữ AI viết (JSON nếu có responseSchema). Model chính thử 1 lần; model dự phòng thử tối đa 2 lần
 * khi lỗi 5xx/timeout. 429 thì tạm bỏ model đó. Lỗi request (4xx khác) dừng ngay.
 */
export async function generateText(
  key: string,
  system: string,
  contents: GeminiContent[],
  maxOutputTokens = 2048,
  responseSchema?: unknown
): Promise<string> {
  const primary = geminiModel();
  const hasImage = contents.some((c) => c.parts.some((p) => "inlineData" in p));
  const models = [primary, ...geminiFallbackModels(hasImage).filter((m) => m !== primary)];
  const started = Date.now();
  let lastError = "gemini_unavailable";

  for (const model of models) {
    if ((cooldownUntil.get(model) || 0) > Date.now()) {
      lastError = "gemini_http_429";
      continue;
    }
    const attempts = model === primary ? 1 : 2;
    const body = requestBody(model, system, contents, maxOutputTokens, responseSchema);
    for (let i = 0; i < attempts; i++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
      if (remaining < MIN_ATTEMPT_MS) throw new Error(lastError);
      const timeout = Math.min(model === primary ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS, remaining);
      let res: Response;
      try {
        res = await callOnce(key, model, body, timeout);
      } catch (e) {
        lastError = (e as Error)?.name === "AbortError" ? "gemini_timeout" : "gemini_network";
        console.warn(`[plant-doctor] ${model} ${lastError}`);
        continue;
      }
      if (res.status === 429) {
        lastError = "gemini_http_429";
        cooldownUntil.set(model, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn(`[plant-doctor] ${model} hết lượt (429), tạm bỏ qua ${QUOTA_COOLDOWN_MS / 60_000} phút`);
        break;
      }
      if (res.status >= 500) {
        lastError = `gemini_http_${res.status}`;
        console.warn(`[plant-doctor] ${model} HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`gemini_http_${res.status}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      const text = (data.candidates?.[0]?.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (!text) throw new Error("gemini_empty");
      return text;
    }
  }
  throw new Error(lastError);
}
