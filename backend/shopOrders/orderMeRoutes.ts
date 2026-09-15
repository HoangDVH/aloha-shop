import type { Express } from "express";
import type { Db } from "mongodb";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import { SHOP_ORDERS } from "./models.js";
import { expireUnpaidShopOrders } from "./markPaid.js";
import { shopPaymentQrForOrder, resolveShopPaymentQrForOrder } from "./bankConfig.js";
import { syncBus } from "../syncBus.js";
import {
  type GetMainDb,
  enrichOrderDetailsImages,
  setShopCors,
} from "./orderRouteShared.js";
import { reconcileShopOrderAgainstKv } from "./kvPaymentReconcile.js";

function noStoreOrderJson(
  req: { headers?: Record<string, unknown> | null },
  res: { setHeader: (k: string, v: string) => void }
) {
  // Tránh Express/nginx trả 304 khi poll đơn CK (If-None-Match + ETag)
  const headers = req?.headers;
  if (headers && typeof headers === "object") {
    delete headers["if-none-match"];
    delete headers["if-modified-since"];
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

/** GET /orders/me, /orders/me/:id, /orders/stream — đơn của khách. */
export function registerShopOrderMeRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ensureIdx: (db: Db) => Promise<void>
) {
  app.get(
    "/api/shop/orders/me",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        await ensureIdx(db);
        await expireUnpaidShopOrders(db, await getMainDb());
        const docs = await db
          .collection(SHOP_ORDERS)
          .find({ shopAccountId: req.shopAuth!.userId })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray();
        const mainDb = await getMainDb();
        const data = [];
        for (const d of docs) {
          const { _id, ...rest } = d as any;
          const details = Array.isArray(rest.orderDetails) ? rest.orderDetails : [];
          rest.orderDetails = await enrichOrderDetailsImages(mainDb, details);
          if (rest.paymentStatus === "unpaid" && (rest.paymentCode || rest.kvInvoiceCode)) {
            const qr = await resolveShopPaymentQrForOrder(d as any, db);
            data.push({
              ...rest,
              qrUrl: qr.qrUrl,
              bank: qr.bank,
              qrKind: qr.qrKind,
              transferContent: qr.addInfo,
              kovCode: (qr as any).kovCode,
              qrString: (qr as any).qrString,
            });
          } else {
            data.push(rest);
          }
        }
        noStoreOrderJson(req, res);
        return res.json({ ok: true, data });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );

  app.get(
    "/api/shop/orders/me/:id",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const mainDb = await getMainDb();
        await expireUnpaidShopOrders(db, mainDb);
        const id = String(req.params.id || "").trim();
        let doc = await db.collection(SHOP_ORDERS).findOne({
          shopAccountId: req.shopAuth!.userId,
          $or: [{ id }, { code: id }, { kvOrderCode: id }, { legacyCodes: id }],
        });
        if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });

        // Đơn CK chưa paid: đối soát HĐ KV có điều tiết (throttle) tối đa 20s/lần tránh spam token API
        const ps = String((doc as any).paymentStatus || "");
        const method = String((doc as any).method || "");
        const lastRec = (doc as any).lastKvReconcileAt ? new Date((doc as any).lastKvReconcileAt).getTime() : 0;
        const isReported = Boolean((doc as any).customerReportedPaidAt);
        const shouldReconcile = isReported || Date.now() - lastRec > 20000;

        if (
          shouldReconcile &&
          method === "Transfer" &&
          (ps === "unpaid" || ps === "processing" || ps === "underpaid" || ps === "expired") &&
          (doc as any).kvInvoiceId != null
        ) {
          await db.collection(SHOP_ORDERS).updateOne(
            { _id: (doc as any)._id },
            { $set: { lastKvReconcileAt: new Date().toISOString() } }
          );
          const r = await reconcileShopOrderAgainstKv({
            shopDb: db,
            mainDb,
            order: doc,
          });
          if (r === "paid") {
            doc = await db.collection(SHOP_ORDERS).findOne({ _id: (doc as any)._id });
          }
        }

        const { _id, ...rest } = (doc || {}) as any;
        const details = Array.isArray(rest.orderDetails) ? rest.orderDetails : [];
        rest.orderDetails = await enrichOrderDetailsImages(mainDb, details);
        noStoreOrderJson(req, res);
        if (rest.paymentStatus === "unpaid" && (rest.paymentCode || rest.kvInvoiceCode)) {
          const qr = await resolveShopPaymentQrForOrder(doc as any, db);
          return res.json({
            ok: true,
            data: {
              ...rest,
              qrUrl: qr.qrUrl,
              bank: qr.bank,
              qrKind: qr.qrKind,
              transferContent: qr.addInfo,
              kovCode: (qr as any).kovCode,
              qrString: (qr as any).qrString,
            },
          });
        }
        return res.json({ ok: true, data: rest });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );

  /** SSE khách — khi còn đơn unpaid. */
  app.get(
    "/api/shop/orders/stream",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof (res as any).flushHeaders === "function") {
        (res as any).flushHeaders();
      }

      const userId = req.shopAuth!.userId;
      const writeEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      writeEvent("hello", { at: Date.now() });

      const onChange = async (payload: {
        collections?: string[];
        ids?: string[];
      }) => {
        const cols = payload?.collections || [];
        if (!cols.includes("shop_orders")) return;
        const ids = Array.isArray(payload.ids)
          ? payload.ids.map(String).filter(Boolean)
          : [];
        if (!ids.length) {
          // Không broadcast “mọi đơn” — chỉ ping nhẹ để client refresh /me
          writeEvent("change", {
            collections: cols,
            ids: [],
            at: Date.now(),
            scope: "self",
          });
          return;
        }
        try {
          const db = await getShopDb();
          const mine = await db
            .collection(SHOP_ORDERS)
            .find({
              shopAccountId: userId,
              $or: [{ code: { $in: ids } }, { id: { $in: ids } }],
            })
            .project({ code: 1, id: 1 })
            .limit(50)
            .toArray();
          const myIds = mine
            .map((d) => String((d as any).code || (d as any).id || ""))
            .filter(Boolean);
          if (!myIds.length) return;
          writeEvent("change", {
            collections: cols,
            ids: myIds,
            at: Date.now(),
          });
        } catch {
          /* ignore */
        }
      };
      syncBus.on("change", onChange);

      const ping = setInterval(() => {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* closed */
        }
      }, 25000);

      const cleanup = () => {
        clearInterval(ping);
        syncBus.off("change", onChange);
      };
      req.on("close", cleanup);
      req.on("aborted", cleanup);
    }
  );
}
