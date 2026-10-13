import crypto from "node:crypto";
import type { Express } from "express";
import type { Db } from "mongodb";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { loadPurchasePolicy, purchasePolicySchema, purchaseGroupSchema, purchaseGroup } from "./purchasePolicy.js";
import { checkWholesalePurchase } from "./purchaseCheck.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { applyCatalogPrices, parseOrderDetails } from "../shopOrders/orderRouteShared.js";
import { syncBus } from "../syncBus.js";
import { z } from "zod";
import { isAllowedShopOrigin } from "../shopCors.js";

export function registerPurchasePolicyRoutes(app: Express, getShop: () => Promise<Db>, getOps: () => Promise<Db>) {
  const gate = [requireAuth(getOps), requireActive, requireManager];
  app.use("/api/shop/admin/wholesale-policy", (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== "GET" && req.headers.origin && !isAllowedShopOrigin(req.headers.origin)) return res.sendStatus(403);
    next();
  });
  app.get("/api/shop/wholesale-policy", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { res.json(await loadPurchasePolicy(await getShop())); }
    catch { res.status(503).json({ error: "Chưa tải được chính sách mua sỉ" }); }
  });
  app.get("/api/shop/admin/wholesale-policy", ...gate, async (_req, res) => {
    try { res.json(await loadPurchasePolicy(await getShop())); }
    catch { res.status(503).json({ error: "Chưa tải được chính sách mua sỉ" }); }
  });
  app.patch("/api/shop/admin/wholesale-policy", ...gate, async (req: AuthRequest, res) => {
    try {
      const input = z.object({ rules: purchasePolicySchema, version: z.string().min(1).max(100) }).parse(req.body);
      const db = await getShop();
      const current = await loadPurchasePolicy(db);
      if (current.version !== input.version) return res.status(409).json({ error: "Chính sách vừa thay đổi, vui lòng tải lại." });
      await db.collection("aloha_shop_purchase_policy").createIndex({ key: 1 }, { unique: true });
      const version = crypto.randomUUID();
      const result = await db.collection("aloha_shop_purchase_policy").updateOne({ key: "wholesale", version: input.version }, {
        $set: { key: "wholesale", rules: input.rules, version, updatedAt: new Date().toISOString(), updatedBy: req.auth!.userId },
        $push: { audit: { version, previous: current, actor: req.auth!.userId, at: new Date().toISOString() } } as any,
      }, { upsert: true });
      if (!result.modifiedCount && !result.upsertedCount) return res.status(409).json({ error: "Chính sách vừa thay đổi, vui lòng tải lại." });
      syncBus.publish(["aloha_shop_purchase_policy"], "wholesale_policy");
      res.json({ ...input.rules, version });
    } catch (error: any) { res.status(error.code === 11000 ? 409 : error.issues ? 400 : 503).json({ error: error.code === 11000 ? "Chính sách vừa thay đổi, vui lòng tải lại." : "Không lưu được chính sách hợp lệ." }); }
  });
  app.get("/api/shop/admin/wholesale-policy/products/:ma", ...gate, async (req, res) => {
    try {
      const product = await (await getShop()).collection("aloha_products").findOne({ ma: String(req.params.ma).trim().toUpperCase(), deletedAt: null });
      if (!product) return res.sendStatus(404);
      res.json({ group: purchaseGroup(product), configured: product.siPurchaseGroup || null });
    } catch { res.status(503).json({ error: "Chưa tải được nhóm hàng" }); }
  });
  app.patch("/api/shop/admin/wholesale-policy/products/:ma", ...gate, async (req: AuthRequest, res) => {
    try {
      const { group } = z.object({ group: purchaseGroupSchema.nullable() }).parse(req.body);
      const ma = String(req.params.ma).trim().toUpperCase();
      const result = await (await getShop()).collection("aloha_products").updateOne({ ma, deletedAt: null }, {
        ...(group ? { $set: { siPurchaseGroup: group } } : { $unset: { siPurchaseGroup: "" } }),
        $push: { siPurchaseAudit: { group, actor: req.auth!.userId, at: new Date().toISOString() } } as any,
      });
      if (!result.matchedCount) return res.sendStatus(404);
      syncBus.publish(["aloha_products"], "si_purchase_group", { ids: [ma] });
      res.json({ ok: true });
    } catch { res.status(400).json({ error: "Nhóm hàng mua sỉ không hợp lệ" }); }
  });
  app.post("/api/shop/admin/wholesale-policy/check", ...gate, async (req, res) => {
    try {
      const input = z.object({ accountId: z.string().min(1), items: z.array(z.object({ productCode: z.string().min(1), quantity: z.number().int().min(1).max(10000) })).min(1).max(100),
        deliveryMethod: z.enum(["giao_tan_noi", "nhan_cua_hang"]).optional(), province: z.string().max(120).optional() }).parse(req.body);
      const shop = await getShop();
      const account = await shop.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(input.accountId));
      if (!account) return res.sendStatus(404);
      const priced = await applyCatalogPrices(shop, parseOrderDetails(input.items), { account, quoteOnly: true });
      if (!priced.ok) return res.status(400).json({ error: priced.error });
      res.json(await checkWholesalePurchase(shop, await getOps(), account, priced.details, input));
    } catch { res.status(400).json({ error: "Chưa kiểm tra được điều kiện đơn hàng" }); }
  });
}
