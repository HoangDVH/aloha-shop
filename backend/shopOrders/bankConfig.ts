import { SHOP_ORDERS } from "./models.js";

export type ShopBankPublicConfig = {
  bin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  ttlMin: number;
  configured: boolean;
};

export function getShopBankConfig(): ShopBankPublicConfig {
  const bin = String(process.env.SHOP_BANK_BIN || "").trim();
  const accountNumber = String(process.env.SHOP_BANK_ACCOUNT || "").trim();
  const accountName = String(process.env.SHOP_BANK_ACCOUNT_NAME || "").trim();
  const bankName = String(process.env.SHOP_BANK_NAME || "").trim() || "Ngân hàng";
  const ttlMin = Number(process.env.SHOP_TRANSFER_TTL_MIN || 10);
  return {
    bin,
    accountNumber,
    accountName,
    bankName,
    ttlMin: Number.isFinite(ttlMin) && ttlMin > 0 ? Math.floor(ttlMin) : 10,
    configured: Boolean(bin && accountNumber && accountName),
  };
}

export function buildVietQrImageUrl(opts: {
  amount: number;
  addInfo: string;
  accountName?: string;
  template?: "compact2" | "compact" | "qr_only";
}): string | null {
  const cfg = getShopBankConfig();
  if (!cfg.configured) return null;
  const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
  const addInfo = encodeURIComponent(String(opts.addInfo || "").trim().slice(0, 30));
  const name = encodeURIComponent(
    String(opts.accountName || cfg.accountName || "").trim().slice(0, 50)
  );
  const template = opts.template || "compact";
  return `https://img.vietqr.io/image/${cfg.bin}-${cfg.accountNumber}-${template}.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`;
}

let cachedKvPaymentId: string | null = null;
export function getKvPaymentId(): string {
  if (cachedKvPaymentId) return cachedKvPaymentId;
  const envVal = String(process.env.KV_PAYMENT_ID || "").trim();
  if (envVal) {
    cachedKvPaymentId = envVal;
    return cachedKvPaymentId;
  }
  try {
    const fs = require("fs");
    const path = require("path");
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(__dirname, "../../.env"),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        const match = content.match(/^KV_PAYMENT_ID\s*=\s*(.+)$/m);
        if (match && match[1]) {
          cachedKvPaymentId = match[1].trim();
          return cachedKvPaymentId;
        }
      }
    }
  } catch {}
  cachedKvPaymentId = "9931101233";
  return cachedKvPaymentId;
}

/**
 * QR thanh toán đơn shop (phiên bản đồng bộ / fallback).
 */
export function shopPaymentQrForOrder(order: {
  total?: number;
  totalPayment?: number;
  paymentCode?: string;
  kvInvoiceCode?: string | null;
  kvInvoiceId?: number | string | null;
  expiresAt?: string | null;
  kiotvietQr?: {
    kovCode?: string;
    qrUrl?: string;
    qrString?: string;
    transferContent?: string;
    amount?: number;
    accountNumber?: string;
    expiresAt?: string;
  } | null;
}) {
  const amount = Number(order.totalPayment ?? order.total) || 0;
  const kvInvoiceCode = String(order.kvInvoiceCode || "").trim();
  const paymentCode = String(order.paymentCode || "").trim();
  const currentPaymentId = getKvPaymentId();

  // Kiểm tra hạn sống của QR
  const expTime = order.kiotvietQr?.expiresAt
    ? new Date(order.kiotvietQr.expiresAt).getTime()
    : (order.expiresAt ? new Date(order.expiresAt).getTime() : 0);
  const isNotExpired = !expTime || expTime > Date.now();

  // Nếu trong order đã có kiotvietQr được cache từ trước, còn hạn và cùng STK hiện tại -> dùng lại luôn
  if (
    order.kiotvietQr &&
    order.kiotvietQr.qrUrl &&
    Number(order.kiotvietQr.amount) === amount &&
    (!order.kiotvietQr.accountNumber || order.kiotvietQr.accountNumber === currentPaymentId) &&
    isNotExpired
  ) {
    const kvBank: ShopBankPublicConfig = {
      bin: "970436",
      accountNumber: currentPaymentId,
      accountName: String(process.env.SHOP_BANK_ACCOUNT_NAME || "NGUYEN VAN XUAN").trim(),
      bankName: "Vietcombank",
      ttlMin: Number(process.env.SHOP_TRANSFER_TTL_MIN || 15),
      configured: true,
    };
    return {
      qrUrl: order.kiotvietQr.qrUrl,
      bank: kvBank,
      amount,
      addInfo: order.kiotvietQr.transferContent || `${order.kiotvietQr.kovCode || ""} bill ${kvInvoiceCode}`.trim(),
      qrKind: "kiotviet" as const,
      kvInvoiceCode: kvInvoiceCode || null,
      paymentCode: paymentCode || null,
      kovCode: order.kiotvietQr.kovCode || null,
      qrString: order.kiotvietQr.qrString || null,
    };
  }

  const addInfo = kvInvoiceCode || paymentCode;
  const qrKind: "kiotviet" | "vietqr" = kvInvoiceCode ? "kiotviet" : "vietqr";
  const qrUrl = addInfo ? buildVietQrImageUrl({ amount, addInfo, template: "compact" }) : null;
  const bank = getShopBankConfig();
  return {
    qrUrl,
    bank,
    amount,
    addInfo,
    qrKind,
    kvInvoiceCode: kvInvoiceCode || null,
    paymentCode: paymentCode || null,
    kovCode: null as string | null,
    qrString: null as string | null,
  };
}

