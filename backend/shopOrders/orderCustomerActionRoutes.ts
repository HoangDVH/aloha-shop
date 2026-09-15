import type { Express } from "express";
import type { Db } from "mongodb";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import {
  SHOP_ORDERS,
  renewPaymentCode,
  transferTtlMinutes,
} from "./models.js";
import { assertStockAvailable } from "./stockApply.js";
import {
  createShopStockHolds,
  ensureShopStockHoldIndexes,
  extendShopStockHoldExpiry,
  releaseShopStockHolds,
  shopStockHoldEnabled,
} from "./stockHold.js";
import { expireUnpaidShopOrders } from "./markPaid.js";
import {
  cancelInvoiceForOrder,
  ensureAwaitingInvoice,
  shopKiotQrAwaitingEnabled,
} from "../shopInvoices/invoiceService.js";
import { shopPaymentQrForOrder, resolveShopPaymentQrForOrder } from "./bankConfig.js";
import { syncBus } from "../syncBus.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  type GetMainDb,
  fullAddressForKv,
  setShopCors,
} from "./orderRouteShared.js";

/** POST renew-payment / cancel / reported-paid — thao tác đơn của khách. */
export function registerShopOrderCustomerActionRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ensureIdx: (db: Db) => Promise<void>
) {
  app.post(
    "/api/shop/orders/me/:id/renew-payment",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (
          !shopRateLimitOrReject(req, res, "shop_renew_payment", 12, 60_000)
        ) {
          return;
        }
        const shopDb = await getShopDb();
        const mainDb = await getMainDb();
        await ensureIdx(shopDb);
        await expireUnpaidShopOrders(shopDb, mainDb);

        const id = String(req.params.id || "").trim();
        const existing = await shopDb.collection(SHOP_ORDERS).findOne({
          shopAccountId: req.shopAuth!.userId,
          $or: [{ id }, { code: id }],
          method: "Transfer",
          paymentStatus: { $in: ["unpaid", "expired"] },
        });
        if (!existing) {
          return res.status(400).json({
            error: "Không gia hạn được (đơn đã thanh toán / đã hủy hoặc không tồn tại)",
          });
        }

        const renewCount = Number((existing as any).paymentRenewCount || 0);
        if (renewCount >= 8) {
          return res.status(400).json({
            error: "Đã gia hạn quá nhiều lần — liên hệ shop hoặc đặt đơn mới",
          });
        }

        const detailsRaw = Array.isArray((existing as any).orderDetails)
          ? (existing as any).orderDetails
          : [];
        const details = detailsRaw.map((it: any) => ({
          productCode: String(it?.productCode || it?.ma || "")
            .trim()
            .toUpperCase(),
          productName: String(it?.productName || it?.ten || "").trim(),
          quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
          price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
          discount: Number(it?.discount || 0) || 0,
        }));
        const stock = await assertStockAvailable(mainDb, details, shopDb, {
          excludeOrderId: String((existing as any).code || id),
        });
        if (!stock.ok) {
          return res.status(400).json({ error: stock.error });
        }

        const oldCode = String((existing as any).paymentCode || "").trim();
        const paymentCode = renewPaymentCode(String((existing as any).code || id));
        const ttlMin = transferTtlMinutes();
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const expiresAt = new Date(nowDate.getTime() + ttlMin * 60_000);
        const history = Array.isArray((existing as any).paymentCodeHistory)
          ? [...(existing as any).paymentCodeHistory]
          : [];
        if (oldCode && !history.includes(oldCode)) history.push(oldCode);

        const oldInv = (existing as any).kvInvoiceId;
        // Gia hạn: tạo HĐ awaiting mới trước, rồi hủy HĐ cũ (tránh mất HĐ nếu tạo lỗi).
        let nextKvInvoiceId: string | number | null = null;
        let nextKvInvoiceCode: string | null = null;
        let nextKvInvoiceMode: "awaiting" | null = null;
        if (shopKiotQrAwaitingEnabled()) {
          try {
            const inv = await ensureAwaitingInvoice({
              mainDb,
              customerName: String((existing as any).customerName || "Khách web"),
              customerPhone: String((existing as any).customerPhone || ""),
              address: fullAddressForKv(existing as any),
              orderDetails: details,
              description:
                `${paymentCode} | Web ${String((existing as any).code || id)} | gia hạn`.slice(
                  0,
                  500
                ),
              totalPayment: Math.round(
                Number((existing as any).totalPayment ?? (existing as any).total) || 0
              ),
              shippingFee: Math.max(
                0,
                Math.round(Number((existing as any).shippingFee) || 0)
              ),
            });
            nextKvInvoiceId = inv.kvInvoiceId;
            nextKvInvoiceCode = inv.kvInvoiceCode;
            nextKvInvoiceMode = "awaiting";
          } catch (e: any) {
            return res.status(400).json({
              error: String(e?.message || e || "Không tạo được HĐ chờ CK mới"),
              code: "kv_awaiting_failed",
            });
          }
        }

        if (oldInv != null && oldInv !== "" && !(existing as any).kvInvoiceCancelledAt) {
          try {
            await cancelInvoiceForOrder(mainDb, oldInv);
          } catch {
            /* ignore */
          }
        }

        const r = await shopDb.collection(SHOP_ORDERS).findOneAndUpdate(
          {
            _id: (existing as any)._id,
            paymentStatus: { $in: ["unpaid", "expired"] },
          },
          {
            $set: {
              paymentCode,
              paymentCodeHistory: history.slice(-12),
              paymentRenewCount: renewCount + 1,
              expiresAt,
              paymentStatus: "unpaid",
              orderStatus: "cho_thanh_toan",
              status: "cho_thanh_toan",
              statusValue: "Chờ thanh toán",
              customerReportedPaidAt: null,
              kvInvoiceId: nextKvInvoiceId,
              kvInvoiceCode: nextKvInvoiceCode,
              kvInvoiceMode: nextKvInvoiceMode,
              kvInvoiceCancelledAt:
                oldInv != null && oldInv !== ""
                  ? now
                  : ((existing as any).kvInvoiceCancelledAt ?? null),
              kiotvietQr: null,
              updatedAt: now,
            },
          },
          { returnDocument: "after" }
        );
        const doc = (r as any)?.value ?? r;
        if (!doc || !(doc as any)._id) {
          return res.status(409).json({ error: "Đơn vừa thay đổi — tải lại trang" });
        }

        const heldUpdated = await extendShopStockHoldExpiry(
          shopDb,
          String((doc as any).code || id),
          expiresAt
        ).catch(() => 0);
        if (!heldUpdated && shopStockHoldEnabled()) {
          try {
            await ensureShopStockHoldIndexes(shopDb);
            await createShopStockHolds({
              shopDb,
              orderId: String((doc as any).code || id),
              orderCode: String((doc as any).code || id),
              details,
              expiresAt,
            });
            await shopDb.collection(SHOP_ORDERS).updateOne(
              { _id: (doc as any)._id },
              { $set: { stockHeld: true, updatedAt: new Date().toISOString() } }
            );
          } catch (e: any) {
            console.warn(
              "[shop-renew] stock hold recreate failed",
              (doc as any).code,
              e?.message || e
            );
          }
        }

        syncBus.publish(["shop_orders"], "shop-renew-payment", {
          ids: [String((doc as any).code)],
        });
        const { _id, ...rest } = doc as any;
        const qr = await resolveShopPaymentQrForOrder(doc as any, shopDb);
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
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi gia hạn thanh toán" });
      }
    }
  );

  app.post(
    "/api/shop/orders/me/:id/cancel",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const id = String(req.params.id || "").trim();
        const now = new Date().toISOString();
        const r = await db.collection(SHOP_ORDERS).findOneAndUpdate(
          {
            shopAccountId: req.shopAuth!.userId,
            $and: [
              { $or: [{ id }, { code: id }, { kvOrderCode: id }, { legacyCodes: id }] },
              {
                $or: [
                  {
                    method: "Transfer",
                    paymentStatus: { $in: ["unpaid", "expired"] },
                  },
                  {
                    method: "Cash",
                    paymentStatus: "cod",
                    orderStatus: "cho_xu_ly",
                  },
                ],
              },
            ],
          },
          {
            $set: {
              paymentStatus: "cancelled",
              orderStatus: "huy",
              status: "huy",
              statusValue: "Đã hủy",
              updatedAt: now,
            },
          },
          { returnDocument: "after" }
        );
        const doc = (r as any)?.value ?? r;
        if (!doc || !(doc as any)._id) {
          return res.status(400).json({ error: "Không hủy được (đã thanh toán hoặc không tồn tại)" });
        }
        await releaseShopStockHolds(db, String((doc as any).code || id)).catch(() => 0);
        const invId = (doc as any).kvInvoiceId;
        if (invId != null && invId !== "" && !(doc as any).kvInvoiceCancelledAt) {
          try {
            const mainDb = await getMainDb();
            await cancelInvoiceForOrder(mainDb, invId);
            await db.collection(SHOP_ORDERS).updateOne(
              { _id: (doc as any)._id },
              { $set: { kvInvoiceCancelledAt: now, kvInvoiceMode: null } }
            );
          } catch (e: any) {
            console.warn("[shop-cancel] kv invoice", e?.message || e);
          }
        }
        const kvOrderId = (doc as any).kvOrderId;
        if (kvOrderId != null && kvOrderId !== "" && String((doc as any).method) === "Cash") {
          try {
            const mainDb = await getMainDb();
            const { cancelShopOrderOnKiotViet } = await import("./kvOrderCancel.js");
            await cancelShopOrderOnKiotViet(mainDb, kvOrderId);
          } catch (e: any) {
            console.warn("[shop-cancel] kv order", e?.message || e);
          }
        }
        syncBus.publish(["shop_orders"], "shop-cancel", { ids: [String((doc as any).code)] });
        const { _id, ...rest } = doc as any;
        return res.json({ ok: true, data: rest });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi hủy đơn" });
      }
    }
  );

  /** Khách báo đã CK — giữ unpaid (QR/hết hạn vẫn đúng), UI chuyển sang “đang chờ shop xác nhận”. */
  app.post(
    "/api/shop/orders/me/:id/reported-paid",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (
          !shopRateLimitOrReject(req, res, "shop_reported_paid", 10, 60_000)
        ) {
          return;
        }
        const db = await getShopDb();
        const id = String(req.params.id || "").trim();
        const now = new Date().toISOString();
        const r = await db.collection(SHOP_ORDERS).findOneAndUpdate(
          {
            shopAccountId: req.shopAuth!.userId,
            $or: [{ id }, { code: id }],
            paymentStatus: "unpaid",
            method: "Transfer",
          },
          {
            $set: {
              customerReportedPaidAt: now,
              statusValue: "Chờ shop xác nhận CK",
              updatedAt: now,
            },
          },
          { returnDocument: "after" }
        );
        const doc = (r as any)?.value ?? r;
        if (!doc || !(doc as any)._id) {
          return res.status(400).json({
            error: "Không cập nhật được (đơn đã xử lý hoặc không tồn tại)",
          });
        }
        syncBus.publish(["shop_orders"], "shop-reported-paid", {
          ids: [String((doc as any).code)],
        });
        const { _id, ...rest } = doc as any;
        return res.json({
          ok: true,
          data: rest,
          message:
            "Đã ghi nhận — đơn vẫn chờ cửa hàng xác nhận chuyển khoản (chưa thanh toán tự động).",
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );
}
