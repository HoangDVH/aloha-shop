/**
 * CORS handling for shop catalog API.
 */
import type { Request, Response } from "express";

export const SHOP_ORIGIN_ALLOW = [
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://alohathegioichaucay.com",
  "https://www.alohathegioichaucay.com",
  "http://alohathegioichaucay.com",
  "http://www.alohathegioichaucay.com",
  // Giữ subdomain cũ trong giai đoạn chuyển miền / redirect
  "https://shop.alohathegioichaucay.com",
  "http://shop.alohathegioichaucay.com",
];

export function setCors(req: Request, res: Response) {
  const origin = String(req.headers.origin || "");
  if (origin && SHOP_ORIGIN_ALLOW.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    /* same-origin / server fetch */
  } else if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (
    origin &&
    (SHOP_ORIGIN_ALLOW.includes(origin) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:"))
  ) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}
