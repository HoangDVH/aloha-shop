const crypto = require('crypto');
const config = require('./config');
const { getPrivatePaymentToken } = require('./auth');

const PAYMENT_API_BASE = 'https://payment.kiotviet.vn/api-sdk/v1.0.0';

/**
 * Gọi API nội bộ của KiotViet Payment SDK để sinh mã QR kèm mã định danh KOVQR
 * @param {Object} params
 * @param {number} params.amount - Số tiền thanh toán (VND)
 * @param {string} params.content - Nội dung chuyển khoản (VD: "bill HD022010")
 * @param {string} [params.branchId] - ID chi nhánh (mặc định lấy từ config)
 * @param {string} [params.merchantId] - ID gian hàng (mặc định lấy từ config)
 * @param {string} [params.paymentCode] - Mã ngân hàng, VD: "VCB"
 * @param {string} [params.paymentId] - STK hoặc Payment ID của KiotViet
 * @param {string} [customToken] - Token tùy chọn nếu muốn truyền thủ công
 */
async function generateKiotVietPaymentQr(params, customToken) {
  let token = customToken || (await getPrivatePaymentToken());

  const merchantId = params.merchantId || config.merchantId;
  const branchId = params.branchId || config.branchId;
  const paymentId = params.paymentId || config.paymentId;
  const paymentCode = params.paymentCode || config.paymentCode;
  const merchantCode = params.merchantCode || 'retail';
  const uuid = params.uuid || crypto.randomUUID();

  const payload = {
    amount: Math.round(Number(params.amount) || 0),
    branch_id: String(branchId),
    content: String(params.content || '').trim(),
    merchant_code: merchantCode,
    merchant_id: String(merchantId),
    payment_code: paymentCode,
    payment_id: String(paymentId),
    uuid: uuid,
  };

  const doRequest = async (authToken) => {
    return await fetch(`${PAYMENT_API_BASE}/generate-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });
  };

  let response = await doRequest(token);

  // Nếu token trong cache hết hạn bất ngờ (401), tự động ép bot login lại 1 lần
  if (response.status === 401 && !customToken) {
    console.warn('[getPrivateTokenKV] Token hết hạn (401). Đang tự động làm mới token...');
    token = await getPrivatePaymentToken(true);
    response = await doRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `[getPrivateTokenKV] Lỗi sinh mã QR từ payment.kiotviet.vn (HTTP ${response.status}): ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Kiểm tra trạng thái thanh toán của mã QR đã tạo qua QR ID
 * @param {string|number} qrId
 * @param {string} [customToken]
 */
async function checkKiotVietTransactionStatus(qrId, customToken) {
  const token = customToken || (await getPrivatePaymentToken());

  const response = await fetch(`${PAYMENT_API_BASE}/transaction-status?qrId=${encodeURIComponent(String(qrId))}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`[getPrivateTokenKV] Lỗi kiểm tra trạng thái QR (HTTP ${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * Lưu liên kết (mapping) giữa mã phiên QR và Hóa đơn KiotViet
 * Để khi tiền về tài khoản ngân hàng, KiotViet tự động gạch nợ hóa đơn tương ứng
 */
async function saveDynamicPaymentCode(params, customToken) {
  let token = customToken || (await getPrivatePaymentToken());
  const retailer = config.retailer || 'alohanguyen';
  const branchId = params.branchId || config.branchId || 24862;
  const merchantId = params.merchantId || config.merchantId || 906762;
  const bankAccountId = params.bankAccountId || config.bankAccountId || 20069; // STK 9931101233 (KV_BANK_ACCOUNT_ID)

  const payload = {
    Type: 1,
    RetailerId: Number(merchantId),
    BranchId: Number(branchId),
    BankAccountId: Number(bankAccountId),
    TransactionId: Number(params.transactionId),
    KovCode: String(params.kovCode || '').trim(),
    DocumentId: Number(params.documentId), // ID hóa đơn KiotViet
    DocumentType: 1,
    Amount: Math.round(Number(params.amount) || 0),
    Description: String(params.description || `${params.kovCode} bill ${params.invoiceCode || ''}`).trim()
  };

  const doRequest = async (authToken) => {
    return await fetch('https://api-man1.kiotviet.vn/api/qr-payment/save-dynamic-code', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'BranchId': String(branchId),
        'Retailer': retailer,
        'X-RETAILER-CODE': retailer,
        'X-GROUP-ID': '30',
        'IsUseKvClient': '1',
        'Referer': `https://${retailer}.kiotviet.vn/`
      },
      body: JSON.stringify(payload)
    });
  };

  let response = await doRequest(token);
  if (response.status === 401 && !customToken) {
    token = await getPrivatePaymentToken(true);
    response = await doRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn(`[getPrivateTokenKV] Cảnh báo lưu dynamic code (HTTP ${response.status}): ${errorText}`);
    return null;
  }

  return await response.json();
}

module.exports = {
  generateKiotVietPaymentQr,
  checkKiotVietTransactionStatus,
  saveDynamicPaymentCode,
};

