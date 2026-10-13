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

export function verifyKvWebhookSignature(req: Request): boolean {
  const secret = String(process.env.KIOTVIET_WEBHOOK_SECRET || "").trim();
  const header = req.headers["x-hub-signature"];
  const rawBody = (req as any).rawBody;
  if (!secret || typeof header !== "string" || !Buffer.isBuffer(rawBody)) return false;
  try {
    // KiotViet Retail registers Secret as base64-encoded key bytes.
    const key = Buffer.from(secret, "base64");
    if (key.length < 8 || key.toString("base64") !== secret) return false;
    const sig = header.trim().replace(/^sha256=/, "");
    const received = /^[a-fA-F0-9]{64}$/.test(sig) ? Buffer.from(sig, "hex") : Buffer.from(sig, "base64");
    if (!/^[a-fA-F0-9]{64}$/.test(sig) && received.toString("base64") !== sig) return false;
    const expected = createHmac("sha256", key).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch { return false; }
}

export function flattenInvoiceNotifications(body: any): any[] {
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

export function registerKvInvoiceWebhookRoutes(
  app: Express,
  getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  app.post("/api/kv-webhook/invoices", async (req: Request, res: Response) => {
    try {
      const sigOk = verifyKvWebhookSignature(req);
      if (!sigOk) return res.status(401).json({ ok: false, error: "invalid_webhook_signature" });
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

        const r = await reconcileByKvInvoiceRef(getShopDb, getMainDb, {
          kvInvoiceId,
          kvInvoiceCode: kvInvoiceCode || null,
        });
        if (r === "paid") {
          marked++;
          notes.push(`paid:${kvInvoiceCode || kvInvoiceId}`);
        } else {
          notes.push(`${r}:${kvInvoiceCode || kvInvoiceId}`);
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
      const failed = notes.some(note => note.startsWith("fail:") || note.startsWith("delivery_err:"));
      return res.status(failed ? 503 : 200).json({ ok: !failed, processed: marked, notes, sigOk });
    } catch (e: any) {
      console.error("[kv-webhook/invoices]", e);
      return res.status(503).json({
        ok: false,
        error: "webhook_failed",
      });
    }
  });
}