/**
 * QR thanh toán đơn shop (phiên bản bất đồng bộ - Tự động gọi KiotViet POS SDK sinh KOV Code).
 */
export async function resolveShopPaymentQrForOrder(
  order: {
    _id?: any;
    code?: string;
    total?: number;
    totalPayment?: number;
    paymentCode?: string;
    kvInvoiceCode?: string | null;
    kvInvoiceId?: number | string | null;
    expiresAt?: string | null;
    kiotvietQr?: {
      kovCode?: string;
      qrUrl?: string;
      qrString?: string;
      transferContent?: string;
      amount?: number;
      accountNumber?: string;
      expiresAt?: string;
    } | null;
  },
  shopDb?: any
) {
  const amount = Number(order.totalPayment ?? order.total) || 0;
  const kvInvoiceCode = String(order.kvInvoiceCode || "").trim();
  const paymentCode = String(order.paymentCode || "").trim();
  const currentPaymentId = getKvPaymentId();

  // 1. Nếu có HĐ KiotViet: Thử sinh mã QR qua KiotViet POS SDK (kèm KOV Code để KiotViet tự động gạch nợ)
  if (kvInvoiceCode) {
    const expTime = order.kiotvietQr?.expiresAt
      ? new Date(order.kiotvietQr.expiresAt).getTime()
      : (order.expiresAt ? new Date(order.expiresAt).getTime() : 0);
    const isNotExpired = !expTime || expTime > Date.now();

    // 1a. Kiểm tra nếu đã cache trong order, cùng số tiền, cùng STK VÀ còn hạn -> DÙNG LẠI NGAY LẬP TỨC
    if (
      order.kiotvietQr &&
      order.kiotvietQr.qrUrl &&
      order.kiotvietQr.kovCode &&
      Number(order.kiotvietQr.amount) === amount &&
      order.kiotvietQr.accountNumber === currentPaymentId &&
      isNotExpired
    ) {
      const kvBank: ShopBankPublicConfig = {
        bin: "970436",
        accountNumber: currentPaymentId,
        accountName: String(process.env.SHOP_BANK_ACCOUNT_NAME || "NGUYEN VAN XUAN").trim(),
        bankName: "Vietcombank",
        ttlMin: Number(process.env.SHOP_TRANSFER_TTL_MIN || 15),
        configured: true,
      };
      return {
        qrUrl: order.kiotvietQr.qrUrl,
        bank: kvBank,
        amount,
        addInfo: order.kiotvietQr.transferContent || `${order.kiotvietQr.kovCode} bill ${kvInvoiceCode}`,
        qrKind: "kiotviet" as const,
        kvInvoiceCode,
        paymentCode: paymentCode || null,
        kovCode: order.kiotvietQr.kovCode,
        qrString: order.kiotvietQr.qrString || null,
      };
    }

    // 1b. Chưa có cache hoặc QR cũ đã hết hạn -> Gọi KiotViet POS SDK sinh 1 lần
    try {
      // Import module getPrivateTokenKV linh hoạt mọi môi trường
      const path = require("path");
      const fs = require("fs");
      const candidates = [
        path.resolve(process.cwd(), "getPrivateTokenKV"),
        path.resolve(__dirname, "../../getPrivateTokenKV"),
        path.resolve(__dirname, "../getPrivateTokenKV"),
      ];
      let kvModule = null;
      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) {
            kvModule = require(p);
            break;
          }
        } catch {
          /* ignore */
        }
      }
      if (!kvModule) kvModule = require("../../getPrivateTokenKV");

      const { generateKiotVietPaymentQr } = kvModule;
      const kvRes = await generateKiotVietPaymentQr({
        amount,
        content: `bill ${kvInvoiceCode}`,
        paymentId: currentPaymentId,
        paymentCode: String(process.env.KV_PAYMENT_CODE || "VCB").trim(),
      });

      if (kvRes && kvRes.body && (kvRes.body.image || kvRes.body.qr_string)) {
        const kovCode = String(kvRes.body.kov_code || "").trim();
        const qrUrl = String(kvRes.body.image || "");
        const qrString = String(kvRes.body.qr_string || "");
        const transferContent = kovCode ? `${kovCode} bill ${kvInvoiceCode}` : `bill ${kvInvoiceCode}`;

        // Lưu liên kết mã QR với hóa đơn KiotViet (save-dynamic-code) để KiotViet tự động gạch nợ khi tiền về
        const transactionId = kvRes.body.transaction_id;
        const invId = order.kvInvoiceId;
        if (transactionId && invId && typeof kvModule.saveDynamicPaymentCode === "function") {
          try {
            await kvModule.saveDynamicPaymentCode({
              transactionId,
              kovCode,
              documentId: invId,
              invoiceCode: kvInvoiceCode,
              amount,
              description: transferContent,
            });
            console.log("[bankConfig] Đã liên kết mã QR động với hóa đơn KV:", kvInvoiceCode, { transactionId, kovCode, invId });
          } catch (err: any) {
            console.warn("[bankConfig] Lỗi lưu liên kết QR với hóa đơn KV:", err?.message || err);
          }
        }

        const kvBank: ShopBankPublicConfig = {
          bin: "970436",
          accountNumber: currentPaymentId,
          accountName: String(process.env.SHOP_BANK_ACCOUNT_NAME || "NGUYEN VAN XUAN").trim(),
          bankName: "Vietcombank",
          ttlMin: Number(process.env.SHOP_TRANSFER_TTL_MIN || 15),
          configured: true,
        };

        const kiotvietQr = {
          kovCode,
          qrUrl,
          qrString,
          transferContent,
          amount,
          accountNumber: currentPaymentId,
          expiresAt: new Date(Date.now() + 14 * 60 * 1000).toISOString(), // KiotViet QR session ~15 phút, đặt 14p để tự refresh trước khi chết
          createdAt: new Date().toISOString(),
        };

        // Lưu vào order in-memory để các lần gọi tiếp theo trong cùng tick dùng lại luôn
        (order as any).kiotvietQr = kiotvietQr;

        // Lưu cố định vào DB (bảng aloha_shop_orders) để các lần poll 3s-5s tiếp theo KHÔNG sinh lại QR
        if (shopDb && (order._id || order.code)) {
          try {
            const query = order._id ? { _id: order._id } : { code: order.code };
            await shopDb.collection(SHOP_ORDERS).updateOne(
              query,
              { $set: { kiotvietQr } }
            );
          } catch (dbErr: any) {
            console.warn("[resolveShopPaymentQrForOrder] Lỗi lưu cache kiotvietQr vào DB:", dbErr?.message);
          }
        }

        return {
          qrUrl,
          bank: kvBank,
          amount,
          addInfo: transferContent,
          qrKind: "kiotviet" as const,
          kvInvoiceCode,
          paymentCode: paymentCode || null,
          kovCode,
          qrString,
        };
      }
    } catch (err: any) {
      console.warn("[resolveShopPaymentQrForOrder] Không thể sinh mã KiotViet POS QR, fallback sang VietQR:", err?.message);
    }
  }

  // 2. Fallback sang VietQR thông thường
  return shopPaymentQrForOrder(order);
}
