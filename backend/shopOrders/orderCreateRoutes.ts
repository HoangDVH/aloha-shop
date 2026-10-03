import { createBackorderRequest, serializeShopCheckout } from "./backorder.js";
import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { SHOP_ORDERS, newPaymentCode, newShopOrderCode, transferTtlMinutes } from "./models.js";
import { annotatePreOrderDetails, assertStockAvailable } from "./stockApply.js";
import { resolveShopPaymentQrForOrder } from "./bankConfig.js";
import { syncBus } from "../syncBus.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  type GetMainDb,
  applyCatalogPrices,
  parseOrderDetails,
  setShopCors,
} from "./orderRouteShared.js";
import {
  shopAllowTransferPayment,
  shopAllowPreOrderCod,
  shopPreOrderCodMaxVnd,
} from "./checkoutFlags.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";
import { keepActiveCtvCodes } from "./create/ctvCodes.js";
import { checkShippingQuote } from "./create/shippingQuoteCheck.js";
import { evaluateOrderPromotions } from "./create/orderPromotions.js";
import { buildOrderNotes } from "./create/orderNotes.js";
import {
  findIdempotentReplay,
  orderBodyHash,
  orderResponseData,
  readIdempotencyKey,
} from "./create/orderResponse.js";
import { holdOrderPromotions } from "./create/promotionHolds.js";
import { buildOrderDoc } from "./create/orderDoc.js";
import { holdOrderStock, pushOrderToKv } from "./create/kvOrderPush.js";
import { rememberShippingAddress } from "./create/saveAddress.js";
import { isStepFail } from "./create/stepResult.js";
import {
  dropClientGiftLines,
  goodsSubtotal,
  holdOrderCampaign,
  priceOrderWithCampaign,
} from "./create/campaignStep.js";
import { releaseOrderPromotions } from "./create/promotionHolds.js";
import { releaseUnsavedHolds } from "../shopCampaigns/orderCampaign.js";

type CheckoutForm = {
  deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
  method: "Transfer" | "Cash";
  usingCod: boolean;
  customerNote: string;
  customerName: string;
  customerPhone: string;
  province: string;
  district: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  shippingAddress: string;
  addressId: string;
};

function readCheckoutForm(body: any): CheckoutForm {
  const method = body.method === "Transfer" ? "Transfer" : "Cash";
  return {
    deliveryMethod: body.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi",
    method,
    usingCod: method === "Cash" || Boolean(body.usingCod),
    customerNote: String(body.customerNote || "").trim().slice(0, 255),
    customerName: String(body.customerName || "").trim(),
    customerPhone: String(body.customerPhone || "").trim(),
    province: String(body.province || "").trim(),
    district: String(body.district || "").trim(),
    ward: String(body.ward || "").trim(),
    ghnDistrictId: Number(body.ghnDistrictId || 0) || undefined,
    ghnWardCode: String(body.ghnWardCode || "").trim() || undefined,
    shippingAddress: String(body.shippingAddress || body.detail || "").trim(),
    addressId: body.addressId ? String(body.addressId).trim() : "",
  };
}

function invalidQuantities(rawDetails: unknown): boolean {
  if (!Array.isArray(rawDetails) || rawDetails.length > 100) return true;
  return rawDetails.some((d: any) => {
    const q = Number(d.quantity ?? d.qty);
    return !Number.isSafeInteger(q) || q < 1 || q > 10000;
  });
}

/** Lỗi nhập liệu cơ bản của form checkout; null = hợp lệ. */
function validateForm(form: CheckoutForm): string | null {
  if (!form.customerName || !form.customerPhone) return "Nhập tên và số điện thoại";
  if (
    form.deliveryMethod === "giao_tan_noi" &&
    (!form.province || !form.ward || !form.shippingAddress)
  ) {
    return "Nhập đủ tỉnh, phường và địa chỉ nhận hàng";
  }
  return null;
}

function releaseLock(res: Response) {
  try {
    (res as any).releaseCheckoutLock?.();
  } catch {}
}

