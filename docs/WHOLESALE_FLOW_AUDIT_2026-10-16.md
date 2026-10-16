# Rà soát toàn luồng khách sỉ — 16/10/2026

## Cập nhật sau khi sửa

Theo yêu cầu tiếp theo của người dùng, giữ nguyên phần vận chuyển/khách tự bố trí xe (phát hiện 1). Phát hiện 2 và 3 đã được sửa local: kiểm tra đầy đủ địa chỉ theo HCM cũ tại checkout, quote và admin; chặn worker khi nhóm trong đơn khác nhóm hiện tại hoặc thiếu snapshot nhóm; kiểm tra lại điều kiện mua trên giá đã chấp thuận trước POST KiotViet; đọc lại account và giữ CAS của đơn trước gửi. Không tự đổi giá/tổng đơn. Đơn bị chặn chuyển chờ kiểm tra.

Các test hồi quy mới đã tái hiện lỗi trước sửa, rồi đạt sau sửa. Bộ test liên quan sau sửa: 60 test đạt. Nội dung bên dưới là bằng chứng và kết luận tại thời điểm audit trước khi sửa; phần vận chuyển được giữ ngoài phạm vi sửa theo yêu cầu. Chưa push/deploy.

## Kết luận

Chưa khớp hoàn toàn chính sách. Quyền giá, mức tiền tối thiểu, số lượng theo mẫu và chống xử lý thanh toán trùng đã có kiểm tra, nhưng có ba khoảng trống giữa checkout, vận chuyển và đồng bộ đơn sỉ. Ngoài ra luồng đăng ký/phân vùng tự động mới làm còn local, chưa có trong bản web đang chạy.

## Phiên bản và cách kiểm tra

- Local HEAD: b6e71d2, có các sửa chưa commit về đăng ký sỉ/phân vùng HCM cũ và cache nội dung.
- PM2 `aloha-shop-api` và `aloha-shop` đang chạy thư mục phát hành `20261016T035357-b6e71d21f5e0`. Đây mới là bản runtime; `/root/aloha-shop` là checkout cũ d22a15b, không được dùng thay cho bằng chứng runtime.
- API chính sách công khai trả 200, version 2026-10-13.1. Cờ trong cấu hình của release bật đồng bộ đơn sỉ và cấp khách KiotViet. Cờ bắt buộc quote ship không được đặt; helper server mặc định không bắt buộc, nhưng vẫn kiểm tra/cộng phí khi client gửi quote hợp lệ.
- Chạy 139 test liên quan: tất cả đạt. Đây là các test có phạm vi kiểm soát; không đồng nghĩa mọi tổ hợp xuyên nhiều module đã đúng.
- Bổ sung script mô phỏng các nhánh thiếu kiểm tra: `artifacts/wholesale-flow-audit.ts`; kết quả `artifacts/wholesale-flow-audit-results.json`.
- Không đăng ký tài khoản thật, tạo đơn, giữ kho thật, thu tiền, tạo hóa đơn hoặc gọi POST sang KiotViet. Chưa kiểm thử mua hàng thực tế qua trình duyệt trên tài khoản khách.

## Chính sách đối chiếu

| Nội dung | Sỉ HCM | Sỉ tỉnh |
| --- | --- | --- |
| Phạm vi | TP.HCM cũ theo yêu cầu người dùng | Bao gồm Bình Dương/BRVT cũ, dù tên tỉnh hiện tại là TP.HCM |
| Giá | Giá sỉ của sản phẩm; thiếu giá phải báo giá | Tương tự |
| Tiền hàng | Đơn đầu từ 2.000.000đ; khách có lịch sử hợp lệ được miễn mức tối thiểu | Mỗi đơn từ 2.000.000đ |
| Cây thành phẩm | Không áp số lượng tối thiểu theo mẫu của tỉnh | Tối thiểu 5/mã |
| Cây thô | Không áp số lượng tối thiểu theo mẫu của tỉnh | Tối thiểu 10/mã |
| Chậu/tiểu cảnh dưới 15.000đ | Không áp số lượng tối thiểu theo mẫu của tỉnh | Tối thiểu 5/mã |
| Chậu từ 15.000đ và nhóm khác | Theo nhu cầu | Không bị áp ngưỡng 5 của chậu giá thấp |
| Vận chuyển HCM | Chính sách đăng ký ghi khách tự bố trí xe; nhận tại cửa hàng hoặc HCM | Theo phương án/báo giá vận chuyển của đơn |

