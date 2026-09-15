import type { Express } from "express";
import type { Db } from "mongodb";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import {
  SHOP_ORDERS,
  ensureOneDefault,
  newAddressId,
  newPaymentCode,
  newShopOrderCode,
  normalizeAddresses,
  transferTtlMinutes,
} from "./models.js";
import { assertStockAvailable } from "./stockApply.js";
import {
  createShopStockHolds,
  ensureShopStockHoldIndexes,
  shopStockHoldEnabled,
} from "./stockHold.js";
import { shopPaymentQrForOrder, resolveShopPaymentQrForOrder } from "./bankConfig.js";
import { syncBus } from "../syncBus.js";
import { hashQuoteItems, verifyQuoteToken } from "../shopShipping/quoteToken.js";
import { qualifiesFreeShip } from "../shopShipping/freeShip.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  cancelInvoiceForOrder,
  ensureAwaitingInvoice,
  ensureCodKvOrder,
  shopCodKvEnabled,
  shopKiotQrAwaitingEnabled,
} from "../shopInvoices/invoiceService.js";
import {
  type GetMainDb,
  applyCatalogPrices,
  fullAddressForKv,
  parseOrderDetails,
  setShopCors,
} from "./orderRouteShared.js";
import {
  shopAllowTransferPayment,
  shopRequireShippingQuote,
} from "./checkoutFlags.js";
import { normalizeCtvCode } from "../shopAuth/models.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";

