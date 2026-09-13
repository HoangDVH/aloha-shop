/**
 * Webhook KiotViet invoice.update — KiotQR CK → markPaid; COD giao/hoàn → complete/return.
 * Đăng ký: Type=invoice.update → /api/kv-webhook/invoices
 * Không tin body — luôn GET HĐ từ KV rồi mới paid / delivery.
 */
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { createHmac, timingSafeEqual } from "crypto";
import { ensureShopOrderIndexes } from "./models.js";
import { expireUnpaidShopOrders } from "./markPaid.js";
import { reconcileByKvInvoiceRef } from "./kvPaymentReconcile.js";
import { reconcileDeliveryByKvInvoiceRef } from "./kvDeliveryReconcile.js";

export type GetShopDb = () => Promise<Db>;
export type GetMainDb = () => Promise<Db>;

function safeEqualStr(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function isShopProductionRuntime(): boolean {
  return (
    process.env.ALOHA_IS_VPS === "1" || process.env.NODE_ENV === "production"
  );
}

function verifyKvWebhookSignature(req: Request): boolean {
  const secret = String(process.env.KIOTVIET_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    if (isShopProductionRuntime()) return false;
    return true;
  }
  const sig = String(
    req.headers["x-hub-signature"] ||
      req.headers["x-kiotviet-signature"] ||
      req.headers["x-hub-signature-256"] ||
      req.headers["x-signature"] ||
      ""
  ).trim();
  if (!sig) {
    console.warn("[kv-webhook/invoices] missing signature header");
    return false;
  }
  const rawBody: Buffer =
    (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  const keys: Array<string | Buffer> = [secret];
  try {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length >= 8) keys.push(decoded);
  } catch {
    /* ignore */
  }

  const candidates: string[] = [];
  for (const key of keys) {
    for (const algo of ["sha1", "sha256"] as const) {
      const hex = createHmac(algo, key).update(rawBody).digest("hex");
      const b64 = createHmac(algo, key).update(rawBody).digest("base64");
      candidates.push(
        hex,
        b64,
        `${algo}=${hex}`,
        `${algo}=${b64}`,
        hex.toUpperCase(),
        `sha256=${hex}`,
        `sha1=${hex}`
      );
    }
  }
  const ok = candidates.some(
    (c) => safeEqualStr(sig, c) || safeEqualStr(sig.toLowerCase(), c.toLowerCase())
  );
  if (!ok) {
    console.warn("[kv-webhook/invoices] invalid signature (vẫn đối soát qua API KV)", {
      sigLen: sig.length,
      sigHead: sig.slice(0, 12),
      bodyLen: rawBody.length,
    });
  }
  return ok;
}

function flattenInvoiceNotifications(body: any): any[] {
  const notifications: any[] = Array.isArray(body?.Notifications)
    ? body.Notifications
    : Array.isArray(body?.notifications)
      ? body.notifications
      : body?.Action || body?.action || body?.Id || body?.id || body?.Code
        ? [body]
        : [];
  const out: any[] = [];
  for (const n of notifications) {
    const data = n?.Data ?? n?.data ?? n;
    if (Array.isArray(data)) out.push(...data.filter(Boolean));
    else if (data) out.push(data);
  }
  return out;
}

function invoiceReceivedAmount(inv: any): number {
  const totalPayment = Math.round(
    Number(inv?.TotalPayment ?? inv?.totalPayment ?? 0) || 0
  );
  const payments = Array.isArray(inv?.Payments)
    ? inv.Payments
    : Array.isArray(inv?.payments)
      ? inv.payments
      : [];
  const sum = payments.reduce(
    (s: number, p: any) =>
      s + Math.round(Number(p?.Amount ?? p?.amount ?? 0) || 0),
    0
  );
  return Math.max(totalPayment, sum);
}

export function registerKvInvoiceWebhookRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  app.post("/api/kv-webhook/invoices", async (req: Request, res: Response) => {
    try {
      const sigOk = verifyKvWebhookSignature(req);
      const invoices = flattenInvoiceNotifications(req.body || {});
      if (!invoices.length) {
        return res.status(200).json({
          ok: true,
          processed: 0,
          note: "no_invoices",
          sigOk,
        });
      }

      const shopDb = await getShopDb();
      const mainDb = await getMainDb();
      await ensureShopOrderIndexes(shopDb);
      await expireUnpaidShopOrders(shopDb, mainDb);

      let marked = 0;
      const notes: string[] = [];

      for (const inv of invoices) {
        const kvInvoiceId = inv?.Id ?? inv?.id ?? inv?.InvoiceId;
        const kvInvoiceCode = String(inv?.Code || inv?.code || "").trim();
        if ((kvInvoiceId == null || kvInvoiceId === "") && !kvInvoiceCode) {
          notes.push("no_ref");
          continue;
        }

        const bodyReceived = invoiceReceivedAmount(inv);
        const r = await reconcileByKvInvoiceRef(getShopDb, getMainDb, {
          kvInvoiceId,
          kvInvoiceCode: kvInvoiceCode || null,
          fallbackReceived: bodyReceived > 0 ? bodyReceived : undefined,
        });
        if (r === "paid") {
          marked++;
          notes.push(`paid:${kvInvoiceCode || kvInvoiceId}`);
        } else {
          notes.push(`${r}:${kvInvoiceCode || kvInvoiceId}:body=${bodyReceived}`);
        }

        try {
          const d = await reconcileDeliveryByKvInvoiceRef(getShopDb, getMainDb, {
            kvInvoiceId,
            kvInvoiceCode: kvInvoiceCode || null,
          });
          notes.push(`delivery:${d}`);
        } catch (e: any) {
          notes.push(`delivery_err:${e?.message || e}`);
        }
      }

      console.log("[kv-webhook/invoices]", { marked, notes, sigOk });
      return res.status(200).json({ ok: true, processed: marked, notes, sigOk });
    } catch (e: any) {
      console.error("[kv-webhook/invoices]", e);
      return res.status(200).json({
        ok: false,
        error: e?.message || "webhook_failed",
      });
    }
  });
}