/** POST /api/shop/orders — tạo đơn (COD / chuyển khoản). */
async function createShopOrder(
  req: ShopAuthRequest,
  res: Response,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb,
  ensureIdx: (db: Db) => Promise<void>
) {
  if (!(await shopRateLimitOrReject(req, res, "shop_order_create", 20, 60_000))) return;
  const shopDb = await getShopDb();
  await ensureIdx(shopDb);
  const accountId = req.shopAuth!.userId;

  const body = req.body || {};
  const form = readCheckoutForm(body);
  const { deliveryMethod, method, customerName, customerPhone, customerNote } = form;
  const { province, district, ward, shippingAddress, addressId } = form;
  if (method === "Transfer" && !shopAllowTransferPayment()) {
    return res.status(400).json({
      error: "Shop hiện chỉ nhận thanh toán khi nhận hàng (COD)",
      code: "transfer_disabled",
    });
  }
  const rawDetails = body.orderDetails || body.items;
  if (invalidQuantities(rawDetails)) {
    return res.status(400).json({ error: "Số lượng không hợp lệ (1–10.000), tối đa 100 dòng" });
  }
  let orderDetails = parseOrderDetails(dropClientGiftLines(rawDetails));
  if (!orderDetails.length) {
    return res.status(400).json({ error: "Giỏ hàng trống hoặc thiếu sản phẩm" });
  }
  const formError = validateForm(form);
  if (formError) return res.status(400).json({ error: formError });

  const user = await shopDb.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(accountId));
  const buyerEmail = user?.email ? String(user.email) : "";
  const mainDb = await getMainDb();

  const priced = await applyCatalogPrices(shopDb, orderDetails, { buyerEmail, account: user });
  if (!priced.ok) return res.status(400).json({ error: (priced as any).error });
  if (orderDetails.some((d, i) => d.price !== priced.details[i].price)) {
    return res.status(409).json({
      code: "price_changed",
      error: "Giá đã cập nhật. Vui lòng kiểm tra và xác nhận giá mới.",
      details: priced.details,
    });
  }
  orderDetails = await keepActiveCtvCodes(shopDb, priced.details);

  // Đánh dấu đặt trước theo tồn lúc submit (displayTon − hold)
  const annotated = await annotatePreOrderDetails(mainDb, orderDetails, shopDb);
  if (!annotated.ok) return res.status(400).json({ error: (annotated as any).error });
  orderDetails = annotated.details;

  const hasPreOrder = orderDetails.some((d) => Boolean(d.preOrder));
  const policyAccepted = body.policyAccepted === true;
  const needsCustomerLink =
    user?.siStatus === "active" && user?.roles?.includes("si") && !user.kvCustomerId;
  // Sỉ chưa gắn khách KV vẫn lưu yêu cầu trên web. Đơn còn lại, sau khi đồng ý chính sách, đi tạo đơn đặt hàng KV.
  if (needsCustomerLink || (hasPreOrder && !policyAccepted)) {
    const result = await createBackorderRequest(shopDb, {
      userId: accountId,
      account: user,
      body,
      details: orderDetails,
    });
    releaseLock(res);
    return res.status(result.status).json(result.body);
  }
  if (!policyAccepted) {
    return res.status(409).json({
      code: "policy_confirmation_required",
      error: "Vui lòng đồng ý chính sách kiểm hàng và xác nhận ảnh trước khi đặt hàng",
    });
  }

  const campaignBuyer = { accountId, account: user, phone: customerPhone, email: buyerEmail };
  const campaign = await priceOrderWithCampaign(shopDb, orderDetails, campaignBuyer, body.expectedSubtotal);
  if (isStepFail(campaign)) return res.status(campaign.status).json(campaign.body);
  orderDetails = campaign.details;

  const subtotal = goodsSubtotal(orderDetails);
  const quote = checkShippingQuote({
    body,
    deliveryMethod,
    orderDetails,
    subtotal,
    province,
    district,
    ward,
    ghnWardCode: form.ghnWardCode,
  });
  if (isStepFail(quote)) return res.status(quote.status).json(quote.body);

  const promo = await evaluateOrderPromotions(shopDb, mainDb, {
    body,
    accountId: req.shopAuth?.userId,
    roles: req.shopAuth?.roles,
    customerPhone,
    buyerEmail,
    deliveryMethod,
    orderDetails,
    subtotal,
    quote,
    address: { province, district, ghnDistrictId: form.ghnDistrictId },
  });
  if (isStepFail(promo)) return res.status(promo.status).json(promo.body);
  const { discount, shippingFeeCharged } = promo;

  const total = Math.max(0, subtotal - discount + shippingFeeCharged);
  const ctvCodes = [...new Set(orderDetails.map((d) => d.ctvCode).filter(Boolean) as string[])];

  // Đơn đã đồng ý chính sách: chưa thu tiền, chưa lập hóa đơn.
  const reviewFirst = policyAccepted;
  // Pre-order COD: cho phép dưới ngưỡng; vượt ngưỡng → bắt CK (kiểu sàn)
  if (!reviewFirst && hasPreOrder && method !== "Transfer" && !shopAllowPreOrderCod(total)) {
    const max = shopPreOrderCodMaxVnd();
    return res.status(400).json({
      error: `Đơn đặt trước trên ${max.toLocaleString("vi-VN")}đ — vui lòng thanh toán chuyển khoản`,
      code: "preorder_cod_over_limit",
      maxVnd: max,
    });
  }
  const isTransfer = !reviewFirst && method === "Transfer";

  // Chỉ assert dòng không preOrder. Soft-hold sau insert cũng skip preOrder.
  const stock = await assertStockAvailable(mainDb, orderDetails, shopDb);
  if (!stock.ok) return res.status(400).json({ error: (stock as any).error });

  const notes = buildOrderNotes({
    body,
    customerNote,
    buyerEmail,
    orderDetails,
    ctvCodes,
    hasPreOrder,
  });
  const idempotencyKey = readIdempotencyKey(body, req.headers);
  const bodyHash = orderBodyHash({
    orderDetails,
    customerPhone,
    deliveryMethod,
    shippingAddress,
    subtotal,
  });
  const replay = await findIdempotentReplay(shopDb, accountId, idempotencyKey, bodyHash);
  if (replay.kind === "conflict") return res.status(409).json(replay.body);
  if (replay.kind === "reused") return res.status(200).json(replay.body);

  // Mongo trước — tránh orphan KV nếu insert lỗi
  let code = newShopOrderCode();
  const applied = promo.appliedPromotion;
  const shipApplied = promo.shippingPromotion;
  const held = await holdOrderPromotions(shopDb, {
    orderCode: code,
    accountId,
    buyerPhone: customerPhone,
    buyerEmail,
    customerKey: promo.customerKey,
    idempotencyKey,
    isNewWebPromo: promo.isNewWebPromo,
    goods: applied ? { promotionId: applied.promotionId, code: applied.code, discount } : null,
    shipping: shipApplied
      ? { promotionId: shipApplied.promotionId, discount: promo.shippingDiscount }
      : null,
  });
  if (isStepFail(held)) return res.status(held.status).json(held.body);
  const campaignHeld = await holdOrderCampaign(shopDb, campaign.plan, campaignBuyer);
  if (isStepFail(campaignHeld)) {
    await releaseOrderPromotions(shopDb, code, promo.isNewWebPromo);
    return res.status(campaignHeld.status).json(campaignHeld.body);
  }

  const paymentCode = isTransfer ? newPaymentCode(code) : undefined;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = isTransfer
    ? new Date(nowDate.getTime() + transferTtlMinutes() * 60_000)
    : undefined;

  const doc = buildOrderDoc({
    code,
    accountId,
    user,
    isTest: notes.isTest,
    addressId,
    customerName,
    customerPhone,
    deliveryMethod,
    province,
    district,
    ward,
    ghnDistrictId: form.ghnDistrictId,
    ghnWardCode: form.ghnWardCode,
    shippingAddress,
    orderDetails,
    ctvCodes,
    subtotal,
    discount,
    total,
    shippingFeeCharged,
    shippingFeeOriginal: promo.shippingFeeOriginal,
    shippingDiscount: promo.shippingDiscount,
    shippingPromotion: shipApplied,
    shippingPromotionPending: promo.shippingPending,
    shippingCarrier: quote.shippingCarrier,
    freeShipApplied: quote.freeShipApplied,
    totalWeightGram: quote.totalWeightGram,
    quoteToken: quote.quoteToken,
    quoteVerified: quote.quoteVerified,
    appliedPromotion: applied,
    method,
    usingCod: form.usingCod,
    hasPreOrder,
    customerNoteStored: notes.customerNoteStored,
    reviewFirst,
    isTransfer,
    reviewKvDescription: notes.reviewKvDescription,
    paymentCode,
    idempotencyKey,
    bodyHash,
    expiresAt,
    now,
    campaignHolds: campaignHeld.holds,
    flashSavings: campaign.flashSavings,
    anchorSavings: campaign.anchorSavings,
  });

  let insertRes;
  try {
    insertRes = await shopDb.collection(SHOP_ORDERS).insertOne(doc);
  } catch (e) {
    await releaseUnsavedHolds(shopDb, campaignHeld.holds);
    await releaseOrderPromotions(shopDb, code, promo.isNewWebPromo);
    throw e;
  }
  const pushCtx = {
    shopDb,
    mainDb,
    mongoId: insertRes.insertedId,
    doc,
    code,
    user,
    orderDetails,
    customerName,
    customerPhone,
    customerNote,
    address: { deliveryMethod, shippingAddress, ward, district, province },
    hasPreOrder,
    isNewWebPromo: promo.isNewWebPromo,
    isTest: notes.isTest,
    reviewFirst,
    isTransfer,
    ctvNote: notes.ctvNote,
    kvPreOrderHint: notes.kvPreOrderHint,
    reviewKvDescription: notes.reviewKvDescription,
    paymentCode,
    total,
    shippingFeeCharged,
    discount,
    expiresAt,
  };
  await holdOrderStock(pushCtx);

  // Tồn kho và soft-hold đã an toàn trên Mongo -> Giải phóng lock checkout ngay lập tức,
  // không giữ lock trong lúc gọi các API đồng bộ ngoài như KiotViet (có thể mất vài giây)
  releaseLock(res);

  const pushed = await pushOrderToKv(pushCtx);
  if (isStepFail(pushed)) return res.status(pushed.status).json(pushed.body);
  code = pushed.code;

  syncBus.publish(["shop_orders"], "shop-order-create", { ids: [code] });
  void notifyOrderStatus(shopDb, doc, "dat_hang").catch((e) =>
    console.warn("[shop-notify] dat_hang", code, e?.message || e)
  );
  if (deliveryMethod === "giao_tan_noi" && !addressId && user) {
    await rememberShippingAddress(shopDb, user, {
      customerName,
      customerPhone,
      province,
      ward,
      shippingAddress,
    });
  }

  const qr = isTransfer ? await resolveShopPaymentQrForOrder(doc as any, shopDb) : null;
  return res.status(201).json({ ok: true, data: orderResponseData(doc, qr) });
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
        await createShopOrder(req, res, getShopDb, getMainDb, ensureIdx);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi tạo đơn" });
      }
    }
  );
}
