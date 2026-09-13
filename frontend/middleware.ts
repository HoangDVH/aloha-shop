import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Fail-nhanh Server Action ID giả/lệch (vd. autocannon / bot gửi "x").
 * Không đụng luồng Action hợp lệ từ browser (ID hash dài).
 * Ref: https://nextjs.org/docs/messages/failed-to-find-server-action
 */
export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const actionId = req.headers.get("next-action");
  if (actionId == null) return NextResponse.next();

  const id = actionId.trim();
  // ID hợp lệ của Next thường là chuỗi hash dài; "x" / rác ngắn → 400 ngay
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
  matcher: [
    /*
     * Chạy trên mọi path trừ static — Action POST vào page routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|uploads/).*)",
  ],
};
