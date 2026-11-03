import { NextResponse } from "next/server";
import { shopApiBase } from "@/lib/api";
import { absUrl } from "@/lib/seo";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const cid = decodeURIComponent(rawId || "").replace(/\.jpg$/i, "").trim();
  const url = new URL(req.url);
  const v = url.searchParams.get("v") || "";

  const fallback = () => NextResponse.redirect(absUrl("/brand/logo-aloha.png"), 302);

  try {
    const apiTarget = `${shopApiBase()}/api/shop/campaigns/og-image.jpg?${cid ? `cid=${encodeURIComponent(cid)}&` : ""}v=${encodeURIComponent(v)}`;
    const res = await fetch(apiTarget, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/jpeg,image/*;q=0.8" },
      cache: "no-store",
    });

    if (!res.ok) {
      return fallback();
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf || buf.length < 100) {
      return fallback();
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return fallback();
  }
}
