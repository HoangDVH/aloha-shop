# Top sản phẩm trong Tổng quan admin

Code hoàn tất tại local ngày 12-10-2026. Chưa triển khai phần này lên production.

## Giao diện

Hai biểu đồ thanh ngang theo ảnh tham khảo KiotViet: khung trắng bo góc, thanh xanh, tên/đơn vị phía trên thanh, giá trị cuối thanh và vạch chia trục. Hai cột trên desktop, xếp dọc trên màn hình nhỏ. Menu có dấu tích, màu nền lựa chọn hiện tại, hỗ trợ bàn phím và đóng khi nhấn ngoài/Escape.

- **Top 10 hàng bán chạy**: Theo doanh thu thuần / Theo số lượng.
- **Top 10 sản phẩm được xem nhiều**: Theo lượt xem / Theo người xem.
- Mỗi biểu đồ có bộ lọc riêng: hôm nay, hôm qua, 7 ngày, tháng này, tháng trước, 30 ngày và khoảng ngày tùy chọn tối đa 366 ngày. Tính theo giờ Việt Nam, làm mới mỗi phút.
- Có loading, lỗi/thử lại và trạng thái chưa có dữ liệu; không dùng số liệu mẫu thay cho dữ liệu thật. Tên dài có nội dung đầy đủ qua tooltip. Giá trị tiền được rút gọn nghìn/tr/tỷ, tooltip giữ giá trị đầy đủ.

## Nguồn và cách tính bán chạy

Theo lựa chọn của người dùng, nguồn chỉ là `aloha_shop_orders`, không dùng bảng hóa đơn bán tại cửa hàng KiotViet. Chỉ tính đơn `hoan_thanh` đã thanh toán: trạng thái paid hoặc có số tiền thực nhận đủ tổng cần trả, loại trạng thái thanh toán thất bại/hủy/hết hạn. Đơn test và dòng quà tặng bị loại.

Khoảng ngày chọn lọc theo `deliveredAt`; dữ liệu cũ không có ngày hoàn tất dùng `createdAt`. Đây là báo cáo đơn hoàn tất theo trạng thái hiện tại, không phải sổ hạch toán giao dịch trả hàng theo ngày phát sinh.

Doanh thu tiền hàng lấy tổng checkout trừ phí giao hàng và giá trị dòng quà tặng. Giảm giá/voucher đã nằm trong tổng nên không bị trừ hai lần. Tổng tiền hàng được phân bổ theo tỷ trọng tiền dòng sau giảm giá, dùng phần dư lớn nhất để bảo toàn số tiền VND đến đồng. Dữ liệu cũ thiếu tổng có phương án tính từ các dòng và phần giảm giá chưa phân bổ.

Hoàn toàn bộ bị loại theo trạng thái đơn hủy. Hoàn từng mã mới được ghi bằng `$addToSet returnedProductCodes` trong handler hiện có; không đổi tổng tiền hay trạng thái thanh toán do tính báo cáo. Chi tiết có `returnedQuantity` được trừ theo tỷ lệ. Đơn hoàn cũ thiếu chi tiết được loại và báo số lượng trên giao diện, không suy diễn từ việc hủy hoa hồng. Mã cũ/mới được chuẩn hóa qua aliases trước khi trừ hàng hoàn và gộp theo ID KiotViet; các đơn vị có ID khác nhau vẫn riêng biệt.

## Theo dõi sản phẩm được xem

`ProductViewTracker` chỉ chạy khi trang chi tiết thật sự hiển thị, không chạy từ prefetch và không chạy trên tab ẩn/webdriver. Dùng chung visitor/session với bộ theo dõi truy cập. Sau 30 phút không hoạt động, quay lại tab tạo phiên mới.

Collection `aloha_shop_product_views` lưu mỗi cặp session–product một lần bằng unique index; gửi lặp/refresh không tăng lượt trong cùng phiên. Product key dùng ID KiotViet để không bị tách khi đổi mã. Người xem là visitor ID trình duyệt duy nhất trong khoảng ngày, không phải số người thật được xác minh. Không thể truy hồi lượt xem trước lúc bật tracking.

## API, cache và bảo vệ

- POST `/api/shop/product-views`: UUID/code hợp lệ, origin được phép, loại bot nhận diện được và giới hạn 120 request/phút. Chỉ nhận sản phẩm đủ điều kiện hiển thị. Tracking thất bại không cản mua hàng.
- GET `/api/shop/admin/top-products`: quyền active manager, kind/metric/range được kiểm tra. Không trả danh tính khách, visitor ID hoặc session ID.
- Redis cache tổng hợp 60 giây qua CACHE_REDIS_URL hiện có; Redis không sẵn sàng thì truy vấn Mongo. Dữ liệu gốc luôn ở Mongo.
- Index cho phiên xem, khoảng ngày xem và trạng thái/ngày giao của đơn shop.

## Kiểm chứng

20 kiểm thử đạt, không bỏ qua ca nào, gồm hai ca tích hợp Mongo trong database tạm tự xóa. Bao phủ giảm giá/phí ship/quà, bảo toàn phân bổ VND, thanh toán, hoàn từng mã, alias sau đổi mã, phân trang top 10, ranh giới ngày Việt Nam, quyền admin/origin/bot, concurrency dedup, người xem nhiều phiên, tracking tab ẩn/quay lại và state bộ lọc riêng.

Backend/frontend TypeScript đạt. Trang admin local HTTP 200; API thống kê trả 401 khi không đăng nhập. `git diff --check` đạt. Check số dòng còn năm file vượt giới hạn đã có từ trước, ngoài phần thay đổi này. Không có trình duyệt kết nối để chụp và kiểm chứng giao diện trực quan trong phiên đăng nhập thực tế; kiểm thử giao diện hiện kiểm tra hành vi component và dữ liệu.

Chạy bộ kiểm thử Mongo bằng `node tools/run-shop-analytics-tests.cjs`; URI đọc từ env, không in thông tin kết nối. Database thử nghiệm có tên UUID riêng, không sửa đơn hàng khách hàng.
