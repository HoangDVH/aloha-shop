/** Server copy — whitelist URL video SP (R2 / YouTube / upload). */

export const PRODUCT_VIDEOS_MAX = 5;

const YT_EMBED =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)/i;

export function parseYoutubeId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (idx >= 0 && parts[idx + 1] && /^[\w-]{11}$/.test(parts[idx + 1])) {
        return parts[idx + 1];
      }
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m?.[1] || null;
}

function ensureHttps(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\/uploads\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  return `https://${s}`;
}

function encodeUrlPreserve(href: string): string {
  try {
    const u = new URL(href);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => {
        if (!seg) return seg;
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join("/");
    return u.toString();
  } catch {
    return href;
  }
}

function isR2Host(hostname: string): boolean {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  return h === "r2.dev" || h.endsWith(".r2.dev");
}

function isUploadPath(s: string): boolean {
  return /^\/uploads\/shop-products\/[\w./%-]+/i.test(s);
}

export function isFileVideoUrl(url: string): boolean {
  const s = String(url || "").trim();
  if (!s) return false;
  if (/youtube\.com|youtu\.be|youtube-nocookie/i.test(s)) return false;
  if (isUploadPath(s)) return true;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (isR2Host(u.hostname)) return true;
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u.pathname)) return true;
  } catch {
    /* ignore */
  }
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(s) || /\/uploads\//i.test(s);
}

export function normalizeProductVideoUrl(raw: string): string {
  let s = String(raw || "").trim();
  if (!s || /^javascript:/i.test(s) || /^data:/i.test(s) || /^vbscript:/i.test(s)) {
    return "";
  }
  s = ensureHttps(s);
  if (isUploadPath(s)) return s;

  const yt = parseYoutubeId(s);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  if (YT_EMBED.test(s)) {
    try {
      const u = new URL(s);
      return `https://www.youtube.com/embed/${u.pathname.split("/").filter(Boolean).pop()}`;
    } catch {
      return s;
    }
  }

  try {
    const u = new URL(s);
    if (isR2Host(u.hostname)) return encodeUrlPreserve(u.toString());
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u.pathname) && /^https?:$/i.test(u.protocol)) {
      return encodeUrlPreserve(u.toString());
    }
  } catch {
    /* ignore */
  }
  if (/^\/uploads\//i.test(s) && /\.(mp4|webm|ogg)(\?|$)/i.test(s)) return s;
  return "";
}

export function normalizeProductVideos(
  input: unknown,
  max = PRODUCT_VIDEOS_MAX
): string[] {
  const arr = Array.isArray(input)
    ? input
    : typeof input === "string" && input.trim()
      ? [input]
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const u = normalizeProductVideoUrl(String(raw || ""));
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

/** Lấy mảng videos từ doc Mongo; fallback `videoUrl` legacy nếu `videos` rỗng. */
export function publicProductVideos(doc: Record<string, unknown>): string[] {
  const fromArr = normalizeProductVideos(doc.videos);
  if (fromArr.length) return fromArr;
  const legacy = String(doc.videoUrl || "").trim();
  if (!legacy) return [];
  return normalizeProductVideos([legacy]);
}

/** CMS fields — KV/catalog sync must never $set / $unset these. */
export const PRODUCT_VIDEO_FIELD_KEYS = ["videos", "videoUrl"] as const;

/**
 * Big-co merge: keep existing shop videos when incoming is empty/missing.
 * Never replace a non-empty CMS video list with [].
 */
export function mergePreserveProductVideos(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined
): { videos: string[]; videoUrl: string } | Record<string, never> {
  const next = publicProductVideos(incoming || {});
  const prev = publicProductVideos(existing || {});
  const keep = next.length ? next : prev;
  if (!keep.length) return {};
  return { videos: keep, videoUrl: keep[0] };
}

/** Remove video keys from a Mongo $set / $unset patch (fail-closed for sync workers). */
export function stripProductVideoMutations<T extends Record<string, unknown>>(
  patch: T | null | undefined
): T {
  if (!patch || typeof patch !== "object") return patch as T;
  for (const key of PRODUCT_VIDEO_FIELD_KEYS) {
    if (key in patch) delete (patch as Record<string, unknown>)[key];
  }
  return patch;
}

/** True when shop should be filled from a richer ops/source list. */
export function shopNeedsVideoFill(
  shopDoc: Record<string, unknown> | null | undefined,
  sourceUrls: string[]
): boolean {
  const src = normalizeProductVideos(sourceUrls);
  if (!src.length) return false;
  const shop = publicProductVideos(shopDoc || {});
  return shop.length === 0;
}
