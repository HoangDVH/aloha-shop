/**
 * Origin được phép gọi API shop (cookie / CORS).
 * Exact match — không dùng origin.includes (tránh bypass subdomain).
 */
import type { Response } from "express";

const SHOP_ORIGIN_STATIC = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://shop.alohathegioichaucay.com",
  "http://shop.alohathegioichaucay.com",
]);

const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
/** 10/8, 172.16–31/12, 192.168/16, Radmin thường 26.x — chỉ khi ALLOW_LAN_CORS=1 */
const LAN_OR_VPN_ORIGIN =
  /^http:\/\/((192\.168|10|26)\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/;

function lanCorsAllowed(): boolean {
  const v = String(process.env.ALLOW_LAN_CORS || "").trim();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  // Dev mặc định cho LAN; production/VPS tắt trừ khi bật tay
  if (process.env.ALOHA_IS_VPS === "1" || process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

export function isAllowedShopOrigin(origin: string): boolean {
  if (!origin) return false;
  if (SHOP_ORIGIN_STATIC.has(origin)) return true;
  if (LOCALHOST_ORIGIN.test(origin)) return true;
  if (lanCorsAllowed() && LAN_OR_VPN_ORIGIN.test(origin)) return true;
  return false;
}

export function applyShopCors(
  req: { headers: { origin?: string } },
  res: { setHeader: (k: string, v: string) => void }
) {
  const origin = String(req.headers.origin || "");
  if (origin && isAllowedShopOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Helper cho route tự set CORS (payment bank, orders…). */
export function setShopCorsOnResponse(
  req: { headers: { origin?: string } },
  res: Response
) {
  applyShopCors(req, res);
}
