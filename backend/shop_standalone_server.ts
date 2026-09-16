/**
 * Server API độc lập dành riêng cho ALOHA Shop.
 * Shop data + staff auth: SHOP_STANDALONE_DB (aloha_shop_db) — không dùng DB Garden.
 * App nội bộ Garden giữ MONGO/DB riêng (aloha_thumua*).
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { MongoClient, Db } from 'mongodb';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import { registerShopApi } from './shopCatalog/register.js';
import { registerShopAuthRoutes } from './shopAuth/routes.js';
import { registerShopAddressRoutes } from './shopOrders/addressRoutes.js';
import { registerShopCartRoutes } from './shopCart/routes.js';
import { registerShopOrderRoutes } from './shopOrders/routes.js';
import { registerShopPaymentRoutes } from './shopOrders/paymentRoutes.js';
import { registerShopShippingRoutes } from './shopShipping/routes.js';
import { registerShopCtvMeRoutes } from './shopOrders/ctvMeRoutes.js';
import { registerShopAppearanceRoutes } from './shopAppearance/register.js';
import { registerShopArticlesRoutes } from './shopArticles/register.js';
import { registerShopProductsAdminRoutes } from './shopAppearance/productsAdmin.js';
import { registerShopSeoRedirectRoutes } from './shopSeo/redirects.js';
import { registerShopAccountsAdminRoutes } from './shopAuth/adminRoutes.js';
import { registerShopCommissionAdminRoutes } from './shopOrders/commissionAdminRoutes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { applyShopCors } from './shopCors.js';
import { syncBus } from './syncBus.js';
import { redisReady, redisSubscribeChanges } from './redis.js';
import {
  startShopKvStockPoller,
  runShopKvStockPoll,
} from './shopCatalog/kvStockPoller.js';

const PORT = Number(process.env.SHOP_SERVER_PORT || 3001);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.SHOP_STANDALONE_DB || 'aloha_shop_db';
const OPS_MONGO_URI = (process.env.MONGO_URI_OPS || MONGO_URI).trim();
/** Mặc định cùng DB shop — tài khoản admin nằm trong aloha_shop_db. */
const OPS_DB_NAME = (process.env.OPS_DB_NAME || DB_NAME || 'aloha_shop_db').trim();

let mongoClient: MongoClient | null = null;
let dbInstance: Db | null = null;
let opsClient: MongoClient | null = null;
let opsDbInstance: Db | null = null;
let shopDbReadyLogged = false;
let opsDbReadyLogged = false;

