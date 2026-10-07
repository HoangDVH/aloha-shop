import sharp, { type OverlayOptions } from "sharp";
import { NextResponse } from "next/server";
import { shopApiBase } from "@/lib/api";
import { getProductByMa } from "@/lib/shopProductServer";
import { absUrl, productHasShareVideo, productShareImages } from "@/lib/seo";

export const runtime = "nodejs";

const W = 1200;
const H = 630;
const GAP = 6;
const MAX_TILES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Box = { x: number; y: number; w: number; h: number };

/** 1 ảnh lớn bên trái (vuông) + ảnh nhỏ bên phải — giống thẻ SP nhiều ảnh của sàn TMĐT. */
function layout(n: number): Box[] {
  if (n <= 1) return [{ x: 0, y: 0, w: W, h: H }];
  const half = (W - GAP) / 2;
  if (n === 2) return [{ x: 0, y: 0, w: half, h: H }, { x: half + GAP, y: 0, w: half, h: H }];
  const main = { x: 0, y: 0, w: H, h: H };
  const rx = H + GAP;
  const rw = W - rx;
  const rh = (H - GAP) / 2;
  if (n === 3) return [main, { x: rx, y: 0, w: rw, h: rh }, { x: rx, y: rh + GAP, w: rw, h: rh }];
  const cw = (rw - GAP) / 2;
  return [
    main,
    { x: rx, y: 0, w: cw, h: rh },
    { x: rx + cw + GAP, y: 0, w: cw, h: rh },
    { x: rx, y: rh + GAP, w: cw, h: rh },
    { x: rx + cw + GAP, y: rh + GAP, w: cw, h: rh },
  ].slice(0, n);
}

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
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= MAX_IMAGE_BYTES ? buf : null;
  } catch {
    return null;
  }
}

function playBadge(box: Box): Buffer {
  const r = 46;
  const cx = box.w / 2;
  const cy = box.h / 2;
  return Buffer.from(
    `<svg width="${box.w}" height="${box.h}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.45)" stroke="#fff" stroke-width="4"/>
      <path d="M ${cx - 14} ${cy - 22} L ${cx + 24} ${cy} L ${cx - 14} ${cy + 22} Z" fill="#fff"/>
    </svg>`
  );
}

function moreBadge(box: Box, more: number): Buffer {
  return Buffer.from(
    `<svg width="${box.w}" height="${box.h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)"/>
      <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">+${more}</text>
    </svg>`
  );
}

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
  if (!item) return fallback();

  const sources = productShareImages(item);
  const loaded = (await Promise.all(sources.slice(0, MAX_TILES).map(loadImage))).filter(
    (b): b is Buffer => Boolean(b)
  );
  if (!loaded.length) return fallback();

  const boxes = layout(loaded.length);
  const more = Math.max(0, sources.length - MAX_TILES);
  const layers: OverlayOptions[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;
    try {
      const tile = await sharp(loaded[i]).rotate().resize(box.w, box.h, { fit: "cover" }).jpeg().toBuffer();
      layers.push({ input: tile, left: box.x, top: box.y });
    } catch {
      continue;
    }
    if (i === 0 && productHasShareVideo(item)) layers.push({ input: playBadge(box), left: box.x, top: box.y });
    if (i === boxes.length - 1 && more > 0 && boxes.length > 1) {
      layers.push({ input: moreBadge(box, more), left: box.x, top: box.y });
    }
  }
  if (!layers.length) return fallback();

  const jpg = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite(layers)
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return new NextResponse(new Uint8Array(jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
