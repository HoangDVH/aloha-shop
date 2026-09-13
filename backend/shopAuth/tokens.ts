/**
 * JWT cookie phiên web bán — tách biệt aloha_access/refresh của app nội bộ.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";

const ACCESS_COOKIE = "shop_access";
const REFRESH_COOKIE = "shop_refresh";
const ACCESS_TTL_SEC = Number(process.env.JWT_SHOP_ACCESS_TTL_SEC || process.env.JWT_ACCESS_TTL_SEC || 60 * 60);
const REFRESH_TTL_SEC = Number(
  process.env.JWT_SHOP_REFRESH_TTL_SEC || process.env.JWT_REFRESH_TTL_SEC || 60 * 60 * 24 * 14
);

export type ShopAccessPayload = {
  sub: string;
  email: string;
  roles: string[];
};

const DEV_ACCESS_FALLBACK = "aloha-shop-dev-access-change-me";
const DEV_REFRESH_FALLBACK = "aloha-shop-dev-refresh-change-me";

function isShopProductionRuntime(): boolean {
  return (
    process.env.ALOHA_IS_VPS === "1" || process.env.NODE_ENV === "production"
  );
}

export function shopAccessSecret(): string {
  const s =
    process.env.JWT_SHOP_ACCESS_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    "";
  if (s.trim()) return s.trim();
  if (isShopProductionRuntime()) {
    throw new Error(
      "Missing JWT_SHOP_ACCESS_SECRET (or JWT_ACCESS_SECRET) in production"
    );
  }
  return DEV_ACCESS_FALLBACK;
}

export function shopRefreshSecret(): string {
  const s =
    process.env.JWT_SHOP_REFRESH_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    "";
  if (s.trim()) return s.trim();
  if (isShopProductionRuntime()) {
    throw new Error(
      "Missing JWT_SHOP_REFRESH_SECRET (or JWT_REFRESH_SECRET) in production"
    );
  }
  return DEV_REFRESH_FALLBACK;
}

/** Secret ký quote ship — tách access token; dev fallback access. */
export function shopQuoteSecret(): string {
  const s = String(process.env.JWT_SHOP_QUOTE_SECRET || "").trim();
  if (s) return s;
  if (isShopProductionRuntime()) {
    // Production: bắt buộc quote secret riêng hoặc reuse access đã cấu hình
    return shopAccessSecret();
  }
  try {
    return shopAccessSecret();
  } catch {
    return DEV_ACCESS_FALLBACK;
  }
}

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "0" || process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function signShopAccessToken(payload: ShopAccessPayload): string {
  return jwt.sign(payload, shopAccessSecret(), { expiresIn: ACCESS_TTL_SEC });
}

export function signShopRefreshToken(payload: ShopAccessPayload & { jti: string }): string {
  return jwt.sign(payload, shopRefreshSecret(), { expiresIn: REFRESH_TTL_SEC });
}

export function verifyShopAccessToken(token: string): ShopAccessPayload {
  return jwt.verify(token, shopAccessSecret()) as ShopAccessPayload;
}

export function verifyShopRefreshToken(token: string): ShopAccessPayload & { jti: string } {
  return jwt.verify(token, shopRefreshSecret()) as ShopAccessPayload & { jti: string };
}

export function newShopRefreshJti(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashShopToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function baseCookieOpts() {
  return {
    httpOnly: true as const,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setShopAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOpts(),
    maxAge: ACCESS_TTL_SEC * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOpts(),
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}

export function clearShopAuthCookies(res: Response) {
  const opts = baseCookieOpts();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

export { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_TTL_SEC, REFRESH_TTL_SEC };
