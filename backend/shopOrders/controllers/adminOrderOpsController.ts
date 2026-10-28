import type { Response } from "express";
import type { AuthRequest, GetDb } from "../../auth/middleware.js";
import { SHOP_ORDERS } from "../models.js";
import { SHOP_COMMISSIONS } from "../commissionModels.js";
import { syncBus } from "../../syncBus.js";
import type { ShopOrderDetail } from "../models.js";
import { ensureCodKvOrder, shopCodKvEnabled } from "../../shopInvoices/invoiceService.js";
import { fullAddressForKv } from "../orderRouteShared.js";
import { kvDeliveryAddressForOrder } from "../kvDeliveryAddress.js";
import { checkStoredWholesaleOrder } from "../../shopWholesale/orderPurchaseCheck.js";
import { cancelShopOrderOnKiotViet } from "../kvOrderCancel.js";
import { cancelShopInvoiceOnKiotViet } from "../kvPush.js";
import { shopOrderLookupFilter } from "../findShopOrder.js";
import { migrateWebOrderCodes } from "../migrateWebCodes.js";
import { syncShopOrderMoneyFromKv } from "../kvOrderMoneySync.js";
import { voidCommissionsForOrder } from "../commission.js";
import { releaseShopStockHolds } from "../stockHold.js";
import { releasePromotionHold } from "../../shopPromotions/redemptionService.js";
import { undoCampaignHoldsForPurge } from "../../shopCampaigns/orderCampaign.js";
import { voidTestOrder } from "../voidTestOrder.js";
import type { GetShopDb } from "../routes.js";
import { ensureAdminOrderIndexes } from "./adminOrderQueryController.js";

export async function handleSyncKv(
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
    const result = await syncShopOrderMoneyFromKv({
      shopDb,
      mainDb,
      orderRef: id,
    });
    if (!result.ok) {
      return res.status(result.error === "not_found" ? 404 : 400).json(result);
    }
    const updatedOrder = await shopDb.collection(SHOP_ORDERS).findOne(shopOrderLookupFilter(id));
    return res.json({ ...result, order: updatedOrder });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "sync_kv_failed" });
  }
}

export async function handleRetryKvPush(
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
    const doc = await shopDb.collection(SHOP_ORDERS).findOne(shopOrderLookupFilter(id));
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
      productCode: String(it?.productCode || it?.ma || "").trim().toUpperCase(),
      productName: String(it?.productName || it?.ten || "").trim(),
      quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
      price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
      discount: Number(it?.discount || 0) || 0,
      ctvCode: it?.ctvCode ? String(it.ctvCode) : undefined,
    }));
    const code = String((doc as any).code || id);
    const eligibility = await checkStoredWholesaleOrder(shopDb, mainDb, doc);
    if (eligibility && !eligibility.canCheckout) {
      return res.status(400).json({ error: eligibility.issues.map((i) => i.message).join(" "), eligibility });
    }
    const ctvCodes = Array.isArray((doc as any).ctvCodes) ? (doc as any).ctvCodes : [];
    const ctvNote = ctvCodes.length ? `CTV:${ctvCodes.join(",")}` : "";
    try {
      const ord = await ensureCodKvOrder({
        mainDb,
        customerId: doc.kvCustomerId ? Number(doc.kvCustomerId) : undefined,
        customerName: String((doc as any).customerName || ""),
        customerPhone: String((doc as any).customerPhone || ""),
        address: fullAddressForKv(doc as any),
        deliveryAddress: kvDeliveryAddressForOrder(doc),
        orderDetails: details,
        description: `Web ${code} | COD | ${ctvNote} | retry`.slice(0, 500),
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
            kvDeliveryAddress: ord.kvDeliveryAddress || null,
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

export async function handleVoidTest(
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
    const result = await voidTestOrder({
      shopDb,
      mainDb,
      ref: String(req.params.id || "").trim(),
      confirmCode: String(req.body?.confirmCode || ""),
      actor: req.auth?.username || "admin",
    });
    if (result.ok === false) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "void_test_failed" });
  }
}

export async function handlePurgeTest(
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
      await releasePromotionHold(shopDb, code).catch(() => undefined);
      await undoCampaignHoldsForPurge(shopDb, code).catch(() => undefined);
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

export async function handleMigrateWebCodes(
  req: AuthRequest,
  res: Response,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
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
