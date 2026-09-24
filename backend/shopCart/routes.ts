import type { Express, Response } from "express";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import {
  SHOP_CARTS,
  ensureShopCartIndexes,
  normalizeCartLines,
} from "./models.js";
import { cartPayload, CartWriteError, mergeCart, saveCart } from "./writes.js";

const SHOP_ORIGIN_ALLOW = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://alohathegioichaucay.com",
  "https://www.alohathegioichaucay.com",
  "http://alohathegioichaucay.com",
  "http://www.alohathegioichaucay.com",
  "https://shop.alohathegioichaucay.com",
  "http://shop.alohathegioichaucay.com",
]);

function setCors(req: { headers: { origin?: string } }, res: Response) {
  const origin = String(req.headers.origin || "");
  if (origin && (SHOP_ORIGIN_ALLOW.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function writeError(res: Response, error: any) {
  if (error instanceof CartWriteError) return res.status(error.status).json({ error: error.message, code: error.code });
  return res.status(500).json({ error: "Không đồng bộ được giỏ hàng. Vui lòng thử lại." });
}

export function registerShopCartRoutes(app: Express, getShopDb: GetShopDb) {
  let indexesReady = false;
  const ensureIdx = async () => {
    if (indexesReady) return;
    const db = await getShopDb();
    await ensureShopCartIndexes(db);
    indexesReady = true;
  };

  app.options("/api/shop/cart", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/cart/merge", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });

  const withCors = (req: { headers: { origin?: string } }, res: Response, next: () => void) => {
    setCors(req, res);
    res.setHeader("Cache-Control", "private, no-store");
    next();
  };

  app.get(
    "/api/shop/cart",
    withCors,
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        await ensureIdx();
        const db = await getShopDb();
        const row = await db.collection(SHOP_CARTS).findOne({ userId: req.shopAuth!.userId });
        return res.json(cartPayload(row, req.shopAuth!.userId));
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "cart_get_failed" });
      }
    }
  );

  app.put(
    "/api/shop/cart",
    withCors,
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        await ensureIdx();
        const db = await getShopDb();
        if (req.body?.userId !== req.shopAuth!.userId) return res.status(409).json({ error: "Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.", code: "cart_session_changed" });
        const lines = normalizeCartLines(req.body?.lines);
        return res.json(await saveCart(db.collection(SHOP_CARTS), req.shopAuth!.userId, lines, req.body?.revision));
      } catch (e: any) {
        return writeError(res, e);
      }
    }
  );

  /** Gộp giỏ máy hiện tại (khách) vào giỏ tài khoản — dùng khi đăng nhập / mở app. */
  app.post(
    "/api/shop/cart/merge",
    withCors,
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        await ensureIdx();
        const db = await getShopDb();
        if (req.body?.userId !== req.shopAuth!.userId) return res.status(409).json({ error: "Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.", code: "cart_session_changed" });
        const guest = normalizeCartLines(req.body?.lines);
        return res.json(await mergeCart(db.collection(SHOP_CARTS), req.shopAuth!.userId, guest, req.body?.idempotencyKey));
      } catch (e: any) {
        return writeError(res, e);
      }
    }
  );
}
