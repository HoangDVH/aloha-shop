# Giữ quyền ưu đãi khách mới — 15/10/2026

Mỗi tài khoản và số điện thoại chuẩn hóa chỉ có một quyền `first_web_purchase`, dùng chung cho mọi chương trình khách mới, không đặt lại theo ngày.

## Thay đổi

- Bảo đảm index unique `(policyGroup, identityType, identityKey)` lúc khởi tạo module và trước thao tác giữ/ghi nhận quyền. Không thêm `state` vào khóa unique; tái sử dụng bản ghi đã release. Nếu không tạo được constraint thì thao tác thất bại, không tiếp tục cấp ưu đãi thiếu khóa.
- Không cho thao tác giữ lại cùng mã đơn chuyển quyền đã consumed về held trong khoảng tranh chấp giữa đọc và ghi.
- Khi đổi mã đơn web sang mã KiotViet, đổi cả `orderId` của claim để hủy/thanh toán xử lý đúng quyền.
- Khi một đơn đang giữ quyền, loại mọi voucher khách mới khỏi danh sách có thể áp dụng, đồng thời trả lý do qua báo giá và API voucher. Voucher đã lưu trên trang sản phẩm vẫn có lý do không khả dụng.
- Chỉ hiển thị mã đơn nếu claim thuộc chính tài khoản đang xem. Tài khoản khác cùng số điện thoại chỉ nhận lý do chung.

Giữ quy tắc khách mới = chưa mua thành công. Hủy/hết hạn hợp lệ trả quyền theo luồng hiện có; mua thành công tiêu thụ quyền. Đơn không dùng ưu đãi khách mới đang chờ thanh toán không tự giữ quyền này.

## Bằng chứng

Trước sửa, kiểm thử trên MongoDB mới: 20/20 yêu cầu đồng thời cùng tài khoản giữ thành công (mong đợi 1); 12/12 tài khoản cùng số giữ thành công (mong đợi 1); hủy sau đổi mã KiotViet không trả được quyền. Ba ca đều thất bại trước sửa và đạt sau sửa.

Kiểm tra chỉ đọc database cấu hình hiện tại cho thấy đã có index unique nói trên, 2 bản ghi claim, không có nhóm danh tính trùng. Không kết luận lỗi 20/20 đã xảy ra trên database này; lỗ hổng nằm ở mã khởi tạo không bảo đảm constraint trên môi trường mới.

Sau sửa: 101/101 kiểm thử thuộc 12 tệp đạt, không bỏ qua. Bao gồm 5 ca MongoDB thật mới về tranh chấp, cùng số, thông báo/quyền riêng tư, retry và đổi mã → hủy/paid. Kiểm tra kiểu API/web đạt; kiểm tra diff và giới hạn dòng đạt.

Lệnh kiểm thử (Mongo riêng localhost:27019; database `aloha_shop_test_*` tự dọn):

```powershell
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27019'
node --import tsx --test --test-concurrency=2 --test-timeout=30000 tests/first-purchase-race.test.ts tests/anti-abuse-ab.test.ts tests/anti-abuse-ab-2.test.ts tests/voucher-audience.test.ts tests/returning-voucher.test.ts tests/pdp-vouchers.test.ts tests/voucher-wallet.test.ts tests/voucher-wallet-race.test.ts tests/checkout-voucher-consistency.test.ts tests/checkout-submit.test.ts tests/kv-ship-voucher-payload.test.ts tests/three-page-pricing.test.ts
```

Không tạo đơn KiotViet thật, không thay đổi tiền/lịch sử đơn khách. Thay đổi mã nguồn đang ở workspace, chưa triển khai website. Khi triển khai môi trường khác có dữ liệu claim trùng cần đối soát trước; không tự xóa claim để ép tạo index.
