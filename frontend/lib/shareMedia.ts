/** Tải ảnh/video SP thành File để đính kèm khi chia sẻ (Web Share API trên điện thoại). */

export type ShareMediaItem = { src: string; kind: "image" | "video" };

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function isShareableVideoUrl(url: string): boolean {
  const s = String(url || "").trim();
  if (!s || /youtube\.com|youtu\.be|youtube-nocookie/i.test(s)) return false;
  if (/r2\.dev/i.test(s) || /\/uploads\//i.test(s)) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(s);
}

/** R2 không bật CORS → đi qua backend cùng origin; ảnh KiotViet / uploads tải thẳng. */
function fetchUrl(src: string): string {
  try {
    const u = new URL(src, window.location.origin);
    if (u.origin !== window.location.origin && u.protocol === "https:" && u.hostname.toLowerCase().endsWith(".r2.dev")) {
      return `/api/shop/share-media?u=${encodeURIComponent(u.toString())}`;
    }
    return u.toString();
  } catch {
    return src;
  }
}

export async function loadShareFile(
  item: ShareMediaItem,
  baseName: string,
  signal?: AbortSignal
): Promise<File> {
  const res = await fetch(fetchUrl(item.src), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const type = (blob.type || (item.kind === "video" ? "video/mp4" : "image/jpeg")).split(";")[0]!.toLowerCase();
  if (!type.startsWith(`${item.kind}/`)) throw new Error("unexpected_type");
  return new File([blob], `${baseName}.${EXT[type] || (item.kind === "video" ? "mp4" : "jpg")}`, { type });
}

/** Chỉ điện thoại/tablet: bảng chia sẻ của máy mới có Zalo/Facebook nhận file. */
export function canShareFilesOnDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

export function downloadFile(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
