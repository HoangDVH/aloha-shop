# Giữ tồn khi mã WEB đổi thành mã KiotViet

Phiếu mới dùng `String(order._id)` làm orderId cố định, orderCode là mã hiển thị lúc tạo. Áp dụng cho checkout thường và yêu cầu đặt trước. Khi đổi mã, giữ toàn bộ legacyCodes trước đó. Không dùng mã WEB/DH làm danh tính cố định của phiếu mới.

Nhả giữ tồn, kết thúc giữ tồn, gia hạn chuyển khoản, bỏ giữ tồn của chính đơn khi kiểm tra tồn và xử lý hết hạn đều phân giải mã hiện tại, legacyCodes và Mongo ID về cùng một tập tham chiếu. Tương thích với phiếu cũ lưu orderId=WEB. Tham chiếu khớp nhiều đơn bị chặn; không tự nhả giữ tồn của đơn khác. Chỉ chuyển phiếu đang held, nên retry không trừ tồn hai lần. Retry giao/hoàn cho đơn đã hoàn thành/hủy cũng xử lý nốt phiếu còn held. Hoàn một sản phẩm không nhả toàn bộ phiếu của đơn.

Index orderCode/status bổ sung cho tìm theo mã; index orderId/status phục vụ danh tính cố định. Không đổi dữ liệu tồn sản phẩm hay gọi API KiotViet trong sửa phiếu.

## Sửa dữ liệu cũ

`node --import tsx scripts/repair-shop-stock-holds.ts` chỉ lập phương án và lưu backup BSON Extended JSON trong artifacts/stock-hold-repair. Thêm `--apply` để áp dụng:

- Đơn hủy/đã void test: released.
- Đơn hoàn thành: consumed, không trừ lại tồn vật lý.
- Đơn chưa kết thúc có phiếu mã cũ: gắn Mongo ID và mã hiện tại, giữ nguyên qty/trạng thái/expiry.
- Phiếu không tìm được đơn hoặc khớp nhiều đơn: báo unresolved, không sửa.
- Phiếu không hết hạn đã khớp mã, hoặc phiếu đã hết hạn của đơn chưa kết thúc: giữ nguyên.

Script sao lưu trước khi ghi, đọc lại đơn và CAS theo _id/status/orderId/orderCode/qty/ma/expiry. Nếu trạng thái/mã thay đổi so với phương án thì bỏ qua và cần kiểm tra lại. Chạy lại không tăng tồn hay sửa phiếu đã xử lý. Khi rebind, đọc lại đơn một lần để xử lý trường hợp đơn vừa kết thúc trong lúc sửa.

## Xác minh ngày 12/10/2026

Database đang cấu hình aloha_shop_db: 41 phiếu held; xử lý 9 phiếu đơn hủy, 3 phiếu đơn hoàn thành, gắn lại 12 phiếu của đơn đang chờ xác nhận. Không có unresolved hoặc skipped. Đối chiếu lại không còn phiếu cần sửa theo các tiêu chí trên; 29 phiếu vẫn held, gồm giữ tồn hợp lệ và phiếu hết hạn không còn ảnh hưởng tồn hiển thị. Backup trước khi ghi lưu local, không đưa lên Git.

Kiểm tra backend/frontend typecheck và tests/stock-hold-identity.test.ts, tests/void-test-order.test.ts, tests/wholesale-backorder.test.ts, tests/returned-product-analytics.test.ts. Code cần triển khai lên backend thật để phòng lỗi trên các đơn mới; sửa dữ liệu không tự deploy code.
