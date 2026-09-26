import { createBackorderRequest, serializeShopCheckout } from "./backorder.js";
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
import { annotatePreOrderDetails, assertStockAvailable } from "./stockApply.js";
import {
  createShopStockHolds,
  releaseShopStockHolds,
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
  ensureReviewKvOrder,
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
  shopAllowPreOrderCod,
  shopPreOrderCodMaxVnd,
  shopRequireShippingQuote,
  isShopTestBuyerEmail,
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
function reviewOrderKvDescription(
  details: Array<{
    productCode: string;
    quantity: number;
    availableQty?: number;
    preOrder?: boolean;
  }>,
  extra: string
): string {
  const over = details.filter(
    (d) =>
      d.preOrder ||
      (d.availableQty != null && d.quantity > Math.max(0, Number(d.availableQty) || 0))
  );
  const overText = over.length
    ? "Vượt tồn: " +
      over
        .map(
          (d) =>
            `${d.productCode} đặt ${d.quantity}/có ${Math.max(0, Number(d.availableQty) || 0)}`
        )
        .join("; ")
    : "";
  const policy =
    "Khách đã đồng ý kiểm hàng và xác nhận ảnh trước khi đóng gói. Sau khi khách xác nhận ảnh: thanh toán trước toàn bộ đơn hoặc đặt cọc tối thiểu bằng phí ship.";
  return [policy, overText, extra].filter(Boolean).join(" | ").slice(0, 500);
}

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
    serializeShopCheckout(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (
          !(await shopRateLimitOrReject(req, res, "shop_order_create", 20, 60_000))
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

        const rawDetails = body.orderDetails || body.items;
        if (!Array.isArray(rawDetails) || rawDetails.length > 100 || rawDetails.some((d: any) => !Number.isSafeInteger(Number(d.quantity ?? d.qty)) || Number(d.quantity ?? d.qty) < 1 || Number(d.quantity ?? d.qty) > 10000)) {
          return res.status(400).json({ error: "Số lượng không hợp lệ (1–10.000), tối đa 100 dòng" });
        }
        let orderDetails = parseOrderDetails(rawDetails);
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

        const userEarly = await shopDb
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));
        const buyerEmail = userEarly?.email ? String(userEarly.email) : "";

        const mainDbEarly = await getMainDb();
        const priced = await applyCatalogPrices(shopDb, orderDetails, {
          buyerEmail, account: userEarly,
        });
        if (!priced.ok) {
          return res.status(400).json({ error: priced.error });
        }
        if (orderDetails.some((d, i) => d.price !== priced.details[i].price)) {
          return res.status(409).json({ code: "price_changed", error: "Giá đã cập nhật. Vui lòng kiểm tra và xác nhận giá mới.", details: priced.details });
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

        // Đánh dấu đặt trước theo tồn lúc submit (displayTon − hold)
        {
          const annotated = await annotatePreOrderDetails(
            mainDbEarly,
            orderDetails,
            shopDb
          );
          if (!annotated.ok) {
            return res.status(400).json({ error: annotated.error });
          }
          orderDetails = annotated.details;
        }
        const hasPreOrder = orderDetails.some((d) => Boolean(d.preOrder));
        const policyAccepted = body.policyAccepted === true;

        const needsCustomerLink = userEarly?.siStatus === "active" && userEarly?.roles?.includes("si") && !userEarly.kvCustomerId;
        // Sỉ chưa gắn khách KV vẫn lưu yêu cầu trên web. Đơn còn lại, sau khi đồng ý chính sách, đi tạo đơn đặt hàng KV.
        if (needsCustomerLink || (hasPreOrder && !policyAccepted)) {
          const result = await createBackorderRequest(shopDb, { userId: req.shopAuth!.userId, account: userEarly, body, details: orderDetails });
          try { (res as any).releaseCheckoutLock?.(); } catch {}
          return res.status(result.status).json(result.body);
        }
        if (!policyAccepted) {
          return res.status(409).json({
            code: "policy_confirmation_required",
            error: "Vui lòng đồng ý chính sách kiểm hàng và xác nhận ảnh trước khi đặt hàng",
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

        // Đơn đã đồng ý chính sách: chưa thu tiền, chưa lập hóa đơn.
        const reviewFirst = policyAccepted;
        // Pre-order COD: cho phép dưới ngưỡng; vượt ngưỡng → bắt CK (kiểu sàn)
        if (!reviewFirst && hasPreOrder && method !== "Transfer") {
          if (!shopAllowPreOrderCod(total)) {
            const max = shopPreOrderCodMaxVnd();
            return res.status(400).json({
              error: `Đơn đặt trước trên ${max.toLocaleString("vi-VN")}đ — vui lòng thanh toán chuyển khoản`,
              code: "preorder_cod_over_limit",
              maxVnd: max,
            });
          }
        }

        const isTransfer = !reviewFirst && method === "Transfer";
        const mainDb = mainDbEarly;

        // Chỉ assert dòng không preOrder. Soft-hold sau insert cũng skip preOrder.
        const stock = await assertStockAvailable(mainDb, orderDetails, shopDb);
        if (!stock.ok) {
          return res.status(400).json({ error: stock.error });
        }

        const user = userEarly;

        const hasZeroPriceTestItem = orderDetails.some((d) => !(Number(d.price) > 0));
        const isTest =
          Boolean(body.isTest) ||
          String(customerNote || "").toUpperCase().includes("[TEST-WEB]") ||
          (hasZeroPriceTestItem && isShopTestBuyerEmail(buyerEmail));
        const ctvNote =
          ctvCodes.length > 0 ? `CTV:${ctvCodes.join(",")}` : "";
        const preOrderNoteTag = hasPreOrder ? "[DAT-TRUOC] " : "";
        const customerNoteStored = (() => {
          let n = customerNote;
          if (hasPreOrder && !n.toUpperCase().includes("[DAT-TRUOC]")) {
            n = `${preOrderNoteTag}${n}`.trim();
          }
          if (isTest && !String(n).includes("[TEST-WEB]")) {
            n = `[TEST-WEB] ${n}`.trim();
          }
          return n.slice(0, 255);
        })();
        const kvPreOrderHint = hasPreOrder
          ? "ĐẶT TRƯỚC — SP hết hàng, cần nhập hàng ngay"
          : "";
        const reviewKvDescription = reviewOrderKvDescription(orderDetails, [
          ctvNote,
          isTest ? "[TEST-WEB]" : "",
          customerNote,
        ]
          .filter(Boolean)
          .join(" | "));

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
          revision: 0,
          kvOrderId: null,
          kvOrderCode: null,
          kvInvoiceId: null,
          kvInvoiceCode: null,
          kvPushError: null,
          isTest,
          shopAccountId: req.shopAuth!.userId,
          kvCustomerId: user?.kvCustomerId || null,
          kvPushStatus: user?.siStatus === "active" && user?.roles?.includes("si") ? "queued" : undefined,
          priceMode: user?.siStatus === "active" && user?.roles?.includes("si") ? "si" : "web",
          siRegion: user?.siRegion || null,
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
          method: reviewFirst ? "Pending" : method,
          usingCod: reviewFirst || isTransfer ? false : usingCod,
          hasPreOrder,
          customerNote: customerNoteStored,
          paymentStatus: reviewFirst || isTransfer ? "unpaid" : "cod",
          orderStatus: reviewFirst
            ? "cho_xac_nhan"
            : isTransfer
              ? "cho_thanh_toan"
              : "cho_xu_ly",
          ...(reviewFirst
            ? { policyAcceptedAt: now, reviewNote: reviewKvDescription }
            : {}),
          ...(paymentCode ? { paymentCode } : {}),
          ...(idempotencyKey ? { idempotencyKey } : {}),
          expiresAt: expiresAt || null,
          stockApplied: false,
          stockHeld: false,
          status: reviewFirst ? "cho_xac_nhan" : isTransfer ? "cho_thanh_toan" : "cho",
          statusValue: reviewFirst
            ? "Chờ Aloha gửi ảnh"
            : isTransfer
              ? "Chờ thanh toán"
              : "Đặt hàng",
          done: false,
          purchaseDate: now,
          source: "shop_web",
          createdAt: now,
          updatedAt: now,
        };

        const insertRes = await shopDb.collection(SHOP_ORDERS).insertOne(doc);
        const mongoId = insertRes.insertedId;

        // Soft-hold tồn shop ngay khi đơn đã được lưu trên Mongo
        if (shopStockHoldEnabled()) {
          const holdDetails = orderDetails.filter((d) => !d.preOrder);
          if (holdDetails.length) {
            try {
              await ensureShopStockHoldIndexes(shopDb);
              await createShopStockHolds({
                shopDb,
                orderId: code,
                orderCode: code,
                details: holdDetails,
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
        }

        // Tồn kho và soft-hold đã an toàn trên Mongo -> Giải phóng lock checkout ngay lập tức,
        // không giữ lock trong lúc gọi các API đồng bộ ngoài như KiotViet (có thể mất vài giây)
        try { (res as any).releaseCheckoutLock?.(); } catch {}

        // Đồng ý chính sách → Đặt hàng KV, chưa hóa đơn. COD cũ giữ nhánh dưới.
        if (doc.priceMode !== "si" && (reviewFirst || !isTransfer) && shopCodKvEnabled()) {
          try {
            const ord = await (reviewFirst ? ensureReviewKvOrder : ensureCodKvOrder)({
              mainDb: mainDbEarly,
              customerName,
              customerId: user?.kvCustomerId ? Number(user.kvCustomerId) : undefined,
              customerPhone,
              address: fullAddressForKv({
                deliveryMethod,
                shippingAddress,
                ward,
                district,
                province,
              }),
              orderDetails,
              description: reviewFirst
                ? reviewKvDescription
                : `Shop COD | ${ctvNote} | ${kvPreOrderHint ? kvPreOrderHint + " | " : ""}${isTest ? "[TEST-WEB] " : ""}${customerNote || "Shop COD"}`.slice(
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
            const msg = String(
              e?.message || e || "Không tạo được đơn đặt hàng trên KiotViet"
            );
            if (hasPreOrder) {
              console.warn("[shop-order] kv COD soft-fail (preOrder)", code, msg);
              const patch = {
                kvPushError: msg.slice(0, 500),
                updatedAt: new Date().toISOString(),
              };
              await shopDb
                .collection(SHOP_ORDERS)
                .updateOne({ _id: mongoId }, { $set: patch });
              Object.assign(doc, patch);
            } else {
              if (doc.stockHeld) {
                await releaseShopStockHolds(shopDb, code).catch(() => {});
              }
              await shopDb.collection(SHOP_ORDERS).deleteOne({ _id: mongoId }).catch(() => {});
              return res.status(400).json({
                error: msg,
                code: "kv_cod_order_failed",
                hint: "Kiểm tra kết nối KiotViet / tồn chi nhánh, rồi đặt lại. Đơn chưa được tạo trên shop.",
              });
            }
          }
        }

        // Transfer + KiotQR: HĐ chờ CK sau khi đã có đơn Mongo
        if (isTransfer && doc.priceMode !== "si") {
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
                  `${paymentCode} | Web ${code} | ${ctvNote} | ${kvPreOrderHint ? kvPreOrderHint + " | " : ""}${customerNote || "Shop CK"}`.slice(
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
              const msg = String(e?.message || e || "Không tạo được hóa đơn chờ CK");
              // Đơn đặt trước: giữ Mongo + QR ngân hàng dù KV từ chối vì hết tồn
              if (hasPreOrder) {
                console.warn("[shop-order] kv awaiting soft-fail (preOrder)", code, msg);
                const patch = {
                  kvPushError: msg.slice(0, 500),
                  updatedAt: new Date().toISOString(),
                };
                await shopDb
                  .collection(SHOP_ORDERS)
                  .updateOne({ _id: mongoId }, { $set: patch });
                Object.assign(doc, patch);
              } else {
                if (doc.stockHeld) {
                  await releaseShopStockHolds(shopDb, code).catch(() => {});
                }
                await shopDb.collection(SHOP_ORDERS).deleteOne({ _id: mongoId }).catch(() => {});
                return res.status(400).json({
                  error: msg,
                  code: "kv_awaiting_failed",
                  hint: "Kiểm tra tồn đúng chi nhánh bán trên KiotViet, hoặc tạm tắt SHOP_KIOTQR_AWAITING=0.",
                });
              }
            }
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
