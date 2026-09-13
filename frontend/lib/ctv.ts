/** Mã CTV trên web bán — chỉ localStorage/cookie + API shop, không đụng app nội bộ. */

export const CTV_STORAGE_KEY = "aloha_ctv_code";
export const CTV_GUEST_KEY = "aloha_ctv_guest";
const CTV_TTL_DAYS = 30;

export function normalizeCtvCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

export function isValidCtvCode(code: string): boolean {
  const c = normalizeCtvCode(code);
  return c.length >= 3 && c.length <= 20;
}

function cookieMaxAge(): number {
  return CTV_TTL_DAYS * 24 * 60 * 60;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const maxAge = cookieMaxAge();
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(p.slice(name.length + 1));
      } catch {
        return p.slice(name.length + 1);
      }
    }
  }
  return "";
}

/** Mã CTV của cộng tác viên (dùng khi copy link). */
export function getAffiliateCtvCode(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromLs = normalizeCtvCode(localStorage.getItem(CTV_STORAGE_KEY) || "");
    if (isValidCtvCode(fromLs)) return fromLs;
  } catch {
    /* ignore */
  }
  const fromCk = normalizeCtvCode(readCookie(CTV_STORAGE_KEY));
  return isValidCtvCode(fromCk) ? fromCk : "";
}

export function setAffiliateCtvCode(raw: string): string {
  const code = normalizeCtvCode(raw);
  if (!isValidCtvCode(code)) return "";
  try {
    localStorage.setItem(CTV_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  writeCookie(CTV_STORAGE_KEY, code);
  return code;
}

/** Mã CTV khách nhận từ link (?ctv=) — gắn giỏ / theo dõi. */
export function getGuestCtvCode(): string {
  if (typeof window === "undefined") return "";
  try {
    // Ưu tiên từ URL (trường hợp user bấm ngay sau khi mở link, effect setGuest chưa kịp).
    const u = new URL(window.location.href);
    const fromQs = normalizeCtvCode(u.searchParams.get("ctv") || "");
    if (isValidCtvCode(fromQs)) return fromQs;

    const fromLs = normalizeCtvCode(localStorage.getItem(CTV_GUEST_KEY) || "");
    if (isValidCtvCode(fromLs)) return fromLs;
  } catch {
    /* ignore */
  }
  const fromCk = normalizeCtvCode(readCookie(CTV_GUEST_KEY));
  return isValidCtvCode(fromCk) ? fromCk : "";
}

export function setGuestCtvCode(raw: string): string {
  const code = normalizeCtvCode(raw);
  if (!isValidCtvCode(code)) return "";
  try {
    localStorage.setItem(CTV_GUEST_KEY, code);
  } catch {
    /* ignore */
  }
  writeCookie(CTV_GUEST_KEY, code);
  return code;
}

/** Link chia sẻ ngắn /sp/MÃ — Messenger hay nhớ bản trống của URL dài; URL mới tránh cache đó. */
export function buildProductShareUrl(
  productPath: string,
  ctv?: string,
  ma?: string
): string {
  const origin =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SHOP_ORIGIN?.replace(/\/$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const codeMa = String(ma || "")
    .trim()
    .toUpperCase();
  const path = codeMa
    ? `/sp/${encodeURIComponent(codeMa)}`
    : productPath.startsWith("/")
      ? productPath
      : `/${productPath}`;
  const url = new URL(`${origin}${path}`);
  const code = normalizeCtvCode(ctv || "");
  if (isValidCtvCode(code)) url.searchParams.set("ctv", code);
  return url.toString();
}

export async function reportCtvClick(payload: {
  ctv: string;
  ma?: string;
  path?: string;
}): Promise<void> {
  const ctv = normalizeCtvCode(payload.ctv);
  if (!isValidCtvCode(ctv)) return;
  try {
    await fetch("/api/shop/ctv/click", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        ctv,
        ma: payload.ma ? String(payload.ma).trim() : undefined,
        path: payload.path ? String(payload.path).trim() : undefined,
      }),
      keepalive: true,
    });
  } catch {
    /* không chặn UI */
  }
}
