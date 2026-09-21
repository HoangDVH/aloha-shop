import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

let redirectCache: { map: Record<string, string>; at: number } | null = null;
const REDIRECT_TTL_MS = 30_000;

/** Fallback khi API redirects chưa deploy / Mongo trống — URL sitelink KiotViet. */
const BUILTIN_REDIRECTS: Record<string, string> = {
  "/page/ve-chung-toi-14387a": "/ve-aloha",
  "/page/khuyen-mai-1c107c": "/",
  "/branches": "/",
  "/branch-deactivate": "/",
  "/[platform]/[namespace]/[branchId]/[locationId]": "/",
  "/c/cay-phong-thuy-3ac9d3": "/danh-muc/cay-phong-thuy",
  "/c/cay-binh-an-a476a9": "/danh-muc/cay-binh-an",
  "/c/chau-men-hoa-bien-406561": "/danh-muc/chau-men-hoa-bien",
};

/** Slug KiotViet ≠ slug shop (một số nhóm đổi tên). */
const SLUG_ALIASES: Record<string, string> = {
  "cay-canh": "cay-canh-du-loai",
};

/** Path gốc shop — không coi là URL KiotViet dạng slug-hash. */
const RESERVED_ROOT = new Set([
  "admin",
  "api",
  "bai-viet",
  "brand",
  "c",
  "cho-duyet-ctv",
  "dang-ky",
  "dang-nhap",
  "danh-muc",
  "don-hang",
  "gio-hang",
  "page",
  "products",
  "sp",
  "tai-khoan",
  "tim",
  "tuyen-ctv",
  "uploads",
  "ve-aloha",
  "xac-nhan-don-hang",
  "branches",
]);

/** `/foo-bar-53d07e` hoặc `/c/foo-bar-53d07e` → slug không gồm hash. */
const KV_HASH_SUFFIX = /^(.+)-([a-f0-9]{4,8})$/i;

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

function resolveKiotVietPath(path: string): string | null {
  if (!path || path === "/") return null;

  // /page/... → trang chủ
  if (path === "/page" || path.startsWith("/page/")) return "/";

  // /products/... → tìm kiếm (PDP cũ KiotViet)
  if (path === "/products" || path.startsWith("/products/")) return "/tim";

  // /blogs/... → blog shop mới (URL KV / soft 404 cũ)
  if (path === "/blogs" || path.startsWith("/blogs/")) return "/bai-viet";

  // /branch-deactivate → trang chủ
  if (path === "/branch-deactivate") return "/";

  // /branches → trang chủ
  if (path === "/branches") return "/";

  // /c/{slug-hash} (không có /p/ — danh mục KV) → /danh-muc/{slug}
  const cOnly = path.match(/^\/c\/([^/]+)$/);
  if (cOnly) {
    const seg = cOnly[1];
    const m = seg.match(KV_HASH_SUFFIX);
    if (m) {
      const slug = SLUG_ALIASES[m[1]] || m[1];
      return `/danh-muc/${slug}`;
    }
  }

  // /{slug-hash} gốc → /danh-muc/{slug}
  const root = path.match(/^\/([^/]+)$/);
  if (root) {
    const seg = root[1];
    if (RESERVED_ROOT.has(seg.toLowerCase())) return null;
    const m = seg.match(KV_HASH_SUFFIX);
    if (m) {
      const slug = SLUG_ALIASES[m[1]] || m[1];
      return `/danh-muc/${slug}`;
    }
  }

  return null;
}

/**
 * 301 SEO redirects + fail-nhanh Server Action ID giả.
 */
export async function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") {
    const path = req.nextUrl.pathname.replace(/\/$/, "") || "/";
    if (path !== "/") {
      const map = await getRedirectMap();
      const to =
        map[path] || map[req.nextUrl.pathname] || resolveKiotVietPath(path);
      if (to && to !== path && to !== req.nextUrl.pathname) {
        const url = req.nextUrl.clone();
        if (to.startsWith("http")) {
          return NextResponse.redirect(to, 301);
        }
        url.pathname = to.split("?")[0] || to;
        const q = to.includes("?") ? to.slice(to.indexOf("?") + 1) : "";
        url.search = q ? `?${q}` : "";
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
