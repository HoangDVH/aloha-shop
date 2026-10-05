/** Gọi Gemini qua REST (không cần thư viện @google/genai). Key chỉ đọc từ env, không bao giờ trả về client. */
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 45_000;

export function geminiKey(): string | null {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (key.length < 20 || /your|xxx|placeholder/i.test(key)) return null;
  return key;
}

export function geminiModel(): string {
  return String(process.env.GEMINI_MODEL || "").trim() || "gemini-3.6-flash";
}

async function callOnce(key: string, body: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Trả về chữ AI viết; ném lỗi nếu Gemini lỗi sau 1 lần thử lại (429/5xx). */
export async function generateText(
  key: string,
  system: string,
  contents: GeminiContent[],
  maxOutputTokens = 2048
): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens },
  };
  let res = await callOnce(key, body);
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await callOnce(key, body);
  }
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("gemini_empty");
  return text;
}
