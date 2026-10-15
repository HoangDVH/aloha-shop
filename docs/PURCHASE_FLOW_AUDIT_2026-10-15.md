# Rà soát quy trình mua hàng — 15/10/2026

## Kết quả và giới hạn

Đã rà soát mã nguồn và chạy 92 tệp kiểm thử thuộc luồng mua hàng: **612 ca đạt, 0 lỗi, 0 bỏ qua**, thời gian 87,7 giây. Typecheck API và web đều đạt; `git diff --check` đạt.

Đây là kiểm chứng tự động ở mức hàm, component và tích hợp dịch vụ/database. Không phải chứng nhận mọi tổ hợp nghiệp vụ hoặc một phiên thao tác trình duyệt xuyên suốt trên production. Chưa triển khai các thay đổi.

MongoDB thật chạy riêng tại localhost:27019; bộ test tạo database có tiền tố `aloha_shop_test_` và dọn dữ liệu thử nghiệm. HTTP KiotViet được mô phỏng; không tạo đơn, thanh toán hay thay đổi tồn kho production.

## Phạm vi đã kiểm chứng

| Nhóm | Trường hợp chính |
|---|---|
| Khách hàng | Khách mới/cũ; chuẩn hóa điện thoại; đơn hủy/chưa thanh toán khi xác định khách cũ; phân quyền và phiên đăng nhập |
| Sản phẩm và giá | Trong/ngoài chiến dịch; flash sale toàn phần/một phần; giảm theo số lượng; giá tham chiếu; quà tặng; nhiều dòng cùng SKU |
| Voucher | Đối tượng áp dụng; đã lưu/chưa lưu; lịch sử và hạn dùng; ngưỡng đơn; giới hạn lượt; giữ/sử dụng/hoàn lượt khi hủy; tranh chấp đồng thời |
| Tổng tiền | Giỏ hàng, báo giá và tạo đơn; giảm sản phẩm/voucher/phí ship; giới hạn giảm; không trừ giảm giá hai lần; trạng thái phí vận chuyển chưa xác định |
| Địa chỉ | Chuyển đổi dữ liệu địa chỉ; các component chọn địa chỉ mobile; thông tin địa chỉ gửi KiotViet; xác thực báo giá vận chuyển |
| Khách sỉ | Hồ Chí Minh/tỉnh; trạng thái duyệt và khóa; điều kiện số lượng/giá trị; thiếu giá sỉ; đơn chờ hàng; liên kết khách KiotViet |
| Cộng tác viên | Hoa hồng trên tiền hàng sau ưu đãi; không tính phí ship/quà; điều chỉnh, hoàn và khóa hoa hồng |
| Admin/nhân viên | Phân quyền; sửa chiến dịch; revision; publish; tranh chấp worker và khôi phục tiến trình |
| KiotViet | Payload tiền hàng, giảm giá, phí ship và ghi chú; đồng bộ thay đổi đơn; tránh gửi trùng; timeout với kết quả chưa biết; đối soát định danh; webhook |
| Giao diện | Kiểm thử component/nguồn cho giá mobile, địa chỉ, tổng tiền, thanh cố định và trạng thái đang cập nhật giá |

Ma trận giá có 336 tổ hợp nội bộ: 3 mức giá × 7 mức số lượng × khách mới/cũ × trạng thái lưu voucher × 4 mức ship. Đây là các tổ hợp nằm trong ca kiểm thử, không cộng thêm vào con số 612. Bộ admin/CTV còn kiểm tra 54 tổ hợp số lượng, tỷ lệ và vận chuyển.

## Lỗi tìm thấy và đã sửa

1. **Giảm theo số lượng bị thiếu trong phần giá gốc/tổng tiết kiệm sau đặt hàng.** Lưu snapshot `volumeSavings`, tính lại cho đơn cũ khi còn đủ dữ liệu và hiển thị dòng giảm tương ứng. Không trừ thêm vào số tiền khách phải trả. Khi KiotViet sửa giá dòng hàng, xóa snapshot cũ; sửa riêng phí ship vẫn giữ snapshot. Có kiểm thử hồi quy cho flash sale một phần và quà tặng để tránh đếm hai lần.
2. **Nhân viên bị từ chối khi chỉ sửa nội dung chiến dịch cũ.** Chuẩn hóa cả nội dung đã lưu và nội dung mới trước khi so sánh trường liên quan tiền. Nhân viên vẫn bị chặn khi sửa giá, quota, voucher hoặc lịch chiến dịch. Có kiểm thử hồi quy với MongoDB.

Ngoài ra cập nhật bốn fixture kiểm thử đã lỗi thời: icon mock, collection mock cho danh sách quà, điểm trích nguồn kiểm thử khách sỉ và ngữ cảnh khách mới/cũ. Không nới quy tắc ứng dụng để làm test đạt.

Lượt ban đầu không có MongoDB: 544 đạt, 6 lỗi, 56 bỏ qua. Lượt tích hợp MongoDB đầu tiên phát hiện thêm lỗi sửa nội dung chiến dịch. Sau sửa và bổ sung hồi quy, lượt cuối đạt toàn bộ 612 ca.

## Bằng chứng và chạy lại

- Danh sách 92 tệp: `artifacts/purchase-flow-audit/final/manifest.json`.
- Kết quả chi tiết: `artifacts/purchase-flow-audit/final/tests.tap` và `tests.xml`.
- Chạy: `node scripts/audit-purchase-flow.cjs --with-mongo` sau khi MongoDB thử nghiệm tại localhost:27019 đã sẵn sàng.
- Kiểm tra kiểu: `npm run typecheck:api` và `npm run typecheck:web`.

## Phần còn cần nghiệm thu thực tế

Chưa có trình duyệt đăng nhập được kết nối để thao tác từ chọn hàng đến hoàn tất đơn trên desktop/mobile. Vì vậy chưa xác nhận trực quan bố cục, bàn phím, cuộn, mạng chậm hoặc thời gian phản hồi thực tế.

Chưa tạo đơn KiotViet thật hoặc đối chiếu cổng thanh toán, vận đơn và dữ liệu khách/voucher production. Các test payload và đồng bộ không thay thế bước đối soát đơn thật. Thời gian 87,7 giây là thời gian chạy bộ test, không phải độ trễ báo giá của khách hàng.

Lượt nghiệm thu tiếp theo cần dùng tài khoản thử theo từng nhóm, SKU trong/ngoài ưu đãi, voucher còn hạn/hết hạn/đã dùng, thay địa chỉ, đối chiếu tiền ở giỏ → xác nhận → kết quả → KiotViet, rồi kiểm tra hủy/hoàn và hoa hồng. Đơn thật phải được đánh dấu và có phương án dọn theo quy định dự án; không dùng khách thật để thử.