async function clientAlive(client: MongoClient | null): Promise<boolean> {
  if (!client) return false;
  try {
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

async function closeClient(client: MongoClient | null) {
  if (!client) return;
  try {
    await client.close();
  } catch {
    /* ignore */
  }
}

async function getDb(): Promise<Db> {
  if (dbInstance && (await clientAlive(mongoClient))) return dbInstance;

  await closeClient(mongoClient);
  mongoClient = null;
  dbInstance = null;
  // Cùng URI → ops cũng phải bỏ cache client chết (tránh Topology is closed).
  if (OPS_MONGO_URI === MONGO_URI) {
    opsClient = null;
    opsDbInstance = null;
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
  } catch (e) {
    await closeClient(client);
    throw e;
  }
  mongoClient = client;
  dbInstance = client.db(DB_NAME);
  if (!shopDbReadyLogged) {
    console.log(`✅ Shop Server đã kết nối MongoDB shop [${DB_NAME}]`);
    shopDbReadyLogged = true;
  }
  return dbInstance;
}

async function getOpsDb(): Promise<Db> {
  if (OPS_MONGO_URI === MONGO_URI) {
    await getDb();
    opsDbInstance = mongoClient!.db(OPS_DB_NAME);
    if (!opsDbReadyLogged) {
      console.log(`✅ Staff auth DB (ops) [${OPS_DB_NAME}]`);
      opsDbReadyLogged = true;
    }
    return opsDbInstance;
  }

  if (opsDbInstance && (await clientAlive(opsClient))) return opsDbInstance;

  await closeClient(opsClient);
  opsClient = null;
  opsDbInstance = null;

  const client = new MongoClient(OPS_MONGO_URI);
  try {
    await client.connect();
  } catch (e) {
    await closeClient(client);
    throw e;
  }
  opsClient = client;
  opsDbInstance = client.db(OPS_DB_NAME);
  if (!opsDbReadyLogged) {
    console.log(`✅ Staff auth DB (ops) [${OPS_DB_NAME}]`);
    opsDbReadyLogged = true;
  }
  return opsDbInstance;
}

const app = express();

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  applyShopCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
const uploadsFallbackOrigin = (
  process.env.UPLOADS_FALLBACK_ORIGIN ||
  process.env.SHOP_PUBLIC_URL ||
  ''
).replace(/\/$/, '');
if (uploadsFallbackOrigin) {
  app.use('/uploads', async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    try {
      const rel = String(req.path || '').replace(/^\/+/, '');
      if (!rel || rel.includes('..')) return next();
      const dest = path.resolve(uploadsDir, rel);
      if (!dest.startsWith(path.resolve(uploadsDir) + path.sep)) return next();
      const upstream = await fetch(`${uploadsFallbackOrigin}/uploads/${rel}`);
      if (!upstream.ok) return next();
      const buf = Buffer.from(await upstream.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).send(buf);
    } catch {
      return next();
    }
  });
  console.log(`[uploads] fallback → ${uploadsFallbackOrigin}`);
}

// Staff auth (ops DB) + shop storefront + admin
registerAuthRoutes(app, getOpsDb);
registerShopApi(app, getDb, getDb);
registerShopAuthRoutes(app, getDb);
registerShopAddressRoutes(app, getDb);
registerShopCartRoutes(app, getDb);
registerShopOrderRoutes(app, getDb, getOpsDb);
registerShopPaymentRoutes(app, getDb, getOpsDb);
registerShopShippingRoutes(app, getDb, getOpsDb);
registerShopCtvMeRoutes(app, getDb, getOpsDb);
registerShopAppearanceRoutes(app, getOpsDb, getDb);
registerShopArticlesRoutes(app, getOpsDb, getDb);
registerShopProductsAdminRoutes(app, getOpsDb, getDb);
registerShopSeoRedirectRoutes(app, getOpsDb, getDb);
registerShopAccountsAdminRoutes(app, getOpsDb, getDb);
registerShopCommissionAdminRoutes(app, getOpsDb, getDb);

/** Nhận pub/sub Redis từ app nội bộ (patch giá) → SSE shop realtime. */
void redisReady().then((ok) => {
  if (ok) console.log("[redis] shop sync ready");
});
void redisSubscribeChanges((payload) => {
  syncBus.emit("change", payload);
});

/**
 * Notify nội bộ (localhost) — app ops gọi sau patch-prices khi cùng VPS.
 * Không JWT; chỉ 127.0.0.1 hoặc header secret.
 */
app.post("/api/shop/catalog/notify", (req, res) => {
  const ip = String(req.ip || req.socket.remoteAddress || "");
  const okLocal =
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.endsWith("127.0.0.1");
  const secret = String(process.env.SHOP_INTERNAL_NOTIFY_SECRET || "").trim();
  const hdr = String(req.headers["x-aloha-notify"] || "");
  if (!okLocal && !(secret && hdr === secret)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((x: unknown) => String(x || "").trim()).filter(Boolean).slice(0, 200)
    : [];
  const source = String(req.body?.source || "catalog-notify").slice(0, 80);
  syncBus.publish(["aloha_products"], source, { ids });
  res.json({ ok: true, ids: ids.length });
});

/** Nội bộ: chạy poll tồn KV → shop ngay (full nếu body.full=true). */
app.post("/api/shop/catalog/kv-stock-sync", async (req, res) => {
  const ip = String(req.ip || req.socket.remoteAddress || "");
  const okLocal =
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.endsWith("127.0.0.1");
  const secret = String(process.env.SHOP_INTERNAL_NOTIFY_SECRET || "").trim();
  const hdr = String(req.headers["x-aloha-notify"] || "");
  if (!okLocal && !(secret && hdr === secret)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const forceFull = req.body?.full === true || req.body?.full === "1";
  const result = await runShopKvStockPoll(getDb, {
    forceFull,
    source: "kv-stock-sync-api",
  });
  res.status(result.ok ? 200 : 500).json(result);
});

app.get('/api/health', async (_req, res) => {
  try {
    const db = await getDb();
    const prodCount = await db.collection('aloha_products').countDocuments();
    res.json({
      status: 'ok',
      service: 'aloha-shop-standalone-api',
      db: DB_NAME,
      opsDb: OPS_DB_NAME,
      products: prodCount,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ALOHA Shop Standalone API Server đang chạy!`);
  console.log(`   - Cổng: http://localhost:${PORT}`);
  console.log(`   - Shop DB: ${DB_NAME}`);
  console.log(`   - Ops DB (staff): ${OPS_DB_NAME}`);
  console.log(`   - Health: http://localhost:${PORT}/api/health\n`);
  startShopKvStockPoller(getDb);
});
