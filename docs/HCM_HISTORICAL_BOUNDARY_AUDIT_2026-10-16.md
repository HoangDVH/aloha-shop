# Rà soát địa chỉ lịch sử TP.HCM — 16/10/2026

Rà 348 cặp quận–phường duy nhất: 273 cặp trong snapshot hiện tại, các phường số đã đổi từ năm 2020/2024, và địa chỉ dùng tên Quận 2, Quận 9, Quận Thủ Đức trước năm 2021. Đây là tập địa chỉ được kiểm tra, không phải cam kết nhận diện mọi cách viết tự do.

Trước lần mở rộng này: 282 đúng, 66 chưa nhận diện. Số 282 đã bao gồm 9 tên phường Quận 8 sửa ở lượt trước.

| Quận cũ | Số cặp bổ sung bị chặn sai |
| --- | ---: |
| Quận 3 | 5 |
| Quận 4 | 5 |
| Quận 5 | 5 |
| Quận 6 | 4 |
| Quận 10 | 4 |
| Quận 11 | 6 |
| Bình Thạnh | 5 |
| Gò Vấp | 4 |
| Phú Nhuận | 4 |
| Quận 2 | 11 |
| Quận 9 | 13 |

Nguyên nhân: snapshot bắt đầu sau các đợt sáp nhập trước năm 2025, thiếu tên phường đã bỏ và tên quận trước khi thành lập TP Thủ Đức. Bộ nhận diện cần đúng cả quận và phường nên những tên này trả về `needs_review` dù nằm trong phạm vi kinh doanh TP.HCM cũ.

Đã thay bản vá riêng Quận 8 bằng danh sách cặp lịch sử dùng chung, có phiên bản. Danh sách chỉ xác định ranh giới kinh doanh, không tự đổi địa chỉ giao hàng, mã GHN hoặc địa chỉ KiotViet. Trường hợp phường cũ bị chia nhưng tất cả phần đều thuộc TP.HCM cũ vẫn đủ căn cứ xác định khu vực HCM.

Nguồn đối chiếu:

- [Nghị quyết 1278/NQ-UBTVQH15, Điều 1](https://xaydungchinhsach.chinhphu.vn/nghi-quyet-1278-nq-ubtvqh15-sap-xep-don-vi-hanh-chinh-cap-xa-cua-thanh-pho-ho-chi-minh-119241122153826282.htm).
- [Nghị quyết 1111/NQ-UBTVQH14, Điều 1–2](https://congbao.chinhphu.vn/van-ban/nghi-quyet-so-1111-nq-ubtvqh14-32796/33933.htm).
- Snapshot hành chính và nguồn dữ liệu đã ghi trong `backend/shopShipping/addressMigration/README.md`.

Sau sửa: **348/348 đúng**. Kiểm tra cặp sai quận, phường không tồn tại, địa chỉ mới trùng tên, và địa chỉ Bình Dương/Bà Rịa–Vũng Tàu cũ giữ nguyên giới hạn. **67 kiểm thử đạt**, TypeScript API đạt.

Kết quả có thể tái lập bằng `artifacts/hcm-boundary-audit.ts`; đối chiếu `artifacts/hcm-boundary-before.json` và `artifacts/hcm-boundary-after.json`. Kiểm tra chạy bằng fixture, không sửa tài khoản hoặc tạo đơn thật. Chưa commit/push/triển khai trong lượt này.
