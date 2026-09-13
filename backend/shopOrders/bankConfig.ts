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
  const ttlMin = Number(process.env.SHOP_TRANSFER_TTL_MIN || 30);
  return {
    bin,
    accountNumber,
    accountName,
    bankName,
    ttlMin: Number.isFinite(ttlMin) && ttlMin > 0 ? Math.floor(ttlMin) : 30,
    configured: Boolean(bin && accountNumber && accountName),
  };
}

export function buildVietQrImageUrl(opts: {
  amount: number;
  addInfo: string;
  accountName?: string;
}): string | null {
  const cfg = getShopBankConfig();
  if (!cfg.configured) return null;
  const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
  const addInfo = encodeURIComponent(String(opts.addInfo || "").trim().slice(0, 25));
  const name = encodeURIComponent(
    String(opts.accountName || cfg.accountName || "").trim().slice(0, 50)
  );
  return `https://img.vietqr.io/image/${cfg.bin}-${cfg.accountNumber}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`;
}

/**
 * QR thanh toán đơn shop.
 * Có HĐ KV → nội dung CK = mã HĐ (HD…) giống QR trên KiotViet → webhook invoice.update.
 * Chưa có HĐ → fallback nội dung ALH… (paymentCode).
 */
export function shopPaymentQrForOrder(order: {
  total?: number;
  totalPayment?: number;
  paymentCode?: string;
  kvInvoiceCode?: string | null;
  kvInvoiceId?: number | string | null;
}) {
  const amount = Number(order.totalPayment ?? order.total) || 0;
  const kvInvoiceCode = String(order.kvInvoiceCode || "").trim();
  const paymentCode = String(order.paymentCode || "").trim();
  const addInfo = kvInvoiceCode || paymentCode;
  const qrKind: "kiotviet" | "vietqr" = kvInvoiceCode ? "kiotviet" : "vietqr";
  const qrUrl = addInfo ? buildVietQrImageUrl({ amount, addInfo }) : null;
  const bank = getShopBankConfig();
  return {
    qrUrl,
    bank,
    amount,
    addInfo,
    qrKind,
    kvInvoiceCode: kvInvoiceCode || null,
    paymentCode: paymentCode || null,
  };
}
