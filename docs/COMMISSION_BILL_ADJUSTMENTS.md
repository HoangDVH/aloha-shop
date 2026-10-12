# Hoàn/hủy hoa hồng và đối soát kỳ chi

## Hành vi

- Chưa chốt kỳ: hủy commission, không đưa khoản đó vào kỳ chi.
- Đã chốt, chưa chi: giữ `gross` gốc, thêm `adjustmentEntries` gồm mã đơn/SKU, số tiền âm, lý do, thời điểm. `adjustments`, `net` và tổng bill được tính lại từ các commission đã gắn kỳ.
- Ví dụ: gross 80.000đ, hoàn 30.000đ → adjustments −30.000đ, net 50.000đ. Hoàn lặp lại không tăng điều chỉnh lần nữa.
- Hủy hết: khoản chi có `voidedAt`, bill không có khoản đã chi chuyển `cancelled`. Không tạo `paidAt` giả cho khoản hủy. Bill có một CTV đã chi và CTV khác bị hủy có thể hoàn tất nhưng khoản hủy vẫn hiển thị riêng.
- Đã chi: giữ nguyên số tiền/lịch sử đã chi, thêm ledger clawback và nợ `ctvBalanceDebt`. Khoản thu hồi sau chi hiển thị riêng, không sửa số tiền ngân hàng đã chuyển.
- Kỳ sau: nợ được dự kiến bù trừ theo thứ tự kỳ được chốt, tránh dùng cùng khoản nợ ở hai bill đang chờ. Giảm nợ thực tế chỉ khi xác nhận kỳ chi/bù trừ; có ledger `debt_offset`. Khoản clawback được đánh dấu số đã thu hồi, hỗ trợ thu hồi một phần.
- `net=0` do bù trừ nợ có thể xác nhận bù trừ, khác với một khoản chi đã bị hủy hết.
- Điều chỉnh thủ công không bị tính hai lần khi vừa có ngày đủ điều kiện vừa có kỳ mục tiêu.

## Xác nhận chi

`POST /api/shop/admin/ctv/bills/:period/mark-paid` yêu cầu `expectedRevision` và `expectedAmount` (số nguyên không âm), cùng `ctvCode` nếu chỉ xác nhận một CTV. Khi xác nhận cả kỳ, amount là tổng các dòng còn chờ, không bao gồm dòng đã chi/hủy.

Server phục hồi tác vụ chưa xong và đối soát bill trước khi so sánh. Màn hình cũ trả HTTP 409 `bill_changed` hoặc `bill_confirmation_required`; admin phải tải lại và xác nhận số tiền mới. Mọi điểm gọi trong admin hiện tại và legacy đã gửi thông tin xác nhận. Client cũ không gửi các trường này sẽ bị chặn có chủ đích, thay vì được phép xác nhận số cũ.

Đây là ghi nhận shop đã chi/bù trừ, không phải lệnh chuyển tiền ngân hàng.

## Đồng bộ giao diện và Excel

- Admin hiển thị số điều chỉnh, lý do hoàn/hủy, bù trừ nợ và khoản thu hồi sau chi.
- CTV chỉ nhận phần bill của mình, nhìn thấy số tiền và lý do tương ứng. Thống kê tiền đã nhận dùng số trên bill sau bù trừ, không dùng tổng commission gốc để thay thế.
- Excel `ChiHH` chỉ có dòng còn phải chuyển tiền; dòng đã chi, hủy hoặc bù trừ hết không xuất lại để chuyển lần nữa. `LichSu` giữ tất cả các dòng; `ThieuSTK` dành cho dòng cần chuyển nhưng chưa có tài khoản ngân hàng.
- Bill cũ chưa chi được đối soát khi truy cập báo cáo hoặc xác nhận, không chạy migration hàng loạt. Bill đã chi giữ lịch sử.

## An toàn và phục hồi

Mongo hiện tại standalone, không có transaction nhiều collection. Các thao tác chốt kỳ, hủy, xác nhận chi, clawback và đối soát dùng cùng khóa Mongo tại `aloha_shop_finance_locks` / `_id=ctv_settlement`; không dùng khóa RAM hay Redis làm bảo đảm tài chính.

- Các bước xác nhận chi có journal `paymentPending`; ghi nhận lại cùng operation ID không trừ nợ hai lần.
- Account lưu ID clawback/settlement đã áp dụng trong `ctvDebtEntries`/`ctvDebtSettlements`, cập nhật marker và số dư trong cùng một lệnh atomic. Journal nợ chưa hoàn tất được xử lý trước khi tính kỳ chi tiếp theo.
- Chốt kỳ có trạng thái `locking` và danh sách commission IDs để phục hồi; chỉ nhận các dòng vẫn eligible/chưa được gắn bill.
- Không cho engine tính lại hoa hồng ghi đè một dòng đã billed/paid_out hoặc đã gắn kỳ.
- Request lỗi thông thường giải phóng khóa trong `finally`; lần yêu cầu tiếp theo xử lý nốt journal và tính lại snapshot.
- Khóa không có TTL tự cướp quyền. Nếu process chết khi giữ khóa, API sẽ chặn tài chính bằng `finance_busy`. Người vận hành phải kiểm tra `host`, `pid`, `owner`, dừng tất cả API/worker tài chính dùng DB đó và chắc chắn chủ khóa đã dừng trước khi xóa đúng khóa theo owner. Không xóa khóa của process còn chạy. Sau khi khởi động lại, mở báo cáo để journal được phục hồi.
- Triển khai các API/worker dùng engine mới cùng nhau trước khi vận hành tài chính; bản cũ không biết khóa/phiên bản bill mới.

## Kiểm thử

`TEST_MONGO_URI` trỏ Mongo thử; `tests/commission-bill-adjustments.test.ts` tạo DB riêng prefix `aloha_shop_test_` và chặn outbound. Có ca về 80k→50k, xác nhận cũ, hủy hết, trả trùng, hoàn sau chi, lỗi giữa chừng, bù trừ nhiều kỳ, bill chi một phần, retry đơn hủy, điều chỉnh thủ công, API/CTV/Excel và cạnh tranh hoàn–chi.

Chạy: `node --import tsx --test tests/commission-bill-adjustments.test.ts`, `npm run typecheck:api`, `npm run typecheck:web`.

Kết quả ngày 12/10/2026: 12 ca mới đạt; 3 ca về journal/nợ/API chạy lại sau kiểm tra bảo vệ cuối cũng đạt. Typecheck backend/frontend và giới hạn dòng đạt. Full suite: 644 ca, 630 đạt, 6 lỗi đã tồn tại từ audit trước, 8 bỏ qua (gợi ý tìm kiếm cần API live). Không coi full suite là xanh. API local health OK; route admin trả 200, chưa kiểm tra trực quan do không có browser session.
