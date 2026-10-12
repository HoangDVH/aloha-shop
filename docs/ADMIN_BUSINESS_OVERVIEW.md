# Tổng quan bán hàng và chuyển đổi của website

Hai khối nằm trước thống kê truy cập/top sản phẩm tại `/admin`. Dùng chung bộ lọc hôm nay, 7 ngày, 30 ngày hoặc tùy chọn (tối đa 366 ngày), giờ Việt Nam. API dành cho quản lý đang hoạt động: `GET /api/shop/admin/business-overview?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|hour`. Làm mới mỗi phút.

## Kết quả bán hàng

Chỉ đọc `aloha_shop_orders`: trạng thái `hoan_thanh`, không phải đơn test, đã thanh toán (`paid` hoặc số tiền nhận >= tổng và trạng thái thanh toán không thất bại/hủy/hết hạn). Tiền hàng = tổng đơn trừ phí vận chuyển và giá trị quà tặng. Tổng đơn đã có giảm giá nên không trừ lần nữa. Đây là doanh thu trước khấu trừ trả hàng, không phải doanh thu thuần. Đơn bị chuyển trạng thái hủy sẽ không còn trong thống kê; chưa có sổ doanh thu/phiếu trả để tái dựng doanh thu lịch sử độc lập với trạng thái hiện tại.

Thời điểm bán lấy `deliveredAt`, đơn cũ thiếu trường này dùng `createdAt`. So sánh khoảng liền trước có cùng số ngày. Nếu kỳ hiện tại chưa hết, kỳ trước cũng được cắt đến cùng thời điểm tương ứng. Kỳ trước bằng 0 không hiển thị tỷ lệ phần trăm. Chế độ giờ cộng theo 24 khung giờ của cả kỳ; ngày tạo đầy đủ cột 0. Liên kết “Xem đơn shop” mở danh sách đơn chung.

## Chuyển đổi

`POST /api/shop/funnel` nhận `visitorId`, `sessionId` UUID, `path` và sự kiện `visit|cart|checkout`; không chấp nhận sự kiện đặt thành công từ client. Kiểm tra origin, bot, đường dẫn admin/API và giới hạn tốc độ. Không thu tên, điện thoại hoặc địa chỉ trong sự kiện. Dùng cùng định danh trình duyệt và thời gian hết phiên 30 phút của thống kê truy cập.

`aloha_shop_funnel_sessions` lưu một bản ghi mỗi phiên, ngày bắt đầu và thời điểm đầu tiên của từng hành động. Sự kiện lặp/tải lại không tăng số phiên. Client ghi khi thêm giỏ thành công, khi khách có giỏ chọn và mở checkout đã đăng nhập, và trước khi gửi đặt đơn (bao gồm phiên mới sau thời gian không hoạt động). Lỗi tracking không chặn mua hàng.

Backend tạo đơn lưu định danh analytics tùy chọn đã được validate. Sau khi luồng tạo đơn thành công, backend lưu `analyticsPlacedAt`; replay idempotency dùng phiên gốc và không đổi thời điểm đầu tiên. Đơn test bị loại. COD mới đặt vẫn là chuyển đổi dù chưa giao; đơn bị khách hủy sau đó vẫn phản ánh việc đặt thành công, không phải doanh thu.

Phễu đếm phiên bắt đầu và đạt bước trong kỳ chọn. Phiên bắt đầu ngoài kỳ bị loại để giữ cùng tập mẫu cho mọi bước. Một phiên có nhiều đơn tính một lần. Mỗi bước là tập phiên riêng: giỏ lưu sẵn có thể bỏ qua bước thêm giỏ. Tỷ lệ giữa bước dùng giao của hai tập phiên, không lấy số bước sau chia thẳng bước trước. Tỷ lệ chung = phiên có ít nhất một đơn được backend xác nhận / tổng phiên.

Không hồi dựng hành động giỏ/checkout trước khi bật tracking. `trackingSince` là phiên đầu tiên ghi nhận; so sánh chuyển đổi ẩn khi kỳ trước chưa có tracking đầy đủ. Người chặn storage/tracking không được đo. Bot nhận diện được và trang admin bị loại, nhưng quản trị viên mua/xem storefront bình thường vẫn là phiên storefront.

## Kiểm tra

`npm run typecheck:api`, `npm run typecheck:web`; `node --import tsx --test tests/business-overview.test.ts tests/business-overview-ui.test.ts tests/funnel-tracking.test.ts`. Đặt `SHOP_ANALYTICS_TEST_MONGO_URI` để chạy integration trong database tạm có tiền tố `aloha_overview_test_`, tự dọn sau test. Không sửa dữ liệu đơn thật.

Triển khai cả frontend và backend cùng phiên bản để bắt đầu ghi nhận phễu. Không yêu cầu backfill hay đồng bộ doanh số toàn KiotViet.
