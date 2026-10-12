# Thống kê truy cập shop

Trang `/admin` hiển thị lượt truy cập (phiên) và người truy cập (mã trình duyệt duy nhất).

- Frontend lưu mã UUID ngẫu nhiên trong localStorage `aloha:visit:v1`, dùng chung giữa các tab cùng origin.
- Chuyển trang không tạo phiên mới. Sau 30 phút không có hoạt động, lần truy cập tiếp theo tạo phiên mới.
- Trang admin, API, tài nguyên Next và bot nhận diện được không ghi nhận. Đây không phải hệ thống chống gian lận/bot tuyệt đối.
- Khi tab đang hiển thị và phiên còn hoạt động, gửi cập nhật tối đa một lần/phút. Timer không kéo dài phiên nhàn rỗi.
- Nếu người dùng chặn storage hoặc tracking, truy cập có thể không được ghi nhận. Nhiều thiết bị hoặc xóa storage có thể tạo mã khách mới.

## Lưu trữ và ngày báo cáo

Collection `aloha_shop_visits` được tạo tự động khi tạo index/ghi nhận đầu tiên. Các trường: `visitorId`, `sessionId`, `startedAt`, `lastSeenAt`. Không lưu IP, user-agent, đường dẫn hay thông tin tài khoản vào collection này.

Index duy nhất trên `sessionId` chống ghi trùng; index `(startedAt, visitorId)` phục vụ báo cáo. Số lượt và số người được tính từ các phiên **bắt đầu** trong khoảng ngày, với ngày theo UTC+7, đầu ngày bao gồm và cuối ngày loại trừ. Không cộng số khách duy nhất từng ngày vì có thể đếm trùng. Khoảng báo cáo tối đa 366 ngày. Hiện không đặt TTL xóa lịch sử.

## API và Redis

- `POST /api/shop/visits`: nhận `{ visitorId, sessionId, path }`, kiểm tra UUID/path, origin và rate limit; thành công trả 204. Thời gian ghi nhận lấy từ server.
- `GET /api/shop/admin/visits?from=YYYY-MM-DD&to=YYYY-MM-DD`: yêu cầu tài khoản quản lý đang hoạt động. Kết quả: `visits`, `visitors`, `trackingSince`, `updatedAt`.
- Redis dùng kết nối cache sẵn có tại `backend/cache/transport.ts`, cấu hình bằng `CACHE_REDIS_URL`. Không dùng Redis nghiệp vụ `REDIS_URL`. `SHOP_PUBLIC_CACHE_ENABLED=0` cũng tắt kết nối cache này.
- Cache kết quả theo database và khoảng ngày trong 60 giây; có thời hạn truy cập Redis 200ms và fallback MongoDB. Không cần Redis để thu thập hoặc đọc thống kê. Không sao chép toàn bộ collection lên Redis.
- Frontend cập nhật báo cáo mỗi phút. Nút làm mới gọi lại API nhưng vẫn tôn trọng TTL cache.

### Kết nối local tới Redis cache trên VPS

VPS đã có service `redis-shop-cache` tại `127.0.0.1:6380`. Chạy `powershell -NoProfile -File scripts/start-vps-cache-tunnel.ps1` để mở SSH tunnel nền, chỉ bind loopback local. Đặt `CACHE_REDIS_URL=redis://127.0.0.1:6380` và `SHOP_PUBLIC_CACHE_ENABLED=1` trong `.env` local, rồi khởi động lại API. Sau khi khởi động lại máy hoặc tunnel bị ngắt, chạy lại script. MongoDB vẫn dùng tunnel riêng ở cổng 27018.

Kiểm tra kết nối và cache thống kê thực bằng `node --import tsx scripts/smoke-shop-visits-cache.ts`. Script không tạo phiên truy cập giả; chỉ đảm bảo index và đọc thống kê, thử một key TTL 10 giây rồi xóa key đó. Không thay đổi cấu hình Redis trên VPS.

## Kiểm tra

`npm run typecheck:api`, `npm run typecheck:web`.

`node --import tsx --test tests/shop-visits.test.ts` chạy kiểm thử ngày, phiên và bảo vệ API. Đặt `SHOP_VISITS_TEST_MONGO_URI` để chạy thêm kiểm thử Mongo và cache; test tạo database tạm tên `aloha_visits_test_<uuid>` và chỉ xóa database tạm đó khi kết thúc.
