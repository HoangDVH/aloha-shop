import type { ShopProduct } from "@/lib/api";

const YOUTUBE_RE = /youtube\.com|youtu\.be|youtube-nocookie/i;

/** Video file chạy được bằng thẻ <video> (R2 / uploads / .mp4…); YouTube thì không. */
export function isFileVideo(url: string): boolean {
  if (!url || YOUTUBE_RE.test(url)) return false;
  if (/r2\.dev/i.test(url) || /\/uploads\//i.test(url)) return true;
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function productVideoUrls(p: Pick<ShopProduct, "videos" | "videoUrl">): string[] {
  const list = [...(p.videos || []), p.videoUrl || ""].map((s) => String(s || "").trim()).filter(Boolean);
  return [...new Set(list)];
}

export function firstFileVideo(p: Pick<ShopProduct, "videos" | "videoUrl">): string {
  return productVideoUrls(p).find(isFileVideo) || "";
}
