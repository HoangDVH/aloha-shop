/** Parser video / upload helpers cho bài viết shop. */

export function escapeAttr(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

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

/** Lấy file ID Google Drive từ link file (không phải thư mục / Photos). */
export function parseGoogleDriveFileId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/\/folders\//i.test(s) || /photos\.google/i.test(s)) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("drive.google.com") && !host.endsWith("docs.google.com")) return null;
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/i);
    if (fileMatch?.[1]) return fileMatch[1];
    const id = u.searchParams.get("id");
    if (id && /^[\w-]+$/.test(id)) return id;
  } catch {
    /* ignore */
  }
  const m = s.match(/\/file\/d\/([\w-]+)/i) || s.match(/[?&]id=([\w-]+)/i);
  return m?.[1] || null;
}

export function googleDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export type NormalizedVideo =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "drive"; embedUrl: string }
  | { kind: "file"; url: string }
  | { kind: "invalid"; reason: string };

/** Chuẩn hóa link video cho form / chèn vào bài. */
export function normalizeVideoInput(raw: string): NormalizedVideo {
  const s = String(raw || "").trim();
  if (!s) return { kind: "invalid", reason: "Dán link YouTube, Google Drive hoặc chọn file máy." };

  if (/^\/uploads\//i.test(s) && /\.(mp4|webm|ogg)(\?|$)/i.test(s)) {
    return { kind: "file", url: s };
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(s) && /^https?:\/\//i.test(s)) {
    return { kind: "file", url: s };
  }

  const yt = parseYoutubeId(s);
  if (yt) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${yt}` };

  if (/\/folders\//i.test(s) || /photos\.google/i.test(s)) {
    return {
      kind: "invalid",
      reason: "Chỉ nhận link một file Google Drive (không phải thư mục / Google Photos).",
    };
  }

  const driveId = parseGoogleDriveFileId(s);
  if (driveId) {
    return { kind: "drive", embedUrl: googleDrivePreviewUrl(driveId) };
  }

  if (/drive\.google\.com/i.test(s)) {
    return {
      kind: "invalid",
      reason: "Link Drive không hợp lệ. Mở file → Chia sẻ → Sao chép liên kết.",
    };
  }

  return {
    kind: "invalid",
    reason: "Dán link YouTube hoặc Google Drive (file đã chia sẻ “ai có link”).",
  };
}

export function isAllowedImageFile(file: File): { ok: true } | { ok: false; message: string } {
  const name = file.name.toLowerCase();
  if (/\.heic$/i.test(name) || /heic/i.test(file.type)) {
    return {
      ok: false,
      message: "Ảnh HEIC (iPhone) chưa hỗ trợ — mở Ảnh → xuất / đổi sang JPG hoặc PNG.",
    };
  }
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(name)) {
    return { ok: false, message: "Chỉ nhận JPG, PNG hoặc WebP" };
  }
  return { ok: true };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
}

export type CropArea = { x: number; y: number; width: number; height: number };

/** Xuất vùng crop ở độ phân giải gốc (không xuống mẫu theo khung màn hình). */
export async function getCroppedImageDataUrl(
  imageSrc: string,
  pixelCrop: CropArea,
  mime: "image/jpeg" | "image/webp" = "image/jpeg",
  quality = 0.92
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(pixelCrop.width));
  const h = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không tạo được ảnh cắt");
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không tải được ảnh để cắt"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

export function readImgWidthPercent(img: HTMLImageElement): number {
  const styleW = String(img.style.width || "").trim();
  if (styleW.endsWith("%")) {
    const n = parseFloat(styleW);
    if (Number.isFinite(n) && n > 0) return Math.min(100, Math.max(10, n));
  }
  const parent = img.parentElement;
  if (parent && parent.clientWidth > 0 && img.clientWidth > 0) {
    return Math.min(100, Math.max(10, Math.round((img.clientWidth / parent.clientWidth) * 100)));
  }
  return 100;
}

/** Góc / preset: giữ tỷ lệ (height auto). */
export function setImgWidthPercent(img: HTMLImageElement, pct: number) {
  const w = Math.min(100, Math.max(10, Math.round(pct)));
  img.style.width = `${w}%`;
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.objectFit = "";
  img.style.display = "block";
}

export type ImgAlign = "left" | "center" | "right";

export function readImgAlign(img: HTMLImageElement): ImgAlign {
  const ml = String(img.style.marginLeft || "").trim().toLowerCase();
  const mr = String(img.style.marginRight || "").trim().toLowerCase();
  const parent = img.parentElement;
  const ta = String(parent?.style?.textAlign || "").toLowerCase();
  if (ml === "auto" && mr === "auto") return "center";
  if (ml === "auto" && (mr === "0px" || mr === "0" || !mr)) return "right";
  if (ta === "center") return "center";
  if (ta === "right") return "right";
  return "left";
}

/** Căn ảnh trong bài kiểu Word: sát trái / giữa / sát phải. */
export function setImgAlign(img: HTMLImageElement, align: ImgAlign) {
  img.style.display = "block";
  img.style.float = "none";
  img.style.maxWidth = "100%";
  const parent = img.closest("p") || img.parentElement;
  if (parent && parent instanceof HTMLElement) {
    parent.style.textAlign = align;
  }
  if (align === "center") {
    img.style.marginLeft = "auto";
    img.style.marginRight = "auto";
  } else if (align === "right") {
    img.style.marginLeft = "auto";
    img.style.marginRight = "0";
  } else {
    img.style.marginLeft = "0";
    img.style.marginRight = "auto";
  }
  // Ảnh full 100% thì căn không thấy — thu nhẹ nếu đang full
  const pct = readImgWidthPercent(img);
  if (pct >= 98 && align !== "left") {
    setImgWidthPercent(img, 75);
  }
}

/**
 * Kéo giữa cạnh kiểu Word (không khóa tỷ lệ):
 * - ngang: chỉ đổi rộng, giữ cao cố định
 * - dọc: chỉ đổi cao, giữ rộng cố định
 */
export function setImgFreeBox(
  img: HTMLImageElement,
  widthPct: number,
  heightPx: number
) {
  const w = Math.min(100, Math.max(10, Math.round(widthPct)));
  const h = Math.max(40, Math.round(heightPx));
  img.style.width = `${w}%`;
  img.style.maxWidth = "100%";
  img.style.height = `${h}px`;
  img.style.objectFit = "fill";
  img.style.display = "block";
}
