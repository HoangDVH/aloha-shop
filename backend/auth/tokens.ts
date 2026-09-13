import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";

const ACCESS_COOKIE = "aloha_access";
const REFRESH_COOKIE = "aloha_refresh";
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 60 * 60); // 1h
const REFRESH_TTL_SEC = Number(process.env.JWT_REFRESH_TTL_SEC || 60 * 60 * 24 * 14); // 14d

export function accessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || "aloha-dev-access-change-me";
}

export function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || "aloha-dev-refresh-change-me";
}

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "0" || process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export type AccessPayload = {
  sub: string;
  username: string;
  role: "manager" | "staff";
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: ACCESS_TTL_SEC });
}

export function signRefreshToken(payload: AccessPayload & { jti: string }): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: REFRESH_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, accessSecret()) as AccessPayload;
}

export function verifyRefreshToken(token: string): AccessPayload & { jti: string } {
  return jwt.verify(token, refreshSecret()) as AccessPayload & { jti: string };
}

export function newRefreshJti(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashToken(token: string): string {
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

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOpts(),
    maxAge: ACCESS_TTL_SEC * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOpts(),
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const opts = baseCookieOpts();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

export { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_TTL_SEC, REFRESH_TTL_SEC };
