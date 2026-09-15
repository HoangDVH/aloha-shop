const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = require('./config');

const CACHE_FILE = path.resolve(__dirname, '.token_cache.json');

/**
 * Đọc token từ file cache nếu còn hiệu lực (chưa hết hạn)
 */
function getCachedToken() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      // Trừ hao 5 phút (300.000ms) trước khi hết hạn
      if (data.token && data.expiresAt > Date.now() + 300000) {
        return data.token;
      }
    }
  } catch {
    // Bỏ qua lỗi đọc file cache
  }
  return null;
}

/**
 * Lưu token vào cache file, tự động đọc thời hạn sống thực tế từ JWT token
 */
function saveTokenCache(token, fallbackSeconds = 86400 * 7) {
  try {
    let expiresAt = Date.now() + fallbackSeconds * 1000;
    
    // Tự động giải mã trường exp từ JWT để biết chính xác ngày hết hạn
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload.exp) {
          // Trừ hao 1 giờ trước khi hết hạn chính thức của KiotViet
          expiresAt = payload.exp * 1000 - 3600000;
        }
      }
    } catch {
      // Dùng fallback nếu không parse được JWT
    }

    const data = {
      token,
      expiresAt,
      updatedAt: new Date().toISOString(),
      expiresDate: new Date(expiresAt).toLocaleString('vi-VN')
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[getPrivateTokenKV] Không thể ghi file cache:', err.message);
  }
}

/**
 * Tự động mở trình duyệt ngầm Puppeteer để đăng nhập và bốc token kf-accessToken
 */
async function autoLoginAndGetToken() {
  if (!config.username || !config.password) {
    throw new Error(
      '[getPrivateTokenKV] Chưa cấu hình KV_PRIVATE_USERNAME hoặc KV_PRIVATE_PASSWORD!\n' +
      'Vui lòng kiểm tra file .env để điền thông tin tài khoản đăng nhập KiotViet.'
    );
  }

  console.log('[getPrivateTokenKV] Đang khởi động bot đăng nhập KiotViet ngầm...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const loginUrl = `https://${config.retailer}.kiotviet.vn/man/#/login`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Điền tài khoản & mật khẩu
    await page.type('#UserName', config.username, { delay: 30 });
    await page.type('#Password', config.password, { delay: 30 });

    // Bấm nút Đăng nhập
    const submitBtn = await page.$('input[type="submit"], button[type="submit"], input[value="Đăng nhập"], .btn-login, #btnLogin');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Chờ chuyển hướng tới Dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Lấy token từ LocalStorage
    const token = await page.evaluate(() => {
      return localStorage.getItem('kf-accessToken') || localStorage.getItem('cat');
    });

    if (!token) {
      throw new Error('Đăng nhập hoàn tất nhưng không tìm thấy kf-accessToken trong LocalStorage của KiotViet.');
    }

    // Lưu vào cache (hiệu lực 12 tiếng)
    saveTokenCache(token, 43200);
    console.log('[getPrivateTokenKV] Đăng nhập tự động thành công và đã lưu token vào cache.');
    return token;
  } finally {
    await browser.close();
  }
}

/**
 * Hàm lấy Private Token:
 * 1. Đọc từ file cache .token_cache.json nếu còn hạn (cực nhanh, không cần mở trình duyệt).
 * 2. Nếu hết hạn -> Tự động bật bot Puppeteer đăng nhập ngầm để lấy token mới.
 */
async function getPrivatePaymentToken(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedToken();
    if (cached) return cached;
  }

  // Token thủ công nếu người dùng điền trong .env
  if (config.manualToken) {
    saveTokenCache(config.manualToken, 86400);
    return config.manualToken;
  }

  return await autoLoginAndGetToken();
}

module.exports = {
  getPrivatePaymentToken,
  getCachedToken,
  saveTokenCache,
  autoLoginAndGetToken
};
