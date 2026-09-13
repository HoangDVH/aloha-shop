/**
 * Luồng Pending Review khi CK lệch số tiền / nội dung.
 * Thông báo: SSE app nội bộ + Telegram Bot (tùy chọn) + webhook (tùy chọn).
 */
import type { Db } from "mongodb";
import { syncBus } from "../syncBus.js";
import { SHOP_ORDERS } from "./models.js";

export const SHOP_PAYMENT_ALERTS = "aloha_shop_payment_alerts";

export type PaymentReviewReason =
  | "underpaid"
  | "overpaid"
  | "amount_mismatch"
  | "content_mismatch"
  | "orphan_transfer";

export type PaymentReviewPayload = {
  reason: PaymentReviewReason;
  expected: number;
  received: number;
  bankTxId?: string | number | null;
  bankContent?: string | null;
  source: "sepay" | "kiotqr" | "admin" | "system";
  note?: string;
};

export type FlagReviewResult = {
  ok: true;
  code: string;
  reason: PaymentReviewReason;
};

function reasonLabel(r: PaymentReviewReason): string {
  switch (r) {
    case "underpaid":
      return "Thiếu tiền";
    case "overpaid":
      return "Thừa tiền";
    case "content_mismatch":
      return "Sai nội dung CK";
    case "orphan_transfer":
      return "Tiền vào chưa gắn đơn";
    default:
      return "Lệch thanh toán";
  }
}

export function classifyAmountMismatch(expected: number, received: number): PaymentReviewReason {
  const e = Math.round(expected || 0);
  const r = Math.round(received || 0);
  if (r > 0 && e > 0 && r < e) return "underpaid";
  if (r > 0 && e > 0 && r > e) return "overpaid";
  return "amount_mismatch";
}

/** Ghi đơn vào Pending Review + alert admin (idempotent theo bankTxId nếu có). */
export async function flagPaymentForReview(
  shopDb: Db,
  orderCode: string,
  payload: PaymentReviewPayload
): Promise<FlagReviewResult | { ok: false; error: string }> {
  const code = String(orderCode || "").trim();
  if (!code) return { ok: false, error: "missing_code" };

  const col = shopDb.collection(SHOP_ORDERS);
  const order = await col.findOne({ $or: [{ code }, { id: code }] });
  if (!order) return { ok: false, error: "not_found" };

  if ((order as any).paymentStatus === "paid") {
    return { ok: true, code: String((order as any).code), reason: payload.reason };
  }

  const now = new Date().toISOString();
  const reason = payload.reason;
  const review = {
    needed: true,
    reason,
    expected: Math.round(payload.expected || 0),
    received: Math.round(payload.received || 0),
    bankTxId: payload.bankTxId != null ? String(payload.bankTxId) : null,
    bankContent: payload.bankContent ? String(payload.bankContent).slice(0, 500) : null,
    source: payload.source,
    note: payload.note || null,
    at: now,
  };

  // Idempotent: cùng bankTxId đã gắn review → không spam alert
  const prevTx = String((order as any)?.paymentReview?.bankTxId || "");
  const sameTx =
    review.bankTxId && prevTx && prevTx === review.bankTxId && (order as any)?.paymentReview?.needed;

  const statusSet: Record<string, unknown> = {
    paymentReview: review,
    paymentMismatch: {
      expected: review.expected,
      received: review.received,
      at: now,
      bankTxId: review.bankTxId,
      source: payload.source,
    },
    statusValue: `${reasonLabel(reason)} — cần kiểm tra`,
    updatedAt: now,
  };

  if (reason === "underpaid") {
    statusSet.paymentStatus = "underpaid";
  }
  // overpaid / khác: giữ unpaid|processing để khách vẫn thấy đơn chờ; chỉ gắn review

  await col.updateOne({ _id: (order as any)._id }, { $set: statusSet });

  const alertDoc = {
    type: "payment_review",
    orderCode: String((order as any).code),
    customerName: (order as any).customerName || "",
    customerPhone: (order as any).customerPhone || "",
    paymentCode: (order as any).paymentCode || "",
    ...review,
    createdAt: now,
    readAt: null,
  };

  if (!sameTx) {
    await shopDb.collection(SHOP_PAYMENT_ALERTS).insertOne(alertDoc);
    syncBus.publish(["shop_orders", "shop_payment_alerts"], "payment-review", {
      ids: [String((order as any).code)],
    });
    await notifyAdminPaymentReview(alertDoc).catch((e) =>
      console.warn("[payment-review] notify", e?.message || e)
    );
  }

  console.warn("[payment-review]", {
    code: (order as any).code,
    reason,
    expected: review.expected,
    received: review.received,
    bankTxId: review.bankTxId,
  });

  return { ok: true, code: String((order as any).code), reason };
}

