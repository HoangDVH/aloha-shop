# Module Độc Lập: getPrivateTokenKV (Tự Động Sinh Mã QR Thanh Toán KiotViet)

Module này được thiết kế **hoàn toàn độc lập (Portable)**, không dính líu đến bất kỳ mã nguồn hay thư viện nào của dự án gốc. Bạn có thể copy nguyên thư mục này sang bất kỳ dự án nào (Node.js, Express, Next.js, v.v.) hoặc đưa lên VPS chạy riêng.

---

## 🚀 Tính năng nổi bật
1. **Tự động đăng nhập 100%**: Sử dụng Puppeteer chạy ngầm, tự đăng nhập bằng tài khoản KiotViet của bạn mà không cần người dùng thao tác trên web.
2. **Bộ nhớ Cache thông minh**: Sau khi đăng nhập, token được lưu vào file `.token_cache.json` (hiệu lực 12 tiếng). Các lần tạo QR sau sẽ chạy siêu nhanh (chưa tới 0.5 giây).
3. **Tự động làm mới khi hết hạn**: Nếu token hết hạn (lỗi 401), hệ thống sẽ tự động kích hoạt bot đăng nhập lại mà không làm gián đoạn thanh toán của khách.
4. **Chuẩn VietQR liên kết KiotViet**: Tự sinh chuỗi QR kèm tiền tố **`KOVQR...`** độc quyền để KiotViet tự động nhận diện thanh toán từ Vietcombank và gạch nợ hóa đơn.

---

## 📁 Cấu trúc thư mục

```text
getPrivateTokenKV/
├── package.json         # Danh sách thư viện độc lập (puppeteer, dotenv)
├── .env.example         # Mẫu biến môi trường
├── config.js            # Nạp biến môi trường (tự động đọc .env nội bộ hoặc .env của project cha)
├── auth.js              # Bot Puppeteer tự động đăng nhập ngầm & lưu cache token
├── generateQr.js        # Hàm gọi API payment.kiotviet.vn/api-sdk/v1.0.0/generate-qr
├── index.js             # File xuất các hàm dùng chung
└── test.js              # File test chạy độc lập bằng lệnh: node test.js
```

---

## 💻 Cách đem thư mục này sang dự án khác

1. **Bước 1**: Copy toàn bộ thư mục `getPrivateTokenKV` vào dự án mới.
2. **Bước 2**: Mở Terminal tại thư mục `getPrivateTokenKV` và cài đặt:
   ```bash
   npm install
   ```
3. **Bước 3**: Tạo file `.env` ngay bên trong thư mục `getPrivateTokenKV` (hoặc ở thư mục gốc dự án của bạn):
   ```env
   KV_RETAILER=alohanguyen
   KV_PRIVATE_USERNAME=tai_khoan_cua_ban
   KV_PRIVATE_PASSWORD=mat_khau_cua_ban
   ```

---

## 🛠️ Cách sử dụng trong code

```javascript
const { generateKiotVietPaymentQr } = require('./getPrivateTokenKV');

async function taoQrDonHang() {
  const result = await generateKiotVietPaymentQr({
    amount: 50000,                // Số tiền cần thanh toán (VND)
    content: 'bill HD022010',      // Nội dung hóa đơn cần thanh toán
  });

  console.log('Mã nhận diện KiotViet:', result.body.kov_code); // ví dụ: KOVQR FCJ1H8
  console.log('Chuỗi VietQR:', result.body.qr_string);        // Chuỗi chuẩn EMVCo
  console.log('Ảnh QR dạng Base64:', result.body.image);       // data:image/png;base64,...
}

taoQrDonHang();
```

---

---

## 🎁 Tính năng: Tự động Tạo Chương Trình Khuyến Mại (Promotion)

Bạn có thể tạo khuyến mại *"Hàng hóa - Giá bán theo số lượng mua"* cho từng mã sản phẩm chỉ bằng 1 hàm gọi.

### Cách tạo cho 1 sản phẩm:
```javascript
const { createPromotionForProduct } = require('./getPrivateTokenKV');

async function taoKhuyenMai() {
  const result = await createPromotionForProduct({
    productCode: 'TPKNB', // Chỉ cần truyền mã sản phẩm
    // Mặc định tự sinh:
    // - Tên: "KM cây thành phẩm TPKNB"
    // - Bậc 1: Mua >= 1 giảm 20%
    // - Bậc 2: Mua >= 10 giảm 30%
    // - Thời hạn: 6 tháng từ ngày tạo
  });

  console.log('Tạo thành công:', result.campaignCode, result.campaignName);
}

taoKhuyenMai();
```

### Cách chạy hàng loạt cho 214 sản phẩm:
```javascript
const { createPromotionForProduct } = require('./getPrivateTokenKV');

const listProductCodes = ['TPKNB', 'TNM2L', 'CAY01', 'CAY02' /* ... 214 mã sản phẩm */];

async function taoHangLoat() {
  for (const code of listProductCodes) {
    try {
      console.log(`Đang tạo khuyến mại cho ${code}...`);
      const res = await createPromotionForProduct({ productCode: code });
      console.log(`✅ Thành công: ${res.campaignCode} - ${res.campaignName}`);
      // Nghỉ nhẹ 300ms giữa các request để tránh spam API
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`❌ Thất bại mã ${code}:`, err.message);
    }
  }
}

taoHangLoat();
```

---

## 🧪 Kiểm tra chạy thử

Đứng tại thư mục `getPrivateTokenKV` và gõ:

```bash
# Test tạo mã QR
node test.js

# Test tạo khuyến mại cho 1 mã sản phẩm
node test_campaign.js TNM2L
```

