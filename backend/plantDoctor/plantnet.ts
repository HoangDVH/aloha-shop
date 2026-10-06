/** Nhận diện loài bằng Pl@ntNet API (gói miễn phí 500 lượt/ngày, https://my.plantnet.org). */
const ENDPOINT = "https://my-api.plantnet.org/v2/identify/all";
const TIMEOUT_MS = 15_000;
const PLANTNET_MIME = new Set(["image/jpeg", "image/png"]);

export type PlantNetCandidate = {
  species: string;
  genus: string;
  family: string;
  commonNames: string[];
  score: number;
};

export type PlantNetResult =
  | { status: "ok"; candidates: PlantNetCandidate[] }
  | { status: "not_plant" }
  | { status: "unavailable"; reason: string };

export function plantNetKey(): string {
  return String(process.env.PLANTNET_API_KEY || "").trim();
}

type RawResult = {
  score?: unknown;
  species?: {
    scientificNameWithoutAuthor?: unknown;
    genus?: { scientificNameWithoutAuthor?: unknown };
    family?: { scientificNameWithoutAuthor?: unknown };
    commonNames?: unknown;
  };
};

export function parsePlantNetResults(body: unknown): PlantNetCandidate[] {
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return (results as RawResult[])
    .map((r) => ({
      species: String(r.species?.scientificNameWithoutAuthor || "").trim(),
      genus: String(r.species?.genus?.scientificNameWithoutAuthor || "").trim(),
      family: String(r.species?.family?.scientificNameWithoutAuthor || "").trim(),
      commonNames: (Array.isArray(r.species?.commonNames) ? r.species.commonNames : [])
        .map((n) => String(n).trim())
        .filter(Boolean)
        .slice(0, 3),
      score: Math.max(0, Math.min(1, Number(r.score) || 0)),
    }))
    .filter((c) => c.species)
    .slice(0, 5);
}

/** Ảnh base64 (JPEG/PNG) của cùng một cây; không bao giờ ném lỗi, không log key. */
export async function identifyPlant(key: string, images: { mimeType: string; data: string }[]): Promise<PlantNetResult> {
  const usable = images.filter((i) => PLANTNET_MIME.has(i.mimeType)).slice(0, 5);
  if (!usable.length) return { status: "unavailable", reason: "no_supported_image" };
  const form = new FormData();
  usable.forEach((img, i) => {
    const ext = img.mimeType === "image/png" ? "png" : "jpg";
    form.append("images", new Blob([Buffer.from(img.data, "base64")], { type: img.mimeType }), `plant-${i}.${ext}`);
  });
  const url = `${ENDPOINT}?api-key=${encodeURIComponent(key)}&nb-results=5&include-related-images=false`;
  try {
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return { status: "not_plant" };
    if (!res.ok) {
      console.warn("[plant-doctor] Pl@ntNet HTTP", res.status);
      return { status: "unavailable", reason: `http_${res.status}` };
    }
    const candidates = parsePlantNetResults(await res.json());
    return candidates.length ? { status: "ok", candidates } : { status: "not_plant" };
  } catch (e) {
    const reason = (e as Error)?.name === "TimeoutError" ? "timeout" : "network";
    console.warn("[plant-doctor] Pl@ntNet lỗi:", reason);
    return { status: "unavailable", reason };
  }
}
