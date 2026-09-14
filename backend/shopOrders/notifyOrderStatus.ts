/**
 * Thông báo trạng thái đơn shop (email Resend).
 * Chỉ gọi với document aloha_shop_orders — không mail đơn KV thuần.
 * Mẫu HTML kiểu sàn TMĐT: mã đơn, sản phẩm, tổng tiền, địa chỉ, thanh toán.
 */
import type { Db } from "mongodb";
import { fullAddressForKv } from "./orderRouteShared.js";

export type ShopNotifyEvent =
  | "dat_hang"
  | "dang_giao"
  | "giao_thanh_cong"
  | "huy_hoan";

const COL_SENT = "aloha_shop_order_notify_sent";
const BRAND = "ALOHA Thế giới chậu cây";
const SHOP_URL =
  String(process.env.SHOP_PUBLIC_URL || "").trim() ||
  "https://shop.alohathegioichaucay.com";

function shopMailEnabled(): boolean {
  const v = String(process.env.SHOP_MAIL_ENABLED || "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function mailProvider(): string {
  return String(process.env.SHOP_MAIL_PROVIDER || "resend")
    .trim()
    .toLowerCase();
}

function resendKey(): string {
  return String(process.env.RESEND_API_KEY || "").trim();
}

function mailFrom(): string {
  return (
    String(process.env.SHOP_MAIL_FROM || "").trim() ||
    `${BRAND} <donhang@donhang.alohathegioichaucay.com>`
  );
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EventCopy = {
  subject: string;
  badge: string;
  badgeBg: string;
  title: string;
  lead: string;
};

function eventCopy(event: ShopNotifyEvent, code: string): EventCopy {
  switch (event) {
    case "dat_hang":
      return {
        subject: `[${BRAND}] Đặt hàng thành công — ${code}`,
        badge: "Đã đặt hàng",
        badgeBg: "#16a34a",
        title: "Cảm ơn bạn đã đặt hàng!",
        lead: "Chúng tôi đã nhận đơn và sẽ sớm liên hệ / chuẩn bị giao hàng.",
      };
    case "dang_giao":
      return {
        subject: `[${BRAND}] Đơn ${code} đang giao hàng`,
        badge: "Đang giao",
        badgeBg: "#2563eb",
        title: "Đơn hàng của bạn đang được giao",
        lead: "Shipper đang mang hàng đến địa chỉ nhận. Vui lòng giữ điện thoại.",
      };
    case "giao_thanh_cong":
      return {
        subject: `[${BRAND}] Giao thành công — ${code}`,
        badge: "Giao thành công",
        badgeBg: "#16a34a",
        title: "Đơn hàng đã giao thành công",
        lead: "Cảm ơn bạn đã mua hàng tại ALOHA. Chúc bạn hài lòng với sản phẩm!",
      };
    case "huy_hoan":
      return {
        subject: `[${BRAND}] Đơn ${code} đã hủy / chuyển hoàn`,
        badge: "Đã hủy / hoàn",
        badgeBg: "#dc2626",
        title: "Đơn hàng đã được hủy hoặc chuyển hoàn",
        lead: "Nếu bạn cần hỗ trợ hoặc đặt lại, vui lòng liên hệ cửa hàng.",
      };
  }
}

function paymentLabel(order: Record<string, unknown>): string {
  const method = String(order.method || "").toLowerCase();
  if (order.usingCod === true || method === "cod" || order.paymentStatus === "cod") {
    return "Thanh toán khi nhận hàng (COD)";
  }
  if (method === "transfer" || method === "ck") return "Chuyển khoản ngân hàng";
  return method ? method.toUpperCase() : "—";
}

function formatItemsRows(order: Record<string, unknown>): string {
  const raw = order.orderDetails;
  if (!Array.isArray(raw) || raw.length === 0) {
    return `<tr><td colspan="3" style="padding:12px;color:#6b7280;font-size:14px;">Không có chi tiết sản phẩm</td></tr>`;
  }
  return raw
    .map((line: any) => {
      const name = escapeHtml(String(line?.productName || line?.productCode || "Sản phẩm"));
      const qty = Number(line?.quantity) || 0;
      const price = Number(line?.price) || 0;
      const lineTotal = price * qty;
      return `<tr>
  <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;">${name}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:center;white-space:nowrap;">x${qty}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;text-align:right;white-space:nowrap;font-weight:600;">${money(lineTotal)}</td>
</tr>`;
    })
    .join("");
}

function eventBodyHtml(event: ShopNotifyEvent, order: Record<string, unknown>): string {
  const code = String(order.code || order.id || "");
  const name = String(order.customerName || "Quý khách");
  const phone = String(order.customerPhone || "").trim();
  const subtotal = Number(order.subtotal ?? 0);
  const shippingFee = Number(order.shippingFee ?? 0);
  const total = Number(order.total ?? order.totalPayment ?? 0);
  const address = fullAddressForKv({
    deliveryMethod: String(order.deliveryMethod || ""),
    shippingAddress: String(order.shippingAddress || ""),
    ward: String(order.ward || ""),
    district: String(order.district || ""),
    province: String(order.province || ""),
  });
  const copy = eventCopy(event, code);
  const pay = paymentLabel(order);
  const orderUrl = `${SHOP_URL.replace(/\/$/, "")}/don-hang/${encodeURIComponent(code)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#14532d;padding:20px 24px;">
            <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">${escapeHtml(BRAND)}</div>
            <div style="margin-top:8px;">
              <span style="display:inline-block;background:${copy.badgeBg};color:#fff;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;">${escapeHtml(copy.badge)}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">Xin chào <strong style="color:#111827;">${escapeHtml(name)}</strong>,</p>
            <h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;color:#111827;font-weight:700;">${escapeHtml(copy.title)}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#6b7280;">${escapeHtml(copy.lead)}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Mã đơn hàng</div>
                  <div style="margin-top:4px;font-size:18px;font-weight:700;color:#14532d;letter-spacing:0.03em;">${escapeHtml(code)}</div>
                </td>
              </tr>
            </table>

            <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:8px;">Sản phẩm</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-top:1px solid #e5e7eb;">
              ${formatItemsRows(order)}
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#6b7280;">Tạm tính</td>
                <td style="padding:4px 0;font-size:14px;color:#111827;text-align:right;">${money(subtotal || total)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#6b7280;">Phí vận chuyển</td>
                <td style="padding:4px 0;font-size:14px;color:#111827;text-align:right;">${shippingFee > 0 ? money(shippingFee) : "Miễn phí / tính sau"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">Tổng thanh toán</td>
                <td style="padding:10px 0 0;font-size:16px;font-weight:700;color:#14532d;text-align:right;border-top:1px solid #e5e7eb;">${money(total)}</td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Thanh toán</div>
                  <div style="font-size:14px;color:#111827;font-weight:600;margin-bottom:12px;">${escapeHtml(pay)}</div>
                  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Giao đến</div>
                  <div style="font-size:14px;color:#111827;line-height:1.45;">${escapeHtml(address || "—")}${phone ? `<br/><span style="color:#6b7280;">SĐT: ${escapeHtml(phone)}</span>` : ""}</div>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr>
                <td style="border-radius:8px;background:#14532d;">
                  <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Xem đơn hàng</a>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.4;">Nếu nút không mở được, truy cập:<br/><a href="${escapeHtml(orderUrl)}" style="color:#14532d;">${escapeHtml(orderUrl)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px;border-top:1px solid #f3f4f6;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">
              Email này gửi tự động từ ${escapeHtml(BRAND)}.<br/>
              Vui lòng không trả lời email này.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function alreadySent(
  shopDb: Db,
  orderCode: string,
  event: ShopNotifyEvent
): Promise<boolean> {
  const hit = await shopDb.collection(COL_SENT).findOne({ orderCode, event });
  return Boolean(hit);
}

async function markSent(
  shopDb: Db,
  orderCode: string,
  event: ShopNotifyEvent,
  meta: Record<string, unknown>
): Promise<void> {
  await shopDb.collection(COL_SENT).updateOne(
    { orderCode, event },
    {
      $set: {
        orderCode,
        event,
        ...meta,
        at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = resendKey();
  if (!key) return { ok: false, error: "missing_resend_key" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.message || `http_${res.status}` };
  }
  return { ok: true, id: data.id };
}

/**
 * Gửi notify cho đơn shop. Idempotent theo (orderCode, event).
 * Không có email / chưa cấu hình mail → log skip, không chặn nghiệp vụ.
 */
export async function notifyOrderStatus(
  shopDb: Db,
  order: Record<string, unknown>,
  event: ShopNotifyEvent
): Promise<{ sent: boolean; skipped?: string }> {
  if (!shopMailEnabled()) {
    return { sent: false, skipped: "mail_disabled" };
  }

  const code = String(order.code || order.id || "").trim();
  if (!code || !code.toUpperCase().startsWith("WEB")) {
    return { sent: false, skipped: "not_shop_web_order" };
  }
  const source = String(order.source || "shop_web");
  if (source && source !== "shop_web") {
    return { sent: false, skipped: "wrong_source" };
  }

  if (await alreadySent(shopDb, code, event)) {
    return { sent: false, skipped: "already_sent" };
  }

  const email = String(order.customerEmail || "").trim();
  if (!email || !email.includes("@")) {
    await markSent(shopDb, code, event, { status: "skipped_no_email" });
    console.log("[shop-notify] skip no email", code, event);
    return { sent: false, skipped: "no_email" };
  }

  if (mailProvider() === "resend") {
    if (!resendKey()) {
      await markSent(shopDb, code, event, { status: "skipped_no_key" });
      console.log("[shop-notify] skip no RESEND_API_KEY", code, event);
      return { sent: false, skipped: "no_key" };
    }
    const copy = eventCopy(event, code);
    const r = await sendResendEmail({
      to: email,
      subject: copy.subject,
      html: eventBodyHtml(event, order),
    });
    if (!r.ok) {
      console.warn("[shop-notify] send fail", code, event, r.error);
      return { sent: false, skipped: r.error || "send_fail" };
    }
    await markSent(shopDb, code, event, {
      status: "sent",
      provider: "resend",
      messageId: r.id || null,
      to: email,
    });
    return { sent: true };
  }

  await markSent(shopDb, code, event, { status: "skipped_unknown_provider" });
  return { sent: false, skipped: "unknown_provider" };
}
