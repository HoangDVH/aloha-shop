import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { SHOP_ORDERS, ensureShopOrderIndexes } from "../shopOrders/models.js";
import { dispatchShipment } from "../shopShipping/shipmentDispatch.js";
import type { ShippingCarrier } from "../shopShipping/carrierTypes.js";
import type { GetShopDb } from "./routes.js";
import { expireUnpaidShopOrders, markShopOrderPaid } from "./markPaid.js";
import { SHOP_COMMISSIONS } from "./commissionModels.js";
import { syncBus } from "../syncBus.js";
import type { ShopOrderDetail } from "./models.js";
import {
  ensureCodKvOrder,
  shopCodKvEnabled,
} from "../shopInvoices/invoiceService.js";
import { fullAddressForKv } from "./orderRouteShared.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";
import { cancelShopOrderOnKiotViet } from "./kvOrderCancel.js";
import { cancelShopInvoiceOnKiotViet } from "./kvPush.js";
import { completeShopOrderDelivered } from "./completeDelivered.js";
import { completeShopOrderReturned } from "./completeReturned.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { migrateWebOrderCodes } from "./migrateWebCodes.js";
import { syncShopOrderMoneyFromKv } from "./kvOrderMoneySync.js";
import { voidCommissionsForOrder } from "./commission.js";
import { releaseShopStockHolds } from "./stockHold.js";

