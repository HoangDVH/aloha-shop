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

## 🧪 Kiểm tra chạy thử

Đứng tại thư mục `getPrivateTokenKV` và gõ:

```bash
node test.js
```