Tiền tối thiểu được xét trên tiền hàng trước giảm giá đơn, không tính phí ship/quà. Các dòng cùng mã cộng số lượng; khác mã màu/kích thước tính riêng. Voucher hỗ trợ ship có thể có cờ ngoại lệ HCM/tỉnh; không mặc định mở mọi voucher cho khách sỉ.

## Đối chiếu từng bước

| Bước | Kết quả |
| --- | --- |
| Đăng nhập, hồ sơ, đồng ý điều khoản | Có kiểm tra bắt buộc, quyền sở hữu SĐT và phiên đăng nhập; không cho mở lại quyền bị khóa bằng đăng ký lại |
| Đăng ký xong xem giá sỉ ngay | Đã sửa local; runtime vẫn tạo cho_duyet và phải chờ admin |
| Tự gán HCM cũ/tỉnh | Đã sửa local, có snapshot và kiểm tra địa chỉ trùng/không chắc; runtime chưa có |
| Admin kiểm tra sau | Local đưa active/pending vào hàng chờ xác minh; admin vẫn có thể khóa, yêu cầu bổ sung, phân nhóm |
| Catalog và trang chủ | Giá theo quyền DB, không tin riêng role JWT cũ; local nhận tài khoản mới ngay cả trước khi rõ vùng. Ưu tiên tồn kho/doanh thu có test |
| Thiếu giá sỉ | Trả si_missing và chặn đặt; không âm thầm dùng giá lẻ |
| Kiểm tra HCM đơn đầu | Dưới 2 triệu bị chặn; đủ 2 triệu được phép; lịch sử unknown không tự được miễn |
| Kiểm tra tỉnh | Kiểm tra mỗi đơn 2 triệu và từng mẫu; cả khách cũ vẫn phải đáp ứng |
| Đổi số lượng/giá khi checkout | Server tính lại giá, số lượng, tồn và điều kiện; có thông báo khi giá đổi |
| Chờ hàng/khách KV | Lưu yêu cầu trên web, giữ phần có sẵn, chờ liên kết khách; không tự lập hóa đơn ẩn danh |
| Vận chuyển HCM | Chưa khớp; xem phát hiện 1 và 2 |
| Gửi đơn sang KV | Có outbox, lease, kiểm tra khách và nhóm KV; thiếu kiểm tra thay đổi nhóm/chính sách của đơn, xem phát hiện 3 |
| Chờ xác nhận/thanh toán | Đơn ban đầu chưa thu tiền; claim thanh toán và stockApplied có test chống thực thi trùng; kiểm thử thật chưa thực hiện |

## Phát hiện 1 — Medium: vận chuyển HCM chưa nhất quán

Điểm liên quan:

- `frontend/app/(storefront)/xac-nhan-don-hang/page.tsx`: showShip lấy từ cờ chung, không tách HCM tự bố trí xe.
- `frontend/components/checkout/usePlaceOrder.ts`: nếu showShip và giao tận nơi thì đòi quoteToken cho mọi nhóm.
- `backend/shopOrders/orderCreateRoutes.ts`: truyền cố định `customerArranged: false`.
- `backend/shopOrders/create/orderDoc.ts` và `backorder.ts`: lưu cố định `shippingHandling: shop_arranged`.
- Admin confirm-shipment chỉ chặn customer_arranged, hoặc HCM legacy chưa có shippingHandling; vì vậy bản ghi mới shop_arranged không được chặn theo nhánh dự phòng HCM.