async function filterActiveCtvCodes(
  shopDb: Db,
  codes: string[]
): Promise<Set<string>> {
  const uniq = [
    ...new Set(codes.map((c) => normalizeCtvCode(c)).filter((c) => c.length >= 3)),
  ];
  if (!uniq.length) return new Set();
  const rows = await shopDb
    .collection(SHOP_ACCOUNTS)
    .find({
      ctvCode: { $in: uniq },
      roles: "ctv",
      ctvStatus: "active",
      active: { $ne: false },
    })
    .project({ ctvCode: 1 })
    .toArray();
  return new Set(rows.map((r) => normalizeCtvCode(String((r as any).ctvCode || ""))));
}
/** POST /api/shop/orders — tạo đơn (COD / chuyển khoản). */
export function registerShopOrderCreateRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ensureIdx: (db: Db) => Promise<void>
) {
  app.post(
    "/api/shop/orders",
    (req, res, next) => {
      setShopCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (
          !shopRateLimitOrReject(req, res, "shop_order_create", 20, 60_000)
        ) {
          return;
        }
        const shopDb = await getShopDb();
        await ensureIdx(shopDb);

        const body = req.body || {};
        const deliveryMethod =
          body.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi";
        let method = body.method === "Transfer" ? "Transfer" : "Cash";
        if (method === "Transfer" && !shopAllowTransferPayment()) {
          return res.status(400).json({
            error: "Shop hiện chỉ nhận thanh toán khi nhận hàng (COD)",
            code: "transfer_disabled",
          });
        }
        const usingCod = method === "Cash" || Boolean(body.usingCod);
        const customerNote = String(body.customerNote || "").trim().slice(0, 255);
        const customerName = String(body.customerName || "").trim();
        const customerPhone = String(body.customerPhone || "").trim();
        const province = String(body.province || "").trim();
        const district = String(body.district || "").trim();
        const ward = String(body.ward || "").trim();
        const ghnDistrictId = Number(body.ghnDistrictId || 0) || undefined;
        const ghnWardCode = String(body.ghnWardCode || "").trim() || undefined;
        const shippingAddress = String(body.shippingAddress || body.detail || "").trim();
        const addressId = body.addressId ? String(body.addressId).trim() : "";

        let orderDetails = parseOrderDetails(body.orderDetails || body.items);
        if (!orderDetails.length) {
          return res.status(400).json({ error: "Giỏ hàng trống hoặc thiếu sản phẩm" });
        }
        if (!customerName || !customerPhone) {
          return res.status(400).json({ error: "Nhập tên và số điện thoại" });
        }
        if (deliveryMethod === "giao_tan_noi") {
          if (!province || !ward || !shippingAddress) {
            return res.status(400).json({ error: "Nhập đủ tỉnh, phường và địa chỉ nhận hàng" });
          }
        }

        const mainDbEarly = await getMainDb();
        const priced = await applyCatalogPrices(mainDbEarly, orderDetails);
        if (!priced.ok) {
          return res.status(400).json({ error: priced.error });
        }
        orderDetails = priced.details;

        // Chỉ giữ ctvCode của CTV đang active (mã giả / khóa → bỏ)
        {
          const rawCodes = orderDetails
            .map((d) => d.ctvCode)
            .filter(Boolean) as string[];
          const active = await filterActiveCtvCodes(shopDb, rawCodes);
          orderDetails = orderDetails.map((d) => {
            const c = normalizeCtvCode(String(d.ctvCode || ""));
            if (!c || !active.has(c)) {
              const { ctvCode: _drop, ...rest } = d;
              return rest;
            }
            return { ...d, ctvCode: c };
          });
        }

        const subtotal = orderDetails.reduce((n, d) => n + d.price * d.quantity, 0);
        let shippingFee = 0;
        let shippingCarrier: string | undefined;
        let totalWeightGram = 0;
        let freeShipApplied = false;
        const quoteToken = String(body.quoteToken || "").trim();

        if (deliveryMethod === "giao_tan_noi" && shopRequireShippingQuote()) {
          if (!quoteToken) {
            return res.status(400).json({ error: "Thiếu báo giá phí ship — tải lại trang checkout" });
          }
          try {
            const quote = verifyQuoteToken(quoteToken);
            const itemsKey = hashQuoteItems(
              orderDetails.map((d) => ({
                productCode: d.productCode,
                quantity: d.quantity,
                price: d.price,
              }))
            );
            if (quote.itemsKey !== itemsKey) {
              return res.status(400).json({ error: "Giỏ hàng đã đổi — báo giá ship lại" });
            }
            // Subtotal đổi mạnh so với lúc quote → đòi báo giá lại (tránh phí/freeship lệch).
            const quoteSub = Math.max(0, Number(quote.subtotal) || 0);
            if (quoteSub > 0) {
              const delta = Math.abs(subtotal - quoteSub) / quoteSub;
              if (delta > 0.01) {
                return res.status(409).json({
                  error: "Giá hàng đã đổi — báo giá ship lại",
                  code: "quote_stale",
                });
              }
            }
            if (quote.province !== province || quote.ward !== ward) {
              return res.status(400).json({ error: "Địa chỉ lệch báo giá ship" });
            }
            if (quote.district && district && quote.district !== district) {
              return res.status(400).json({ error: "Quận/huyện lệch báo giá ship" });
            }
            if (quote.ghnWardCode && ghnWardCode && quote.ghnWardCode !== ghnWardCode) {
              return res.status(400).json({ error: "Phường/xã lệch báo giá ship" });
            }
            const clientFee = Math.max(0, Number(body.shippingFee) || 0);
            if (clientFee !== quote.fee) {
              return res.status(400).json({ error: "Phí ship đã thay đổi — báo giá lại" });
            }
            // Free ship theo tổng hiện tại: nếu token miễn ship nhưng tổng mới không đủ điều kiện → báo giá lại
            const stillFree = qualifiesFreeShip(
              subtotal,
              orderDetails.map((d) => ({
                productCode: d.productCode,
                quantity: d.quantity,
                price: d.price,
              }))
            );
            if (quote.freeShipApplied && !stillFree) {
              return res.status(400).json({
                error: "Đơn không còn đủ điều kiện freeship — báo giá ship lại",
              });
            }
            shippingFee = quote.fee;
            shippingCarrier = quote.carrier;
            totalWeightGram = quote.totalWeightGram;
            freeShipApplied = Boolean(quote.freeShipApplied);
          } catch (e: any) {
            return res.status(400).json({
              error: e?.message || "Mã phí ship hết hạn — báo giá lại",
            });
          }
        } else {
          // Phase COD: không bắt quote — phí ship = 0 (code quote vẫn giữ để bật lại)
          shippingFee = 0;
          shippingCarrier = undefined;
          freeShipApplied = false;
        }

        const total = subtotal + shippingFee;
        const ctvCodes = [
          ...new Set(orderDetails.map((d) => d.ctvCode).filter(Boolean) as string[]),
        ];

        const isTransfer = method === "Transfer";
        const mainDb = mainDbEarly;

        // COD + Transfer: assert tồn (displayTon − hold). Soft-hold sau insert.
        const stock = await assertStockAvailable(mainDb, orderDetails, shopDb);
        if (!stock.ok) {
          return res.status(400).json({ error: stock.error });
        }

        const user = await shopDb
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));

        const isTest =
          Boolean(body.isTest) ||
          String(customerNote || "").toUpperCase().includes("[TEST-WEB]");
        const ctvNote =
          ctvCodes.length > 0 ? `CTV:${ctvCodes.join(",")}` : "";

        const idempotencyKey = String(
          body.idempotencyKey || req.headers["idempotency-key"] || ""
        )
          .trim()
          .slice(0, 80);
        if (idempotencyKey) {
          const existing = await shopDb.collection(SHOP_ORDERS).findOne({
            shopAccountId: req.shopAuth!.userId,
            idempotencyKey,
          });
          if (existing) {
            const { _id, ...rest } = existing as any;
            const qr = rest.method === "Transfer" ? await resolveShopPaymentQrForOrder(existing as any, shopDb) : null;
            return res.status(200).json({
              ok: true,
              reused: true,
              data: {
                id: rest.id,
                code: rest.code,
                kvOrderId: rest.kvOrderId ?? null,
                kvOrderCode: rest.kvOrderCode ?? null,
                total: rest.total,
                status: rest.status,
                statusValue: rest.statusValue,
                paymentStatus: rest.paymentStatus,
                orderStatus: rest.orderStatus,
                paymentCode: rest.paymentCode,
                expiresAt: rest.expiresAt,
                method: rest.method,
                kvInvoiceId: rest.kvInvoiceId,
                kvInvoiceCode: rest.kvInvoiceCode,
                kvInvoiceMode: rest.kvInvoiceMode,
                qrUrl: qr?.qrUrl || null,
                bank: qr?.bank || null,
                qrKind: qr?.qrKind || null,
                transferContent: qr?.addInfo || null,
                kovCode: (qr as any)?.kovCode || null,
                qrString: (qr as any)?.qrString || null,
              },
            });
          }
        }

        // Mongo trước — tránh orphan KV nếu insert lỗi
        let code = newShopOrderCode();
        let kvOrderId: string | number | null = null;
        let kvOrderCode: string | null = null;

        const paymentCode = isTransfer ? newPaymentCode(code) : undefined;
        const ttlMin = transferTtlMinutes();
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const expiresAt = isTransfer
          ? new Date(nowDate.getTime() + ttlMin * 60_000)
          : undefined;

        const doc: Record<string, unknown> = {
          id: code,
          code,
          kvOrderId: null,
          kvOrderCode: null,
          kvInvoiceId: null,
          kvInvoiceCode: null,
          kvPushError: null,
          isTest,
          shopAccountId: req.shopAuth!.userId,
          addressId: addressId || null,
          customerName,
          customerPhone,
          customerEmail: user?.email ? String(user.email) : null,
          deliveryMethod,
          province: deliveryMethod === "giao_tan_noi" ? province : "",
          district: deliveryMethod === "giao_tan_noi" ? district : "",
          ward: deliveryMethod === "giao_tan_noi" ? ward : "",
          ghnDistrictId: deliveryMethod === "giao_tan_noi" ? ghnDistrictId || null : null,
          ghnWardCode: deliveryMethod === "giao_tan_noi" ? ghnWardCode || null : null,
          shippingAddress: deliveryMethod === "giao_tan_noi" ? shippingAddress : "",
          orderDetails,
          ctvCodes,
          subtotal,
          shippingFee,
          shippingCarrier: shippingCarrier || null,
          freeShipApplied,
          totalWeightGram: deliveryMethod === "giao_tan_noi" ? totalWeightGram : 0,
          quoteToken: deliveryMethod === "giao_tan_noi" ? quoteToken : null,
          shipment:
            deliveryMethod === "giao_tan_noi"
              ? { status: "pending", carrier: shippingCarrier || null }
              : null,
          total,
          totalPayment: total,
          discount: 0,
          method,
          usingCod: isTransfer ? false : usingCod,
          customerNote: isTest && !String(customerNote).includes("[TEST-WEB]")
            ? `[TEST-WEB] ${customerNote}`.trim().slice(0, 255)
            : customerNote,
          paymentStatus: isTransfer ? "unpaid" : "cod",
          orderStatus: isTransfer ? "cho_thanh_toan" : "cho_xu_ly",
          ...(paymentCode ? { paymentCode } : {}),
          ...(idempotencyKey ? { idempotencyKey } : {}),
          expiresAt: expiresAt || null,
          stockApplied: false,
          stockHeld: false,
          status: isTransfer ? "cho_thanh_toan" : "cho",
          statusValue: isTransfer ? "Chờ thanh toán" : "Đặt hàng",
          done: false,
          purchaseDate: now,
          source: "shop_web",
          createdAt: now,
          updatedAt: now,
        };

        const insertRes = await shopDb.collection(SHOP_ORDERS).insertOne(doc);
        const mongoId = insertRes.insertedId;

        // COD → Đặt hàng KV; mã shop đổi theo mã DH khi có
        if (!isTransfer && shopCodKvEnabled()) {
          try {
            const ord = await ensureCodKvOrder({
              mainDb: mainDbEarly,
              customerName,
              customerPhone,
              address: fullAddressForKv({
                deliveryMethod,
                shippingAddress,
                ward,
                district,
                province,
              }),
              orderDetails,
              description:
                `Shop COD | ${ctvNote} | ${isTest ? "[TEST-WEB] " : ""}${customerNote || "Shop COD"}`.slice(
                  0,
                  500
                ),
              totalPayment: total,
              shippingFee,
            });
            kvOrderId = ord.kvOrderId;
            kvOrderCode = String(ord.kvOrderCode || "").trim() || null;
            const patch: Record<string, unknown> = {
              kvOrderId,
              kvOrderCode,
              updatedAt: new Date().toISOString(),
            };
            if (kvOrderCode && kvOrderCode !== code) {
              patch.legacyCodes = [code];
              patch.code = kvOrderCode;
              patch.id = kvOrderCode;
              code = kvOrderCode;
            }
            await shopDb.collection(SHOP_ORDERS).updateOne({ _id: mongoId }, { $set: patch });
            Object.assign(doc, patch);
          } catch (e: any) {
            await shopDb.collection(SHOP_ORDERS).deleteOne({ _id: mongoId }).catch(() => {});
            const msg = String(
              e?.message || e || "Không tạo được đặt hàng COD trên KiotViet"
            );
            return res.status(400).json({
              error: msg,
              code: "kv_cod_order_failed",
              hint: "Kiểm tra kết nối KiotViet / tồn chi nhánh, rồi đặt lại. Đơn chưa được tạo trên shop.",
            });
          }
        }

        // Transfer + KiotQR: HĐ chờ CK sau khi đã có đơn Mongo
        if (isTransfer) {
          doc.kvInvoiceId = null;
          doc.kvInvoiceCode = null;
          doc.kvInvoiceMode = null;
          if (shopKiotQrAwaitingEnabled()) {
            try {
              const inv = await ensureAwaitingInvoice({
                mainDb: mainDbEarly,
                customerName,
                customerPhone,
                address: fullAddressForKv({
                  deliveryMethod,
                  shippingAddress,
                  ward,
                  district,
                  province,
                }),
                orderDetails,
                description:
                  `${paymentCode} | Web ${code} | ${ctvNote} | ${customerNote || "Shop CK"}`.slice(
                    0,
                    500
                  ),
                totalPayment: total,
                shippingFee,
              });
              const patch = {
                kvInvoiceId: inv.kvInvoiceId,
                kvInvoiceCode: inv.kvInvoiceCode,
                kvInvoiceMode: "awaiting",
                updatedAt: new Date().toISOString(),
              };
              await shopDb.collection(SHOP_ORDERS).updateOne({ _id: mongoId }, { $set: patch });
              Object.assign(doc, patch);
            } catch (e: any) {
              await shopDb.collection(SHOP_ORDERS).deleteOne({ _id: mongoId }).catch(() => {});
              const msg = String(e?.message || e || "Không tạo được hóa đơn chờ CK");
              return res.status(400).json({
                error: msg,
                code: "kv_awaiting_failed",
                hint: "Kiểm tra tồn đúng chi nhánh bán trên KiotViet, hoặc tạm tắt SHOP_KIOTQR_AWAITING=0.",
              });
            }
          }
        }

        if (shopStockHoldEnabled()) {
          try {
            await ensureShopStockHoldIndexes(shopDb);
            await createShopStockHolds({
              shopDb,
              orderId: code,
              orderCode: code,
              details: orderDetails,
              expiresAt: expiresAt || null,
            });
            await shopDb.collection(SHOP_ORDERS).updateOne(
              { _id: mongoId },
              { $set: { stockHeld: true, updatedAt: new Date().toISOString() } }
            );
            doc.stockHeld = true;
          } catch (e: any) {
            console.warn("[shop-order] stock hold failed", code, e?.message || e);
          }
        }

        syncBus.publish(["shop_orders"], "shop-order-create", { ids: [code] });

        void notifyOrderStatus(shopDb, doc, "dat_hang").catch((e) =>
          console.warn("[shop-notify] dat_hang", code, e?.message || e)
        );
        if (deliveryMethod === "giao_tan_noi" && !addressId && user) {
          let addresses = normalizeAddresses(user.addresses);
          const dup = addresses.find(
            (a) =>
              a.fullName === customerName &&
              a.phone === customerPhone &&
              a.province === province &&
              a.ward === ward &&
              a.detail === shippingAddress
          );
          if (!dup) {
            addresses = ensureOneDefault([
              ...addresses.map((a) => ({ ...a, isDefault: false })),
              {
                id: newAddressId(),
                fullName: customerName,
                phone: customerPhone,
                province,
                ward,
                detail: shippingAddress,
                isDefault: addresses.length === 0,
              },
            ]);
            await shopDb.collection(SHOP_ACCOUNTS).updateOne(
              { _id: user._id },
              { $set: { addresses, updatedAt: new Date() } }
            );
          }
        }

        const qr = isTransfer ? await resolveShopPaymentQrForOrder(doc as any, shopDb) : null;

        return res.status(201).json({
          ok: true,
          data: {
            id: doc.id,
            code: doc.code,
            kvOrderId: doc.kvOrderId,
            kvOrderCode: doc.kvOrderCode,
            total: doc.total,
            status: doc.status,
            statusValue: doc.statusValue,
            paymentStatus: doc.paymentStatus,
            orderStatus: doc.orderStatus,
            paymentCode: doc.paymentCode,
            expiresAt: doc.expiresAt,
            method: doc.method,
            kvInvoiceId: doc.kvInvoiceId,
            kvInvoiceCode: doc.kvInvoiceCode,
            kvInvoiceMode: doc.kvInvoiceMode,
            qrUrl: qr?.qrUrl || null,
            bank: qr?.bank || null,
            qrKind: qr?.qrKind || null,
            transferContent: qr?.addInfo || null,
            kovCode: (qr as any)?.kovCode || null,
            qrString: (qr as any)?.qrString || null,
          },
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi tạo đơn" });
      }
    }
  );
}