export function registerShopOrdersAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];
  let indexesReady = false;
  const ensureIdx = async (db: Db) => {
    if (indexesReady) return;
    await ensureShopOrderIndexes(db);
    indexesReady = true;
  };

  app.get("/api/shop/admin/orders", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const shopDb = await getShopDb();
      const mainDb = await getDb();
      await ensureIdx(shopDb);
      await expireUnpaidShopOrders(shopDb, mainDb);
      const status = String(req.query.shipmentStatus || "").trim();
      const paymentStatus = String(req.query.paymentStatus || "").trim();
      const method = String(req.query.method || "").trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const filter: Record<string, unknown> = {};
      if (status === "pending") filter["shipment.status"] = "pending";
      else if (status === "created") filter["shipment.status"] = "created";
      else if (status === "failed") filter["shipment.status"] = "failed";
      if (method) filter.method = method;
      // pending = chờ xử lý: CK chưa trả + COD + cần review
      if (paymentStatus === "pending") {
        filter.$or = [
          { paymentStatus: { $in: ["unpaid", "cod", "processing", "failed", "underpaid"] } },
          { "paymentReview.needed": true },
        ];
      } else if (
        paymentStatus === "review" ||
        paymentStatus === "needs_staff"
      ) {
        // Chỉ đơn cần NV: lệch tiền / review / khách báo đã CK
        filter.$and = [
          { paymentStatus: { $nin: ["paid", "cancelled"] } },
          {
            $or: [
              { paymentStatus: "underpaid" },
              { "paymentReview.needed": true },
              {
                customerReportedPaidAt: {
                  $exists: true,
                  $nin: [null, ""],
                },
              },
            ],
          },
        ];
      } else if (paymentStatus.includes(",")) {
        filter.paymentStatus = {
          $in: paymentStatus
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      } else if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      const col = shopDb.collection(SHOP_ORDERS);
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const needMas = new Set<string>();
      for (const row of rows) {
        const details = Array.isArray((row as any).orderDetails) ? (row as any).orderDetails : [];
        for (const d of details) {
          const ma = String(d?.productCode || d?.ma || "").trim().toUpperCase();
          const img = String(d?.imageUrl || d?.anh || "").trim();
          if (ma && !img) needMas.add(ma);
        }
      }
      const anhByMa = new Map<string, string>();
      if (needMas.size) {
        const docs = await mainDb
          .collection("aloha_products")
          .find({
            deletedAt: null,
            $or: [
              { ma: { $in: [...needMas] } },
              { ma: { $in: [...needMas].map((m) => m.toLowerCase()) } },
            ],
          })
          .project({ ma: 1, anh: 1, images: 1 })
          .toArray();
        for (const d of docs) {
          const ma = String((d as any).ma || "").trim().toUpperCase();
          const anh = String((d as any).anh || "").trim();
          const imgs = Array.isArray((d as any).images) ? (d as any).images : [];
          const firstImg = anh || String(imgs[0] || "").trim();
          if (ma && firstImg) anhByMa.set(ma, firstImg);
        }
      }

      return res.json({
        ok: true,
        total,
        page,
        limit,
        data: rows.map((d) => {
          const { _id, ...rest } = d as Record<string, unknown>;
          const details = Array.isArray(rest.orderDetails)
            ? (rest.orderDetails as any[]).map((it) => {
                const ma = String(it?.productCode || it?.ma || "").trim().toUpperCase();
                const imageUrl =
                  String(it?.imageUrl || it?.anh || "").trim() || anhByMa.get(ma) || "";
                return {
                  ...it,
                  productCode: ma || it?.productCode,
                  imageUrl: imageUrl || undefined,
                };
              })
            : rest.orderDetails;
          return { ...rest, orderDetails: details };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi tải đơn web" });
    }
  });

  app.post(
    "/api/shop/admin/orders/:id/confirm-payment",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const mainDb = await getDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const allowExpired = Boolean(req.body?.allowExpired);
        const result = await markShopOrderPaid({
          shopDb,
          mainDb,
          orderCode: id,
          source: "admin",
          allowExpired,
          confirmedBy: req.auth?.username || "admin",
        });
        if (!result.ok) {
          return res.status(400).json({ ok: false, error: result.error, code: result.code });
        }
        return res.json({
          ok: true,
          alreadyPaid: result.alreadyPaid || false,
          shortfall: result.shortfall,
          data: result.order,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi xác nhận thanh toán" });
      }
    }
  );
  app.get("/api/shop/admin/orders/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const shopDb = await getShopDb();
      await ensureIdx(shopDb);
      const id = String(req.params.id || "").trim();
      const doc = await shopDb.collection(SHOP_ORDERS).findOne({
        $or: [{ id }, { code: id }],
      });
      if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });
      const { _id, ...rest } = doc as Record<string, unknown>;
      return res.json({ ok: true, data: rest });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi" });
    }
  });

  app.post(
    "/api/shop/admin/orders/:id/confirm-shipment",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const doc = await shopDb.collection(SHOP_ORDERS).findOne({
          $or: [{ id }, { code: id }],
        });
        if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });

        if (doc.deliveryMethod !== "giao_tan_noi") {
          return res.status(400).json({ error: "Đơn nhận tại cửa hàng — không tạo vận đơn" });
        }
        if (doc.backorderStatus && doc.backorderStatus !== "ready") {
          return res.status(409).json({ error: "Đơn đặt trước cần hoàn tất xác nhận, thu tiền và chuẩn bị hàng trước khi tạo vận đơn." });
        }
        if (doc.shipment?.status === "created" && doc.shipment?.trackingCode) {
          return res.status(400).json({
            error: "Đơn đã có vận đơn",
            trackingCode: doc.shipment.trackingCode,
          });
        }

        const carrier = String(
          req.body?.carrier || doc.shippingCarrier || ""
        ).trim() as ShippingCarrier;
        if (carrier !== "ghtk" && carrier !== "ghn" && carrier !== "spx") {
          return res.status(400).json({ error: "Hãng vận chuyển không hợp lệ" });
        }

        const weightGram = Math.max(500, Number(doc.totalWeightGram) || 500);
        const result = await dispatchShipment({
          carrier,
          orderCode: String(doc.code || doc.id),
          customerName: String(doc.customerName || ""),
          customerPhone: String(doc.customerPhone || ""),
          province: String(doc.province || ""),
          district: doc.district ? String(doc.district) : undefined,
          ward: String(doc.ward || ""),
          ghnDistrictId: Number(doc.ghnDistrictId) || undefined,
          ghnWardCode: doc.ghnWardCode ? String(doc.ghnWardCode) : undefined,
          shippingAddress: String(doc.shippingAddress || ""),
          weightGram,
          lengthCm: 25,
          widthCm: 25,
          heightCm: 35,
          valueVnd: Number(doc.subtotal) || 0,
          codAmount: doc.usingCod ? Number(doc.total) || 0 : 0,
          note: doc.customerNote ? String(doc.customerNote) : undefined,
        });

        const now = new Date().toISOString();
        const shipment = result.ok
          ? {
              status: "created" as const,
              carrier,
              trackingCode: result.trackingCode || "",
              carrierOrderId: result.carrierOrderId || "",
              labelUrl: result.labelUrl || "",
              createdAt: now,
              confirmedBy: req.auth?.username || "admin",
            }
          : {
              status: "failed" as const,
              carrier,
              error: result.error || "Tạo vận đơn thất bại",
              createdAt: now,
              confirmedBy: req.auth?.username || "admin",
            };

        await shopDb.collection(SHOP_ORDERS).updateOne(
          { _id: doc._id },
          { $set: { shipment, updatedAt: now } }
        );

        if (!result.ok) {
          return res.status(502).json({ ok: false, error: result.error, shipment });
        }

        // Tạo vận đơn thành công → đang giao
        await shopDb.collection(SHOP_ORDERS).updateOne(
          { _id: doc._id },
          { $set: { orderStatus: "dang_giao", updatedAt: now } }
        );

        return res.json({ ok: true, shipment, raw: result.raw, orderStatus: "dang_giao" });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi tạo vận đơn" });
      }
    }
  );

  /** Đánh dấu đang giao (không bắt buộc có vận đơn — nhận tại shop / COD). */
  app.post(
    "/api/shop/admin/orders/:id/mark-shipping",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const now = new Date().toISOString();
        const r = await shopDb.collection(SHOP_ORDERS).findOneAndUpdate(
          {
            $or: [{ id }, { code: id }],
            orderStatus: { $nin: ["hoan_thanh", "huy"] },
            $and: [{ $or: [{ backorderStatus: { $exists: false } }, { backorderStatus: "ready" }] }],
          },
          {
            $set: {
              orderStatus: "dang_giao",
              shippingAt: now,
              updatedAt: now,
              shippingBy: req.auth?.username || "admin",
            },
          },
          { returnDocument: "after" }
        );
        const doc = (r as any)?.value ?? r;
        if (!doc || !(doc as any)._id) {
          return res.status(400).json({ error: "Không cập nhật được (đơn đã xong/hủy?)" });
        }
        syncBus.publish(["shop_orders"], "mark-shipping", {
          ids: [String((doc as any).code || id)],
        });
        void notifyOrderStatus(shopDb, doc as any, "dang_giao").catch((e) =>
          console.warn("[shop-notify] dang_giao", e?.message || e)
        );
        const { _id, ...rest } = doc as Record<string, unknown>;
        return res.json({ ok: true, data: rest });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "mark_shipping_failed" });
      }
    }
  );

  /** Giao thành công → trừ kho COD (nếu chưa) + HĐ KV COD + consume soft-hold + hold hoa hồng CTV. */
  app.post(
    "/api/shop/admin/orders/:id/mark-delivered",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const mainDb = await getDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const result = await completeShopOrderDelivered({
          shopDb,
          mainDb,
          orderRef: id,
          confirmedBy: req.auth?.username || "admin",
        });
        if (!result.ok) {
          const status =
            result.error === "not_found"
              ? 404
              : result.error === "already_cancelled"
                ? 400
                : 400;
          return res.status(status).json({
            error:
              result.error === "not_found"
                ? "Không tìm thấy đơn"
                : result.error || "mark_delivered_failed",
            code:
              result.error?.includes("kv") || result.error?.includes("Kiot")
                ? "kv_cod_invoice_failed"
                : undefined,
            hint:
              result.error && !["not_found", "already_cancelled"].includes(result.error)
                ? "Kiểm tra Đặt hàng KV / tồn chi nhánh, hoặc tạm tắt SHOP_COD_KV=0."
                : undefined,
          });
        }
        return res.json({
          ok: true,
          skipped: result.skipped || false,
          data: result.data,
          commission: result.commission,
          shortfall: result.shortfall,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "mark_delivered_failed" });
      }
    }
  );

  /** Hoàn / hủy đơn → nhả soft-hold còn lại + hủy HH chưa chi + clawback paid_out. */
  app.post(
    "/api/shop/admin/orders/:id/mark-returned",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const ma = req.body?.ma
          ? String(req.body.ma).trim().toUpperCase()
          : undefined;
        const result = await completeShopOrderReturned({
          shopDb,
          orderRef: id,
          confirmedBy: req.auth?.username || "admin",
          reason: String(req.body?.reason || "hoan_hang").slice(0, 200),
          ma,
          source: "admin",
        });
        if (!result.ok) {
          return res
            .status(result.error === "not_found" ? 404 : 400)
            .json({
              error:
                result.error === "not_found"
                  ? "Không tìm thấy đơn"
                  : result.error || "mark_returned_failed",
            });
        }
        return res.json({
          ok: true,
          skipped: result.skipped || false,
          voided: result.voided,
          clawback: result.clawback,
          data: result.data,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "mark_returned_failed" });
      }
    }
  );

  /** Dry-run / chạy đổi mã WEB-… → DH (kvOrderCode). Body: { dryRun?: boolean, limit?, codes? } */
  app.post(
    "/api/shop/admin/orders/migrate-web-codes",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        await ensureIdx(shopDb);
        const dryRun = req.body?.dryRun !== false;
        const result = await migrateWebOrderCodes(shopDb, {
          dryRun,
          limit: Number(req.body?.limit) || 50,
          codes: Array.isArray(req.body?.codes) ? req.body.codes : undefined,
        });
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "migrate_failed" });
      }
    }
  );

  /** Đồng bộ tiền/SP từ Đặt hàng KV → shop (trước khi hoàn thành). */
  app.post(
    "/api/shop/admin/orders/:id/sync-kv-money",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const mainDb = await getDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const result = await syncShopOrderMoneyFromKv({
          shopDb,
          mainDb,
          orderRef: id,
        });
        if (!result.ok) {
          return res
            .status(result.error === "not_found" ? 404 : 400)
            .json(result);
        }
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "sync_money_failed" });
      }
    }
  );

  /** Retry đẩy Đặt hàng KV cho đơn COD chưa có kvOrderId. */
  app.post(
    "/api/shop/admin/orders/:id/retry-kv-push",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const mainDb = await getDb();
        await ensureIdx(shopDb);
        const id = String(req.params.id || "").trim();
        const doc = await shopDb.collection(SHOP_ORDERS).findOne(
          shopOrderLookupFilter(id)
        );
        if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });
        if ((doc as any).kvOrderId) {
          return res.json({
            ok: true,
            already: true,
            kvOrderId: (doc as any).kvOrderId,
            kvOrderCode: (doc as any).kvOrderCode,
          });
        }
        if (!shopCodKvEnabled()) {
          return res.status(400).json({ error: "SHOP_COD_KV đang tắt" });
        }
        const details: ShopOrderDetail[] = (
          Array.isArray((doc as any).orderDetails) ? (doc as any).orderDetails : []
        ).map((it: any) => ({
          productCode: String(it?.productCode || it?.ma || "")
            .trim()
            .toUpperCase(),
          productName: String(it?.productName || it?.ten || "").trim(),
          quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
          price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
          discount: Number(it?.discount || 0) || 0,
          ctvCode: it?.ctvCode ? String(it.ctvCode) : undefined,
        }));
        const code = String((doc as any).code || id);
        const ctvCodes = Array.isArray((doc as any).ctvCodes)
          ? (doc as any).ctvCodes
          : [];
        const ctvNote = ctvCodes.length ? `CTV:${ctvCodes.join(",")}` : "";
        try {
          const ord = await ensureCodKvOrder({
            mainDb,
            customerId: doc.kvCustomerId ? Number(doc.kvCustomerId) : undefined,
            customerName: String((doc as any).customerName || ""),
            customerPhone: String((doc as any).customerPhone || ""),
            address: fullAddressForKv(doc as any),
            orderDetails: details,
            description:
              `Web ${code} | COD | ${ctvNote} | retry`.slice(0, 500),
            totalPayment: Number((doc as any).total || 0),
            shippingFee: Number((doc as any).shippingFee || 0),
          });
          await shopDb.collection(SHOP_ORDERS).updateOne(
            { _id: doc._id },
            {
              $set: {
                kvOrderId: ord.kvOrderId,
                kvOrderCode: ord.kvOrderCode,
                kvPushError: null,
                updatedAt: new Date().toISOString(),
              },
            }
          );
          syncBus.publish(["shop_orders"], "retry-kv-push", { ids: [code] });
          return res.json({
            ok: true,
            kvOrderId: ord.kvOrderId,
            kvOrderCode: ord.kvOrderCode,
          });
        } catch (e: any) {
          const msg = String(e?.message || e || "retry_failed");
          await shopDb.collection(SHOP_ORDERS).updateOne(
            { _id: doc._id },
            {
              $set: {
                kvPushError: msg.slice(0, 500),
                updatedAt: new Date().toISOString(),
              },
            }
          );
          return res.status(400).json({ error: msg, code: "kv_retry_failed" });
        }
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "retry_kv_failed" });
      }
    }
  );

  /**
   * Purge đơn TEST — chỉ theo danh sách mã WEB- tường minh + isTest/[TEST-WEB].
   * KV: chỉ hủy (không xóa cứng). Không đụng đơn quầy / đơn không-test.
   */
  app.post(
    "/api/shop/admin/orders/purge-test",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const mainDb = await getDb();
        await ensureIdx(shopDb);
        const rawCodes: unknown[] = Array.isArray(req.body?.codes) ? req.body.codes : [];
        const codes = [
          ...new Set(
            rawCodes
              .map((c: unknown) => String(c || "").trim().toUpperCase())
              .filter((c: string) => /^WEB-/.test(c))
          ),
        ].slice(0, 20);
        if (!codes.length) {
          return res.status(400).json({
            error: "Cần danh sách codes dạng WEB-… (tối đa 20)",
          });
        }

        const cancelledKv: string[] = [];
        const deletedMongo: string[] = [];
        const skipped: Array<{ code: string; reason: string }> = [];
        const kvManualCancel: Array<{
          web: string;
          kvCode: string;
          reason: string;
        }> = [];

        for (const code of codes) {
          const doc = await shopDb.collection(SHOP_ORDERS).findOne({
            $or: [{ code }, { id: code }],
          });
          if (!doc) {
            skipped.push({ code, reason: "not_found" });
            continue;
          }
          if (doc.priceMode === "si" && doc.kvPushStatus) {
            skipped.push({ code, reason: "wholesale_sync_requires_audited_cancellation" });
            continue;
          }
          const isTest =
            Boolean((doc as any).isTest) ||
            String((doc as any).customerNote || "")
              .toUpperCase()
              .includes("[TEST-WEB]");
          if (!isTest) {
            skipped.push({ code, reason: "not_test_order" });
            continue;
          }

          const kvOrderId = (doc as any).kvOrderId;
          const kvOrderCode = String((doc as any).kvOrderCode || kvOrderId || "");
          if (kvOrderId != null && kvOrderId !== "") {
            const r = await cancelShopOrderOnKiotViet(mainDb, kvOrderId);
            if (r.ok) cancelledKv.push(code);
            else {
              kvManualCancel.push({
                web: code,
                kvCode: kvOrderCode || String(kvOrderId),
                reason: r.error || "kv_cancel_failed",
              });
            }
          }
          const kvInv = (doc as any).kvInvoiceId;
          if (kvInv != null && kvInv !== "") {
            await cancelShopInvoiceOnKiotViet(mainDb, kvInv).catch(() => false);
          }

          await voidCommissionsForOrder(shopDb, code, { reason: "purge_test" }).catch(
            () => ({ voided: 0 })
          );
          await shopDb.collection(SHOP_COMMISSIONS).deleteMany({ orderCode: code });
          await releaseShopStockHolds(shopDb, code).catch(() => 0);
          await shopDb.collection(SHOP_ORDERS).deleteOne({ _id: doc._id });
          deletedMongo.push(code);
        }

        syncBus.publish(["shop_orders"], "purge-test", { ids: deletedMongo });
        return res.json({
          ok: true,
          cancelledKv,
          deletedMongo,
          skipped,
          kvManualCancel,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "purge_test_failed" });
      }
    }
  );
}
