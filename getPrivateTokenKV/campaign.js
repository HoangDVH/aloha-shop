const config = require('./config');
const { getPrivatePaymentToken } = require('./auth');

const PROMOTION_API_BASE = 'https://api-promotion1.kiotviet.vn/api';
const MAN_API_BASE = 'https://api-man1.kiotviet.vn/api';

/**
 * Tra cứu thông tin sản phẩm theo Mã sản phẩm (Code) từ API KiotViet
 * @param {string} productCode - Mã sản phẩm (VD: "TPKNB", "TNM2L")
 * @param {string} [customToken]
 * @returns {Promise<{ Id: number, Code: string, Name: string, Price: number } | null>}
 */
async function getProductByCode(productCode, customToken) {
  let token = customToken || (await getPrivatePaymentToken());
  const retailer = config.retailer || 'alohanguyen';
  const branchId = config.branchId || '24862';

  const doRequest = async (authToken) => {
    // API KiotViet tìm kiếm sản phẩm bằng tham số keyword với top=50 để tránh sót
    const cleanCode = String(productCode).trim();
    const url = `${MAN_API_BASE}/products?format=json&IncludeQuantity=true&keyword=${encodeURIComponent(cleanCode)}&$top=50`;
    return await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'BranchId': String(branchId),
        'Retailer': retailer,
        'X-RETAILER-CODE': retailer,
        'X-GROUP-ID': '30',
        'IsUseKvClient': '1',
        'Accept': 'application/json, text/plain, */*',
        'Origin': `https://${retailer}.kiotviet.vn`,
        'Referer': `https://${retailer}.kiotviet.vn/`,
      }
    });
  };

  let response = await doRequest(token);
  if (response.status === 401 && !customToken) {
    token = await getPrivatePaymentToken(true);
    response = await doRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[getPrivateTokenKV] Lỗi tìm sản phẩm ${productCode} (HTTP ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const list = result.Data || [];
  const cleanTargetCode = String(productCode).trim().toLowerCase();
  
  // So khớp chính xác tuyệt đối 100% theo Mã sản phẩm (Code)
  const found = list.find((p) => String(p.Code || '').trim().toLowerCase() === cleanTargetCode);

  if (!found) {
    return null;
  }

  return {
    Id: found.Id,
    Code: found.Code,
    Name: found.FullName || found.Name,
    Price: found.BasePrice || found.Price || 0,
    CategoryId: found.CategoryId,
    Unit: found.Unit,
    MasterProductId: found.MasterProductId || found.Id
  };
}

/**
 * Tạo chương trình khuyến mại "Hàng hóa - Giá bán theo số lượng mua" cho 1 sản phẩm
 * @param {Object} params
 * @param {string} params.productCode - Mã sản phẩm (Bắt buộc)
 * @param {number} [params.productId] - ID sản phẩm (nếu đã có sẵn, không cần gọi query tìm)
 * @param {string} [params.productName] - Tên sản phẩm (tùy chọn)
 * @param {string} [params.campaignName] - Tên CTKM (mặc định: "KM cây thành phẩm {productCode}")
 * @param {Array<{ minQuantity: number, discountRatio: number }>} [params.discounts] - Các bậc giảm giá (mặc định: mua >=1 giảm 20%, mua >=10 giảm 30%)
 * @param {string|Date} [params.startDate] - Ngày bắt đầu (mặc định: thời điểm hiện tại)
 * @param {string|Date} [params.endDate] - Ngày kết thúc (mặc định: 6 tháng sau)
 * @param {string} [customToken]
 */
async function createPromotionForProduct(params, customToken) {
  const { productCode } = params;
  if (!productCode) {
    throw new Error('[getPrivateTokenKV] Vui lòng truyền productCode (Mã sản phẩm).');
  }

  let token = customToken || (await getPrivatePaymentToken());
  const retailer = config.retailer || 'alohanguyen';
  const branchId = config.branchId || '24862';
  const merchantId = Number(config.merchantId || 906762);

  // 1. Xác định ProductId nếu chưa truyền vào
  let productId = params.productId;
  let productName = params.productName;
  if (!productId) {
    console.log(`[getPrivateTokenKV] Đang tra cứu Product ID cho mã: ${productCode}...`);
    const productInfo = await getProductByCode(productCode, token);
    if (!productInfo) {
      throw new Error(`[getPrivateTokenKV] Không tìm thấy sản phẩm có mã "${productCode}" trên KiotViet.`);
    }
    productId = productInfo.Id;
    productName = productName || productInfo.Name;
  }

  // 2. Cấu hình các bậc chiết khấu (Mặc định: mua >=1 giảm 20%, mua >=10 giảm 30%)
  const discounts = params.discounts || [
    { minQuantity: 1, discountRatio: 20 },
    { minQuantity: 10, discountRatio: 30 }
  ];

  const campaignName = params.campaignName || `KM cây thành phẩm ${String(productCode).trim()}`;
  const now = new Date();
  const startDate = params.startDate ? new Date(params.startDate).toISOString() : now.toISOString();
  const endDate = params.endDate
    ? new Date(params.endDate).toISOString()
    : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(); // +180 ngày

  // 3. Xây dựng cấu trúc SalePromotions
  const salePromotions = discounts.map((item) => ({
    Type: 1,
    PromotionType: 8, // Loại 8: Hàng hóa - Giá bán theo số lượng mua
    InvoiceValue: 0,
    PrereqProductId: Number(productId),
    PrereqProductIds: String(productId),
    PrereqProductCodes: String(productCode).trim(),
    PrereqQuantity: Number(item.minQuantity || 1),
    PrereqApplySameKind: false,
    ProductPrice: null,
    ProductDiscount: null,
    ProductDiscountRatio: Number(item.discountRatio || 0),
    RetailerId: merchantId
  }));

  // 4. Payload tạo Campaign chuẩn
  const payload = {
    Campaign: {
      Id: 0,
      Name: campaignName,
      IsActive: true,
      IsGlobal: true,
      ForAllUser: true,
      ForAllCusGroup: true,
      Type: 1,
      PromotionType: 8,
      StartDate: startDate,
      EndDate: endDate,
      RetailerId: merchantId,
      BirthdayTimeType: 1,
      LimitPromotionUsageType: 2,
      LimitPromotionUsage: false,
      IsFixedQuantity: false,
      ApplyMonths: '',
      ApplyDates: '',
      Weekday: '',
      Hour: '',
      SalePromotions: salePromotions,
      CampaignBranches: [],
      CampaignUsers: [],
      CampainCustomerGroups: []
    }
  };

  const doRequest = async (authToken) => {
    return await fetch(`${PROMOTION_API_BASE}/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'BranchId': String(branchId),
        'Retailer': retailer,
        'X-RETAILER-CODE': retailer,
        'X-GROUP-ID': '30',
        'IsUseKvClient': '1',
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': `https://${retailer}.kiotviet.vn`,
        'Referer': `https://${retailer}.kiotviet.vn/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });
  };

  let response = await doRequest(token);

  // Auto retry refresh token nếu 401
  if (response.status === 401 && !customToken) {
    console.warn('[getPrivateTokenKV] Token hết hạn (401). Đang tự động làm mới token...');
    token = await getPrivatePaymentToken(true);
    response = await doRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[getPrivateTokenKV] Lỗi tạo khuyến mãi cho SP ${productCode} (HTTP ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return {
    success: true,
    campaignId: result.Id,
    campaignCode: result.Code,
    campaignName: result.Name,
    productCode: productCode,
    productId: productId,
    raw: result
  };
}

/**
 * Lấy danh sách toàn bộ sản phẩm theo danh sách CategoryIds (Ví dụ 10 nhóm con của Cây thành phẩm)
 * @param {number[]} categoryIds - Mảng các ID danh mục
 * @param {string} [customToken]
 */
async function getProductsByCategoryIds(categoryIds, customToken) {
  let token = customToken || (await getPrivatePaymentToken());
  const retailer = config.retailer || 'alohanguyen';
  const branchId = config.branchId || '24862';

  const filter = categoryIds.map((id) => `CategoryId eq ${id}`).join(' or ');
  const url = `${MAN_API_BASE}/products?%24filter=(${encodeURIComponent(filter)})&%24top=500&format=json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'BranchId': String(branchId),
      'Retailer': retailer,
      'Accept': 'application/json, text/plain, */*'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[getPrivateTokenKV] Lỗi lấy danh sách sản phẩm theo danh mục (HTTP ${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const list = json.Data || [];
  return list.map((p) => ({
    productId: p.Id,
    productCode: p.Code,
    productName: p.FullName || p.Name,
    price: p.BasePrice || p.Price || 0,
    categoryId: p.CategoryId,
    unit: p.Unit
  }));
}

module.exports = {
  getProductByCode,
  createPromotionForProduct,
  getProductsByCategoryIds
};

