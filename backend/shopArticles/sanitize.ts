/** Sanitize HTML body bài viết — bỏ script / event handler / URL nguy hiểm. */

const BLOCKED_TAGS =
  /<\/?(?:script|object|embed|form|input|button|link|meta|base|svg|math)(?:\s[^>]*)?>/gi;

const EVENT_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Chặn javascript:/vbscript: — data:image từ Word sẽ upload trước khi lưu. */
const DANGEROUS_URL =
  /\s+(href|src|action|formaction|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript):[^"]*"|'\s*(?:javascript|vbscript):[^']*'|(?:javascript|vbscript):[^\s>]*)/gi;

const SAFE_EMBED_SRC =
  /^(?:https?:)?\/\/(?:(?:www\.)?youtube\.com\/embed\/|(?:www\.)?youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/|drive\.google\.com\/file\/d\/[\w-]+\/preview)/i;

const SAFE_VIDEO_FILE =
  /^(?:\/uploads\/[\w./-]+\.(?:mp4|webm|ogg)|https?:\/\/[\w.-]+\/[\w./%-]+\.(?:mp4|webm|ogg))(?:\?[^"']*)?$/i;

/** Chỉ giữ iframe YouTube / Vimeo / Google Drive preview; iframe khác bỏ. */
function sanitizeIframes(html: string): string {
  return html.replace(/<iframe\b([^>]*)>([\s\S]*?)<\/iframe>/gi, (_m, attrs: string) => {
    const srcMatch = String(attrs || "").match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = (srcMatch?.[2] || srcMatch?.[3] || srcMatch?.[4] || "").trim();
    if (!src || !SAFE_EMBED_SRC.test(src)) return "";
    const safeSrc = src.replace(/"/g, "");
    return (
      `<figure class="article-video">` +
      `<iframe src="${safeSrc}" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
      `</figure>`
    );
  });
}

/** Chỉ giữ <video> trỏ file upload / https an toàn. */
function sanitizeVideos(html: string): string {
  return html.replace(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi, (_m, attrs: string) => {
    const srcMatch = String(attrs || "").match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = (srcMatch?.[2] || srcMatch?.[3] || srcMatch?.[4] || "").trim();
    if (!src || !SAFE_VIDEO_FILE.test(src)) return "";
    const safeSrc = src.replace(/"/g, "");
    return (
      `<figure class="article-video-file">` +
      `<video src="${safeSrc}" controls playsinline preload="metadata" style="width:100%;height:auto;border-radius:12px"></video>` +
      `</figure>`
    );
  });
}

/** Văn bản thuần (Enter) → <br>; HTML có sẵn giữ nguyên. */
export function plainTextNewlinesToHtml(raw: string): string {
  let s = String(raw || "");
  if (!s.trim()) return "";
  if (/<\s*(br|p|div|li|h[1-6]|ul|ol|table|tr|td|blockquote|iframe|figure|img|video)\b/i.test(s)) {
    return s;
  }
  if (!/<\s*[a-z]/i.test(s)) {
    s = s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "<br>\n");
}

export function sanitizeArticleHtml(raw: string): string {
  let html = plainTextNewlinesToHtml(String(raw || ""));
  if (!html.trim()) return "";
  const iframeHold: string[] = [];
  html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (m) => {
    const token = `<!--IFRAME_HOLD_${iframeHold.length}-->`;
    iframeHold.push(m);
    return token;
  });
  const videoHold: string[] = [];
  html = html.replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, (m) => {
    const token = `<!--VIDEO_HOLD_${videoHold.length}-->`;
    videoHold.push(m);
    return token;
  });
  for (let i = 0; i < 3; i++) {
    const next = html
      .replace(BLOCKED_TAGS, "")
      .replace(EVENT_ATTR, "")
      .replace(DANGEROUS_URL, ' $1=""');
    if (next === html) break;
    html = next;
  }
  html = html.replace(/<!--IFRAME_HOLD_(\d+)-->/g, (_m, idx) => iframeHold[Number(idx)] || "");
  html = html.replace(/<!--VIDEO_HOLD_(\d+)-->/g, (_m, idx) => videoHold[Number(idx)] || "");
  html = sanitizeIframes(html);
  html = sanitizeVideos(html);
  html = html.replace(
    /\s+src\s*=\s*(?:"data:image[^"]*"|'data:image[^']*'|data:image[^\s>]*)/gi,
    ' src=""'
  );
  return html.trim();
}

export function slugifyVi(input: string): string {
  const s = String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return s || "bai-viet";
}

/** Lấy ID YouTube từ URL dán vào. */
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

/** Chuẩn hóa videoUrl: YouTube / Drive → embed; file upload giữ nguyên. */
export function normalizeArticleVideoUrl(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\/uploads\//i.test(s) && /\.(mp4|webm|ogg)(\?|$)/i.test(s)) return s;
  if (SAFE_VIDEO_FILE.test(s)) return s;
  const id = parseYoutubeId(s);
  if (id) return `https://www.youtube.com/embed/${id}`;
  if (/\/folders\//i.test(s) || /photos\.google/i.test(s)) return "";
  const driveMatch =
    s.match(/\/file\/d\/([\w-]+)/i) ||
    (() => {
      try {
        const u = new URL(s.startsWith("http") ? s : `https://${s}`);
        if (!u.hostname.replace(/^www\./, "").endsWith("drive.google.com")) return null;
        const idParam = u.searchParams.get("id");
        return idParam ? ([null, idParam] as RegExpMatchArray) : null;
      } catch {
        return null;
      }
    })();
  if (driveMatch?.[1]) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  if (SAFE_EMBED_SRC.test(s)) return s;
  return "";
}
