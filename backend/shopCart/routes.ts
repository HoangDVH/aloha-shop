import type { Express, Response } from "express";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import {
  SHOP_CARTS,
  ensureShopCartIndexes,
  mergeCartLines,
  normalizeCartLines,
  type CartLineDoc,
} from "./models.js";

const SHOP_ORIGIN_ALLOW = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
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

function cartPayload(lines: CartLineDoc[], updatedAt: Date) {
  return {
    ok: true,
    lines,
    updatedAt: updatedAt.toISOString(),
  };
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
        if (!row) {
          return res.json(cartPayload([], new Date(0)));
        }
        const lines = normalizeCartLines(row.lines);
        const updatedAt = row.updatedAt ? new Date(row.updatedAt as Date) : new Date(0);
        return res.json(cartPayload(lines, updatedAt));
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
        const lines = normalizeCartLines(req.body?.lines);
        const now = new Date();
        await db.collection(SHOP_CARTS).updateOne(
          { userId: req.shopAuth!.userId },
          {
            $set: { lines, updatedAt: now },
            $setOnInsert: { userId: req.shopAuth!.userId, createdAt: now },
          },
          { upsert: true }
        );
        return res.json(cartPayload(lines, now));
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "cart_put_failed" });
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
        const guest = normalizeCartLines(req.body?.lines);
        const row = await db.collection(SHOP_CARTS).findOne({ userId: req.shopAuth!.userId });
        const server = normalizeCartLines(row?.lines);
        const merged = mergeCartLines(server, guest);
        const now = new Date();
        await db.collection(SHOP_CARTS).updateOne(
          { userId: req.shopAuth!.userId },
          {
            $set: { lines: merged, updatedAt: now },
            $setOnInsert: { userId: req.shopAuth!.userId, createdAt: now },
          },
          { upsert: true }
        );
        return res.json(cartPayload(merged, now));
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "cart_merge_failed" });
      }
    }
  );
}
