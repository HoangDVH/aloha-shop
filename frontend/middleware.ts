import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

let redirectCache: { map: Record<string, string>; at: number } | null = null;
const REDIRECT_TTL_MS = 30_000;

/** Fallback khi API redirects chưa deploy / Mongo trống — URL sitelink KiotViet. */
const BUILTIN_REDIRECTS: Record<string, string> = {
  "/page/ve-chung-toi-14387a": "/",
  "/page/khuyen-mai-1c107c": "/",
  "/branches": "/",
  "/c/cay-phong-thuy-3ac9d3": "/danh-muc/cay-phong-thuy",
  "/c/cay-binh-an-a476a9": "/danh-muc/cay-binh-an",
  "/c/chau-men-hoa-bien-406561": "/",
};

function apiOrigin(): string {
  return (
    process.env.SHOP_API_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

async function getRedirectMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (redirectCache && now - redirectCache.at < REDIRECT_TTL_MS) {
    return redirectCache.map;
  }
  try {
    const res = await fetch(`${apiOrigin()}/api/shop/redirects/map`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      const fallback = { ...BUILTIN_REDIRECTS };
      redirectCache = { map: fallback, at: now };
      return fallback;
    }
    const data = (await res.json()) as { map?: Record<string, string> };
    const map = {
      ...BUILTIN_REDIRECTS,
      ...(data.map && typeof data.map === "object" ? data.map : {}),
    };
    redirectCache = { map, at: now };
    return map;
  } catch {
    const fallback = redirectCache?.map || { ...BUILTIN_REDIRECTS };
    return fallback;
  }
}

/**
 * 301 SEO redirects + fail-nhanh Server Action ID giả.
 */
export async function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") {
    const path = req.nextUrl.pathname.replace(/\/$/, "") || "/";
    if (path !== "/") {
      const map = await getRedirectMap();
      const to = map[path] || map[req.nextUrl.pathname];
      if (to && to !== path && to !== req.nextUrl.pathname) {
        const url = req.nextUrl.clone();
        if (to.startsWith("http")) {
          return NextResponse.redirect(to, 301);
        }
        url.pathname = to.split("?")[0] || to;
        const q = to.includes("?") ? to.slice(to.indexOf("?") + 1) : "";
        if (q) {
          url.search = `?${q}`;
        }
        return NextResponse.redirect(url, 301);
      }
    }
  }

  if (req.method !== "POST") return NextResponse.next();

  const actionId = req.headers.get("next-action");
  if (actionId == null) return NextResponse.next();

  const id = actionId.trim();
  const looksValid = id.length >= 16 && /^[0-9a-fA-F._-]+$/.test(id);
  if (!looksValid) {
    return NextResponse.json(
      { error: "Invalid Server Action id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|uploads/|api/).*)"],
};
