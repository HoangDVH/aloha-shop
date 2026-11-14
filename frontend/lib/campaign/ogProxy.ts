import { NextResponse } from "next/server";
import { shopApiBase } from "@/lib/api";
import { absUrl } from "@/lib/seo";

/**
 * Proxy ảnh OpenGraph chiến dịch từ backend về Next.js route (`/og/...`)
 * để Facebook/Zalo tải trực tiếp cùng origin HTTPS với đúng Content-Type/Content-Length.
 */
export async function proxyCampaignOgImage(req: Request, explicitCid?: string): Promise<NextResponse> {
  const url = new URL(req.url);
  const v = url.searchParams.get("v") || "";
  const fit = url.searchParams.get("fit") || "";
  const cid = (explicitCid ?? url.searchParams.get("cid") ?? "").trim();

  const fallback = () => NextResponse.redirect(absUrl("/brand/logo-aloha.png"), 302);

  try {
    const apiTarget = `${shopApiBase()}/api/shop/campaigns/og-image.jpg?${
      cid ? `cid=${encodeURIComponent(cid)}&` : ""
    }${fit ? `fit=${encodeURIComponent(fit)}&` : ""}v=${encodeURIComponent(v)}`;
    const res = await fetch(apiTarget, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/jpeg,image/*;q=0.8" },
      cache: "no-store",
    });

    if (!res.ok) return fallback();

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf || buf.length < 100) return fallback();

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": v
          ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800"
          : "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return fallback();
  }
}
