/**
 * SePay webhook + GET bank config công khai.
 */
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import {
  SHOP_ORDERS,
  ensureShopOrderIndexes,
  extractSepayOrderRefs,
} from "./models.js";
import { getShopBankConfig } from "./bankConfig.js";
import { expireUnpaidShopOrders, markShopOrderPaid } from "./markPaid.js";
import {
  classifyAmountMismatch,
  flagPaymentForReview,
} from "./paymentReview.js";
import { applyShopCors } from "../shopCors.js";

export type GetShopDb = () => Promise<Db>;
export type GetMainDb = () => Promise<Db>;

function sepayEnabled(): boolean {
  const v = String(process.env.SEPAY_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function verifySepayApiKey(req: Request): boolean {
  const expected = String(process.env.SEPAY_WEBHOOK_API_KEY || "").trim();
  if (!expected) {
    // Dev: nếu chưa cấu hình key thì từ chối (an toàn hơn mở)
    return false;
  }
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("apikey ")) {
    return auth.slice(7).trim() === expected;
  }
  const headerKey = String(req.headers["x-api-key"] || "").trim();
  if (headerKey && headerKey === expected) return true;
  return false;
}

async function findOrderForSepay(
  shopDb: Db,
  refs: ReturnType<typeof extractSepayOrderRefs>
) {
  const or: Record<string, unknown>[] = [];
  if (refs.paymentCodes.length) {
    or.push({ paymentCode: { $in: refs.paymentCodes } });
  }
  if (refs.kvInvoiceCodes.length) {
    // QR Kiot hiện dùng mã HĐ (HD…) làm nội dung CK
    or.push({ kvInvoiceCode: { $in: refs.kvInvoiceCodes } });
  }
  if (refs.orderCodes.length) {
    or.push({ code: { $in: refs.orderCodes } });
    or.push({ id: { $in: refs.orderCodes } });
  }
  if (!or.length) return null;

  return shopDb.collection(SHOP_ORDERS).findOne(
    { method: "Transfer", $or: or },
    { sort: { createdAt: -1 } }
  );
}

export function registerShopPaymentRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  let indexesReady = false;
  const ensureIdx = async (db: Db) => {
    if (indexesReady) return;
    await ensureShopOrderIndexes(db);
    try {
      await db
        .collection(SHOP_ORDERS)
        .createIndex({ kvInvoiceCode: 1 }, { sparse: true, background: true });
    } catch {
      /* ignore */
    }
    indexesReady = true;
  };

  app.get("/api/shop/payments/bank", (req, res: Response) => {
    applyShopCors(req, res);
    const cfg = getShopBankConfig();
    res.json({
      ok: true,
      data: {
        bin: cfg.bin,
        accountNumber: cfg.accountNumber,
        accountName: cfg.accountName,
        bankName: cfg.bankName,
        ttlMin: cfg.ttlMin,
        configured: cfg.configured,
        sepayEnabled: sepayEnabled(),
      },
    });
  });

  /** SePay POST webhook — bật SEPAY_ENABLED=1 + SEPAY_WEBHOOK_API_KEY. */
  app.post("/api/shop/payments/sepay", async (req: Request, res: Response) => {
    try {
      if (!sepayEnabled()) {
        return res.status(503).json({
          success: false,
          error: "sepay_disabled",
          message: "Đang dùng xác nhận tay — bật SEPAY_ENABLED=1 để dùng webhook",
        });
      }

      if (!verifySepayApiKey(req)) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }

      const body = req.body || {};
      const transferType = String(body.transferType || "").toLowerCase();
      if (transferType && transferType !== "in") {
        return res.json({ success: true, ignored: "not_in" });
      }

      const cfg = getShopBankConfig();
      const accountNumber = String(body.accountNumber || "").replace(/\s+/g, "");
      const shopAcc = cfg.accountNumber.replace(/\s+/g, "");
      // Test Mode SePay dùng STK giả — chỉ cảnh báo, vẫn khớp theo HD/ALH + số tiền + API Key.
      // Chặn cứng khi SEPAY_STRICT_ACCOUNT=1 (Live muốn soi đúng STK shop).
      if (shopAcc && accountNumber && accountNumber !== shopAcc) {
        const strict =
          String(process.env.SEPAY_STRICT_ACCOUNT || "").trim() === "1";
        console.warn("[sepay] account mismatch", {
          got: accountNumber,
          expect: shopAcc,
          strict,
        });
        if (strict) {
          return res.json({ success: true, ignored: "account_mismatch" });
        }
      }

      const amount = Math.round(Number(body.transferAmount) || 0);
      const txId = body.id;
      const refs = extractSepayOrderRefs(
        String(body.content || body.description || ""),
        String(body.code || "")
      );
      const hasRef =
        refs.paymentCodes.length > 0 ||
        refs.kvInvoiceCodes.length > 0 ||
        refs.orderCodes.length > 0;

      if (!hasRef || !(amount > 0) || txId == null || txId === "") {
        return res.json({
          success: true,
          ignored: "incomplete_payload",
          refs,
        });
      }

      const shopDb = await getShopDb();
      await ensureIdx(shopDb);
      await expireUnpaidShopOrders(shopDb, await getMainDb());

      // Idempotent theo sepay id
      const byTx = await shopDb.collection(SHOP_ORDERS).findOne({
        sepayTransactionId: txId,
      });
      if (byTx?.paymentStatus === "paid") {
        return res.json({ success: true, alreadyPaid: true, code: byTx.code });
      }

      const order = await findOrderForSepay(shopDb, refs);

      if (!order) {
        console.warn("[sepay] no order for", refs);
        return res.json({ success: true, ignored: "order_not_found", refs });
      }

      const total = Math.round(Number(order.totalPayment ?? order.total) || 0);
      if (amount !== total) {
        const reason = classifyAmountMismatch(total, amount);
        await flagPaymentForReview(shopDb, String(order.code), {
          reason,
          expected: total,
          received: amount,
          bankTxId: txId,
          bankContent: String(body.content || body.description || ""),
          source: "sepay",
          note: "SePay: số tiền không khớp đơn",
        });
        return res.json({
          success: true,
          ignored: "amount_mismatch",
          review: reason,
          code: order.code,
        });
      }

      const mainDb = await getMainDb();
      const result = await markShopOrderPaid({
        shopDb,
        mainDb,
        orderCode: String(order.code),
        source: "sepay",
        sepayTransactionId: txId,
        allowExpired: true,
        confirmedBy: "sepay_webhook",
      });

      if (!result.ok) {
        console.warn("[sepay] markPaid failed", result.error);
        // Ack để SePay khỏi retry vô hạn khi expired; failed KV sẽ admin xử lý
        return res.json({ success: true, ok: false, error: result.error });
      }

      console.log("[sepay] paid", result.order.code, {
        txId,
        amount,
        hd: (result.order as any).kvInvoiceCode,
      });

      return res.json({
        success: true,
        code: result.order.code,
        alreadyPaid: result.alreadyPaid || false,
        shortfall: result.shortfall,
      });
    } catch (e: any) {
      console.error("[sepay] webhook error", e);
      return res.status(500).json({ success: false, error: e?.message || "error" });
    }
  });
}
