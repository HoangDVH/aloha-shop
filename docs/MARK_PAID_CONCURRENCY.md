# Kiểm tra xác nhận thanh toán đồng thời

Ngày 16/10/2026: đã đọc trực tiếp `/root/aloha-shop/backend/shopOrders/markPaid.ts` trên VPS. Bản triển khai vẫn cho luồng thua claim nhận lại đơn `processing` và đi tiếp; một lời gọi đọc sẵn `processing` cũng được chạy tiếp.

Test hồi quy tái hiện được lỗi với admin, SePay và KiotQR cùng đọc trạng thái unpaid trước khi claim. Việc trừ tồn từng SKU atomic không ngăn cùng một đơn gọi trừ kho nhiều lần; `stockApplied` chưa được ghi tại thời điểm các luồng đọc đơn.

Bản sửa:

- Chỉ luồng chuyển trạng thái hợp lệ sang `processing` thành công bằng `findOneAndUpdate` mới được gọi KiotViet và trừ kho.
- Luồng thua hoặc thấy `processing` trả `payment_processing`; không sửa mã giao dịch hay tiếp tục tác vụ.
- Mỗi claim có `paymentClaimId` ngẫu nhiên. Lưu kết quả hóa đơn, ghi lỗi và chốt paid đều kiểm tra `_id + processing + paymentClaimId`.
- Nếu mất quyền xử lý trước bước lưu hóa đơn thì dừng trước bước kho; nếu mất quyền chốt đơn thì không phát sự kiện thành công hay ghi sử dụng voucher.
- Xử lý đúng cả kết quả MongoDB trả trực tiếp document và kiểu cũ `{ value: null }`.
- Đơn paid trả `alreadyPaid`; đơn đã có `stockApplied` không trừ thêm.

Giới hạn vận hành: không tự tiếp quản claim processing cũ. Khi tiến trình dừng giữa thao tác KiotViet/trừ kho và chốt paid, phải đối soát hóa đơn, khoản thu và kho trước khi phục hồi. Không đặt lại unpaid/failed một cách mù quáng. Bản sửa không bổ sung giao dịch phân tán hoặc khóa idempotency phía KiotViet; lỗi mạng có kết quả từ xa chưa xác định vẫn cần đối soát trước khi retry trạng thái failed.

Không tạo hóa đơn, xác nhận tiền hay sửa tồn trên hệ thống thật trong quá trình kiểm tra. Chưa triển khai bản sửa lên VPS.
