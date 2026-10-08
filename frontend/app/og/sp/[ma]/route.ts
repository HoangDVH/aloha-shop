import sharp from "sharp";
import { NextResponse } from "next/server";
import { shopApiBase } from "@/lib/api";
import { getProductByMa } from "@/lib/shopProductServer";
import { OG_H, OG_W, absUrl, productOgSource } from "@/lib/seo";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function sourceUrl(src: string): string {
  if (src.startsWith("/uploads/")) return `${shopApiBase()}${src}`;
  return absUrl(src);
}

async function loadImage(src: string): Promise<Buffer | null> {
  try {
    const res = await fetch(sourceUrl(src), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/*;q=0.8" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= MAX_IMAGE_BYTES ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Ảnh thẻ link Facebook/Zalo của SP: JPEG 1200×630 trên tên miền shop, ảnh SP nằm trọn ở giữa trên nền mờ của chính nó.
 * Facebook cắt ảnh vuông thành 1.91:1 và hay bỏ qua ảnh CDN KiotViet (đuôi .png nhưng nội dung JPEG).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ma: string }> }) {
  const { ma: raw } = await params;
  const ma = decodeURIComponent(raw || "").trim();
  const fallback = () => NextResponse.redirect(absUrl("/brand/logo-aloha.png"), 302);
  if (!ma || ma.length > 64) return fallback();

  let item;
  try {
    item = (await getProductByMa(ma)).item;
  } catch {
    item = null;
  }
  const src = item ? productOgSource(item) : "";
  const buf = src ? await loadImage(src) : null;
  if (!buf) return fallback();

  let jpg: Buffer;
  try {
    const base = sharp(buf).rotate();
    const [bg, fg] = await Promise.all([
      base.clone().resize(OG_W, OG_H, { fit: "cover" }).blur(28).modulate({ brightness: 0.92 }).toBuffer(),
      base.clone().resize(OG_H, OG_H, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).toBuffer(),
    ]);
    jpg = await sharp(bg)
      .composite([{ input: fg, left: Math.round((OG_W - OG_H) / 2), top: 0 }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    return fallback();
  }

  return new NextResponse(new Uint8Array(jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