Ví dụ: khách HCM chọn nhận tại địa chỉ trong HCM, tự đặt xe. Frontend có thể yêu cầu quote carrier; nếu quote có phí thì server có thể giữ phí đó. Mô phỏng helper với cờ bắt quote trả 400 ở nhánh hiện tại, trong khi nhánh customer_arranged hợp lệ trả phí 0. Bản dựng đơn HCM giữ shop_arranged và phí đầu vào 30.000đ, không có bước ép về đúng chính sách tự nhận.

Giải pháp: xác định phương thức vận chuyển từ account/quy tắc server; dùng cùng kết quả cho quote UI, kiểm tra server, lưu đơn, hiển thị tổng và admin shipment. Không tin cờ tự nhận do client tự khai. Nếu cho phép HCM chọn shop giao như một ngoại lệ, cần biểu diễn lựa chọn/chính sách đó rõ ràng thay vì ghi ngầm shop_arranged.

## Phát hiện 2 — Medium: HCM cũ chưa được áp ở nơi nhận

`backend/shopWholesale/purchasePolicy.ts` chỉ so tên province với Hồ Chí Minh cho khách HCM nhận tại địa chỉ. Không xét district/ward trong điều kiện nhận hàng này; các caller cũng chỉ truyền province.

Ví dụ: tài khoản HCM cũ có lịch sử mua, nhận tại Lái Thiêu/Thuận An, tên tỉnh mới Hồ Chí Minh. Bộ phân nhóm đăng ký mới xác định địa chỉ đó là TINH, nhưng kiểm tra nơi nhận hiện tại vẫn trả canCheckout=true theo chính sách HCM.

Giải pháp: truyền đầy đủ địa chỉ và dùng bộ phân vùng HCM cũ tại bước kiểm tra nơi nhận; địa chỉ không rõ phải xác nhận. Nhận tại cửa hàng vẫn là trường hợp hợp lệ riêng. Không chỉ kiểm tra tên tỉnh mới.

## Phát hiện 3 — High: đổi nhóm sau đặt đơn chưa chặn trước POST KiotViet

`backend/shopOrders/wholesaleSync.ts` kiểm tra khách và nhóm KV hiện tại, giá snapshot có nhãn si, trạng thái/lease/đồng ý chính sách. Nhưng không so nhóm lúc đặt với nhóm hiện tại và không gọi lại bộ kiểm tra chính sách trước gửi. Việc đọc eligibility trong trang admin hoặc kiểm tra khi admin queue thủ công không bảo vệ đường chạy tự động này.

Ví dụ đã mô phỏng: đơn của khách HCM cũ, 1 cây thành phẩm giá 100.000đ. Trước khi worker xử lý, admin đổi tài khoản và nhóm KV sang TINH. Kiểm tra chính sách hiện tại từ chối vì thiếu 2 triệu và thiếu 5/mẫu; worker vẫn gọi hàm gửi giả một lần và đánh dấu synced.

Giải pháp: nếu nhóm trong đơn khác nhóm hiện tại thì chuyển needs_review, không gửi. Trước POST cần kiểm tra điều kiện trên snapshot giá khách đã chấp thuận, chính sách áp dụng và địa chỉ đầy đủ. Nếu cần đổi giá/số lượng/nhóm thì đi qua luồng đề xuất và khách xác nhận lại. Giữ CAS/lease để thay đổi sau kiểm tra không lọt qua. Không tự đổi tổng tiền hoặc âm thầm chuyển đơn sang chính sách mới.

## Thứ tự xử lý đề xuất

1. Chặn đồng bộ khi nhóm khách thay đổi và bổ sung kiểm tra điều kiện trước gửi KV.
2. Đồng nhất vận chuyển HCM giữa frontend, server, lưu đơn và thao tác admin.
3. Áp HCM cũ cho địa chỉ nhận hàng, không chỉ đăng ký.
4. Triển khai trọn bộ đăng ký/mở giá/phân vùng tự động đã làm local; kiểm thử staging hai tài khoản HCM/tỉnh từ đầu tới cuối bằng dữ liệu thử.

Ba phát hiện trên chưa được sửa source trong lần audit này. Chưa push/deploy. Các test hiện có đạt nhưng cần bổ sung test tích hợp cho ba kịch bản đã tái hiện trước khi kết luận luồng hoàn chỉnh.
