# Sửa phân loại khách sỉ và sở hữu lượt giữ voucher — 15/10/2026

## Hành vi

- Role từ database được giữ khi đăng nhập, gia hạn và xác thực request; role đăng ký công khai vẫn không cho tự cấp quyền sỉ.
- Báo giá hàng, ship và tạo đơn cùng đọc phân loại từ tài khoản hiện tại, không phụ thuộc role lỗi thời trong JWT. Các điều kiện duyệt sỉ/HCM/TINH vẫn được kiểm tra ở lớp hiện có.
- Tra cứu theo idempotency key được giới hạn theo người mua. Chỉ trả thành công cho lượt giữ cùng chủ sở hữu, mã đơn, số tiền giảm, mã voucher, loại ưu đãi và key.
- Hai người mua dùng cùng key có lượt giữ và ngân sách riêng; không tái sử dụng bản ghi của nhau. Đổi nội dung/đơn trên cùng key bị từ chối.
- Lượt mới có `_id` xác định từ voucher và khóa người mua/request (hoặc voucher/đơn nếu không có khóa). Unique `_id` của MongoDB ngăn hai request đồng thời tạo trùng. Khi insert tranh chấp, hoàn đúng phần counter/budget/code/customer-usage vừa giữ trước khi xác minh bản ghi thắng.
- Thêm index phục vụ hai kiểu tra cứu. Không sửa tiền, xóa lịch sử hoặc chuyển đổi bản ghi production cũ.

## Kiểm chứng

Trước sửa: 8/9 kiểm thử hồi quy mới thất bại, gồm mất role sỉ, chênh 10.000đ giữa báo giá và tạo đơn, dùng nhầm lượt held/used của người khác và chấp nhận replay đổi nội dung.

Sau sửa: 115/115 ca thuộc 14 tệp đạt, 0 bỏ qua, gồm MongoDB thật riêng `aloha_shop_test_*`. API typecheck đạt. Bổ sung kiểm tra chiều khách lẻ có token cũ mang role sỉ vẫn phải được tính theo tài khoản hiện tại cũng đạt (3 ca của tệp phân loại).

Mongo kiểm tra 20 request đồng thời cho cùng người mua/key: cùng đơn chỉ một lượt/ngân sách; khác đơn chỉ một đơn thắng. Counter voucher, ngân sách, mã và giới hạn khách đều còn đúng 1 lượt; sau hủy về 0. Hai người mua trùng key có 2 lượt và giữ đủ tổng ngân sách.

```powershell
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27019'
node --import tsx --test --test-concurrency=2 --test-timeout=30000 tests/wholesale-auth-voucher.test.ts tests/voucher-reservation-identity.test.ts tests/voucher-reservation-race.test.ts tests/anti-abuse-ab.test.ts tests/anti-abuse-ab-2.test.ts tests/voucher-wallet-race.test.ts tests/voucher-wallet.test.ts tests/shop-session-renewal.test.ts tests/checkout-voucher-consistency.test.ts tests/first-purchase-race.test.ts tests/si-merch-catalog.test.ts tests/three-page-pricing.test.ts tests/tinh-shipping-voucher.test.ts tests/wholesale-purchase-policy.test.ts
npm run typecheck:api
```

Không gọi tạo đơn KiotViet thật hoặc thanh toán thật. Chưa triển khai bản sửa này lên website. Sau triển khai cần đối chiếu một phiên khách lẻ và sỉ thực tế; các đơn đã có sai lệch cần đối soát riêng, không tự điều chỉnh bằng migration này.