function buildPaymentReviewText(alert: Record<string, unknown>): string {
  return (
    `[ALOHA] Cần kiểm tra CK\n` +
    `Đơn: ${alert.orderCode}\n` +
    `KH: ${alert.customerName || ""} · ${alert.customerPhone || ""}\n` +
    `Lý do: ${reasonLabel(String(alert.reason) as PaymentReviewReason)}\n` +
    `Cần thu: ${Number(alert.expected || 0).toLocaleString("vi-VN")}đ\n` +
    `Đã nhận: ${Number(alert.received || 0).toLocaleString("vi-VN")}đ\n` +
    `Mã GD: ${alert.bankTxId || "—"}\n` +
    `Nội dung: ${alert.bankContent || alert.paymentCode || "—"}\n` +
    `Nguồn: ${alert.source || ""}`
  );
}

/** Gửi tin Telegram Bot (SHOP_TELEGRAM_BOT_TOKEN + SHOP_TELEGRAM_CHAT_ID, nhiều id cách nhau bằng dấu phẩy). */
async function notifyTelegramPaymentReview(text: string): Promise<void> {
  const token = String(process.env.SHOP_TELEGRAM_BOT_TOKEN || "").trim();
  const chatIds = String(process.env.SHOP_TELEGRAM_CHAT_ID || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || !chatIds.length) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const bodyText = text.slice(0, 4000);
  const errors: string[] = [];

  for (const chatId of chatIds) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: bodyText,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const raw = await res.text().catch(() => "");
      let json: { ok?: boolean; description?: string } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok || (json && json.ok === false)) {
        errors.push(`${chatId}: ${json?.description || `HTTP ${res.status} ${raw.slice(0, 120)}`}`);
      }
    } catch (e: any) {
      errors.push(`${chatId}: ${e?.message || e}`);
    }
  }
  if (errors.length) throw new Error(`telegram ${errors.join("; ")}`);
}

/** Webhook tùy chọn: Discord / Zapier… POST JSON. */
async function notifyWebhookPaymentReview(
  text: string,
  alert: Record<string, unknown>
): Promise<void> {
  const url = String(process.env.SHOP_PAYMENT_ALERT_WEBHOOK || "").trim();
  if (!url) return;

  const body =
    url.includes("discord.com") || url.includes("discordapp.com")
      ? { content: text.slice(0, 1900) }
      : { text, ...alert };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`alert webhook HTTP ${res.status} ${t.slice(0, 200)}`);
  }
}

/** App (SSE) đã publish riêng; đây là kênh phụ: Telegram + webhook. */
export async function notifyAdminPaymentReview(alert: Record<string, unknown>): Promise<void> {
  const text = buildPaymentReviewText(alert);
  const hasTelegram =
    Boolean(String(process.env.SHOP_TELEGRAM_BOT_TOKEN || "").trim()) &&
    Boolean(String(process.env.SHOP_TELEGRAM_CHAT_ID || "").trim());
  const hasWebhook = Boolean(String(process.env.SHOP_PAYMENT_ALERT_WEBHOOK || "").trim());

  if (!hasTelegram && !hasWebhook) {
    console.log("[payment-review-alert]", text.replace(/\n/g, " | "));
    return;
  }

  const errors: string[] = [];
  if (hasTelegram) {
    try {
      await notifyTelegramPaymentReview(text);
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  }
  if (hasWebhook) {
    try {
      await notifyWebhookPaymentReview(text, alert);
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
}
