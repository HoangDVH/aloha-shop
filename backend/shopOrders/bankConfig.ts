import { SHOP_ORDERS } from "./models.js";

export type ShopBankPublicConfig = {
  bin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  ttlMin: number;
  configured: boolean;
};

/** Đọc 1 TLV EMVCo (ID 2 ký tự + length 2 số + value). */
function emvGet(payload: string, id: string): string | null {
  let i = 0;
  const s = String(payload || "");
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number.parseInt(s.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || len < 0 || i + 4 + len > s.length) return null;
    const val = s.slice(i + 4, i + 4 + len);
    if (tag === id) return val;
    i += 4 + len;
  }
  return null;
}

/** Lấy nội dung CK thật trong chuỗi VietQR (field 62 → 08) — khớp lời nhắn MoMo. */
export function extractVietQrAddInfo(qrString?: string | null): string | null {
  const raw = String(qrString || "").trim();
  if (!raw) return null;
  const f62 = emvGet(raw, "62");
  if (!f62) return null;
  const purpose = emvGet(f62, "08") || emvGet(f62, "01");
  const out = String(purpose || "").trim();
  return out || null;
}

/** Ghép nội dung CK chuẩn KiotQR (có mã KOV) — cùng format MoMo đọc từ QR.
 * Lưu ý: `kov_code` từ KV thường đã kèm hậu tố " V" (vd. "KOVQR… V").
 */
export function buildKiotTransferContent(
  kovCode?: string | null,
  kvInvoiceCode?: string | null
): string {
  const kov = String(kovCode || "").trim();
  const hd = String(kvInvoiceCode || "").trim();
  if (kov && hd) {
    // Tránh "… V V bill …" khi kov_code đã có sẵn chữ V
    if (/\bV$/i.test(kov)) return `${kov} bill ${hd}`;
    return `${kov} V bill ${hd}`;
  }
  if (kov) return /\bV$/i.test(kov) ? `${kov} bill` : `${kov} V bill`;
  return "";
}

/**
 * Ưu tiên: nội dung trong qr_string → transferContent đủ KOV → ghép kov+HD → HD/paymentCode.
 * Tránh cache cũ chỉ còn mã HĐ (HD…) trong khi QR thật vẫn chứa KOVQR…
 */
export function resolveTransferContent(opts: {
  transferContent?: string | null;
  kovCode?: string | null;
  kvInvoiceCode?: string | null;
  paymentCode?: string | null;
  qrString?: string | null;
}): string {
  const fromQr = extractVietQrAddInfo(opts.qrString);
  if (fromQr) return fromQr;

  const kov = String(opts.kovCode || "").trim();
  const hd = String(opts.kvInvoiceCode || "").trim();
  const stored = String(opts.transferContent || "").trim();
  const built = buildKiotTransferContent(kov, hd);

  // Cache/DB cũ có thể lưu nhầm chỉ "HD…" dù đã có kovCode; hoặc thiếu chữ V như MoMo
  if (stored) {
    const isBareInvoice = Boolean(hd && stored === hd);
    const hasKov = /KOVQR/i.test(stored) || (kov && stored.includes(kov));
    const hasBill = /\bbill\b/i.test(stored);
    if (!isBareInvoice && hasKov && hasBill) {
      if (built && stored !== built && !/\bV\s+bill\b/i.test(stored)) return built;
      return stored;
    }
    if (built) return built;
    if (!isBareInvoice) return stored;
  }

  if (built) return built;
  return hd || String(opts.paymentCode || "").trim();
}

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
  const addInfo = encodeURIComponent(String(opts.addInfo || "").trim().slice(0, 70));
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
    const kovCode = order.kiotvietQr.kovCode || null;
    const qrString = order.kiotvietQr.qrString || null;
    return {
      qrUrl: order.kiotvietQr.qrUrl,
      bank: kvBank,
      amount,
      addInfo: resolveTransferContent({
        transferContent: order.kiotvietQr.transferContent,
        kovCode,
        kvInvoiceCode,
        paymentCode,
        qrString,
      }),
      qrKind: "kiotviet" as const,
      kvInvoiceCode: kvInvoiceCode || null,
      paymentCode: paymentCode || null,
      kovCode,
      qrString,
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
      const kovCode = order.kiotvietQr.kovCode;
      const qrString = order.kiotvietQr.qrString || null;
      const addInfo = resolveTransferContent({
        transferContent: order.kiotvietQr.transferContent,
        kovCode,
        kvInvoiceCode,
        paymentCode,
        qrString,
      });
      // Sửa cache cũ lưu nhầm chỉ mã HD…
      if (
        shopDb &&
        addInfo &&
        String(order.kiotvietQr.transferContent || "").trim() !== addInfo
      ) {
        try {
          const query = order._id ? { _id: order._id } : { code: order.code };
          await shopDb.collection(SHOP_ORDERS).updateOne(query, {
            $set: { "kiotvietQr.transferContent": addInfo },
          });
          (order.kiotvietQr as any).transferContent = addInfo;
        } catch {
          /* ignore */
        }
      }
      return {
        qrUrl: order.kiotvietQr.qrUrl,
        bank: kvBank,
        amount,
        addInfo,
        qrKind: "kiotviet" as const,
        kvInvoiceCode,
        paymentCode: paymentCode || null,
        kovCode,
        qrString,
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
        const transferContent = resolveTransferContent({
          kovCode,
          kvInvoiceCode,
          qrString,
        });

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
