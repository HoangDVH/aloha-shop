# Phân quyền tài khoản shop

Admin → Khách hàng → Phân quyền (hoặc mở tên khách) → mục Phân quyền tài khoản. Chọn khách lẻ/sỉ, bật/tắt CTV, nhập lý do và lưu. CTV là quyền độc lập, có thể đi cùng khách lẻ hoặc khách sỉ. Áp dụng cho tài khoản shop hiện có, bao gồm tài khoản đã đăng nhập qua email/Google/Zalo; không tạo tài khoản hay mật khẩu mới.

- Gán CTV mới: cấp mã 3–20 ký tự, hoặc tự sinh mã nếu để trống; trạng thái active. Mã cũ không thay để giữ liên kết hoa hồng. CTV đang chờ duyệt/khóa chỉ được kích hoạt khi chọn hành động đó, không do sửa loại khách.
- Tắt CTV: bỏ vai trò và đặt trạng thái khoa; giữ mã, số dư/nợ, lịch sử đơn và hoa hồng.
- Gán sỉ: cần số điện thoại hợp lệ. Nếu chưa đồng ý điều khoản hiện hành, trạng thái Cần bổ sung (`tu_choi`) để khách hoàn tất luồng đăng ký sỉ có sẵn. Nếu đã có điều khoản hợp lệ, trạng thái Chờ duyệt. Không tự xác nhận điều khoản, vùng kinh doanh hay khách hàng KiotViet. Admin tiếp tục duyệt qua hồ sơ sỉ hiện có để quyền giá sỉ có hiệu lực.
- Chuyển khách sỉ về lẻ: bỏ vai trò si, khóa trạng thái sỉ, giữ hồ sơ và liên kết KV. Giá mới dùng dữ liệu tài khoản hiện tại; lịch sử đơn không đổi. Tài khoản bị khóa vẫn bị khóa khi đổi quyền.

API `PATCH /api/shop/admin/accounts/:id/permissions` chỉ dành cho manager/admin đang hoạt động. Zod validate payload và snapshot quyền; không nhận quyền nhân viên/admin. So sánh roles, trạng thái và permissionsRevision trước khi lưu; CAS kiểm tra thêm mã CTV, điện thoại và applicationRevision. Thay đổi quyền cùng bản ghi audit được ghi nguyên tử trong tài khoản. Unique index ctvCode chặn cấp trùng, trả 409 khi trùng mã hoặc hồ sơ thay đổi. Audit lưu actor, lý do, thời điểm, quyền trước/sau trong permissionsAudit; không trả audit qua API hồ sơ khách công khai.

Session khách hiện có vẫn dùng được. Backend kiểm tra quyền mua sỉ/CTV từ tài khoản; frontend lấy lại `/me` mỗi 30 giây. Reload storefront để thấy nhãn/giá mới ngay; không ép đăng xuất hoặc đặt lại mật khẩu.

Kiểm tra: `npm run typecheck:api`, `npm run typecheck:web`, `node --import tsx --test tests/account-permissions.test.ts` (đặt TEST_MONGO_URI để chạy database thử riêng, không cập nhật tài khoản thật).
