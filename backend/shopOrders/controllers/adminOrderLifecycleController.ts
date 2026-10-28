import type { Response } from "express";
import type { AuthRequest, GetDb } from "../../auth/middleware.js";
import { SHOP_ORDERS } from "../models.js";
import { markShopOrderPaid } from "../markPaid.js";
import { dispatchShipment } from "../../shopShipping/shipmentDispatch.js";
import type { ShippingCarrier } from "../../shopShipping/carrierTypes.js";
import { completeShopOrderDelivered } from "../completeDelivered.js";
import { completeShopOrderReturned } from "../completeReturned.js";
import { notifyOrderStatus } from "../notifyOrderStatus.js";
import { syncBus } from "../../syncBus.js";
import type { GetShopDb } from "../routes.js";
import { ensureAdminOrderIndexes } from "./adminOrderQueryController.js";

export async function handleConfirmPayment(
  req: AuthRequest,
  res: Response,
  getDb: GetDb,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    const mainDb = await getDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
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

export async function handleConfirmShipment(
  req: AuthRequest,
  res: Response,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
    const id = String(req.params.id || "").trim();
    const doc = await shopDb.collection(SHOP_ORDERS).findOne({
      $or: [{ id }, { code: id }],
    });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });

    if (doc.deliveryMethod !== "giao_tan_noi") {
      return res.status(400).json({ error: "Đơn nhận tại cửa hàng — không tạo vận đơn" });
    }
    if (
      doc.shippingHandling === "customer_arranged" ||
      (!doc.shippingHandling && doc.priceMode === "si" && doc.siRegion === "HCM")
    ) {
      return res.status(400).json({ error: "Đơn này khách tự bố trí xe nhận hàng, không tạo vận đơn giao tự động." });
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

    await shopDb.collection(SHOP_ORDERS).updateOne(
      { _id: doc._id },
      { $set: { orderStatus: "dang_giao", updatedAt: now } }
    );

    return res.json({ ok: true, shipment, raw: result.raw, orderStatus: "dang_giao" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Lỗi tạo vận đơn" });
  }
}

export async function handleMarkShipping(
  req: AuthRequest,
  res: Response,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
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

export async function handleMarkDelivered(
  req: AuthRequest,
  res: Response,
  getDb: GetDb,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    const mainDb = await getDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
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

export async function handleMarkReturned(
  req: AuthRequest,
  res: Response,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
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
