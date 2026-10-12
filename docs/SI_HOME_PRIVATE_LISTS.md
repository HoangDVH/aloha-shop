# Danh sách trang chủ riêng cho khách sỉ

Triển khai code local ngày 12-10-2026. Chưa đưa lên production hoặc chỉnh dữ liệu sản phẩm thực tế.

## Cách sử dụng

Trong Admin → Website → Hàng hóa trên web, chọn **Danh sách đang chỉnh**:

- **Danh sách chung**: nhãn/ghim hiện có dùng cho khách lẻ, CTV và các tài khoản khác.
- **Khách sỉ – Nổi bật**: gắn nhãn Nổi bật cho các sản phẩm muốn đưa vào mục nổi bật của sỉ HCM/tỉnh đã duyệt.
- **Khách sỉ – Ưu đãi**: gắn nhãn Ưu đãi cho các sản phẩm muốn đưa vào mục ưu đãi của nhóm khách sỉ này. Việc chọn danh sách không tự giảm giá.

Một sản phẩm có thể thuộc cả hai danh sách sỉ, với số ghim riêng. Chọn Chưa gắn để bỏ sản phẩm khỏi danh sách đang chỉnh. Ghim trùng chỉ thay sản phẩm trong cùng danh sách. Hiện/ẩn sản phẩm và Áp nhãn mặc định chỉ thao tác được ở Danh sách chung vì đó là trạng thái dùng chung.

Khi một mục chưa có sản phẩm được chọn riêng, khách sỉ dùng danh sách chung. Khi đã chọn ít nhất một sản phẩm, mục đó chỉ dùng danh sách sỉ; không bù sản phẩm chung/bán chạy vào danh sách ngắn. Bỏ hết sản phẩm riêng sẽ trở lại danh sách chung. Sản phẩm đang ẩn/không đủ điều kiện hiển thị vẫn không xuất hiện trên shop.

Quy tắc chậu/chậu/cây và đưa thành phẩm xuống cuối tiếp tục áp dụng trên danh sách sỉ. Nút Xem thêm giữ đúng danh sách đang xem và phân trang.

## Dữ liệu và bảo vệ phạm vi

Không tạo collection mới. Trên `aloha_products`:

- `webBadge`, `webPin`: danh sách chung, giữ nguyên tương thích.
- `webSiFeatured`, `webSiFeaturedPin`: thành viên và ghim danh sách sỉ Nổi bật.
- `webSiDeals`, `webSiDealsPin`: thành viên và ghim danh sách sỉ Ưu đãi.

Hai index được tạo khi lưu danh sách sỉ lần đầu: `si_home_featured`, `si_home_deals`.

Admin GET/PATCH giữ nguyên quyền manager và thêm audience enum `common | si_noi_bat | si_uu_dai`. GET trả nhãn/ghim thuộc phạm vi được chọn. PATCH chỉ ghi field của phạm vi đó. Scope và nhãn không hợp lệ bị từ chối.

Storefront chỉ chọn danh sách riêng khi request có `homeOrder=wholesale`, nhãn tương ứng và backend xác minh phiên giá sỉ. Guest/khách lẻ không thể chọn danh sách riêng chỉ bằng query string. Cache đã tách price mode và presentation profile; thay đổi admin vô hiệu hóa cache và phát sự kiện làm mới danh sách.

Trang chủ và trang Xem thêm riêng tải dữ liệu theo phiên ở client. Dữ liệu danh sách sỉ không được nhúng vào HTML dùng chung, tránh phụ thuộc vào cache trang Nginx để cách ly danh sách.

## Kiểm tra

- 56 kiểm thử liên quan đạt: ghi/xóa từng scope, ghim trùng, giữ nguyên nhãn chung, membership hai danh sách, backend chọn scope theo phiên, fallback, phân trang, Xem thêm và bộ lọc/ghim cũ.
- TypeScript frontend và backend đạt.
- `git diff --check` đạt. Check số dòng còn năm file vượt giới hạn đã có từ trước, ngoài phần thay đổi này.
- Không có trình duyệt kết nối để kiểm chứng hình ảnh bằng phiên đăng nhập thực tế. Kiểm thử handler dùng database adapter giả; không ghi vào sản phẩm khách hàng.
