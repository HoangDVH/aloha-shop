# Kế hoạch ưu đãi và voucher Aloha

Ngày lập: 28/09/2026. Trạng thái: đề xuất để triển khai, chưa viết code tính năng.

## 1. Mục tiêu và quyết định kiến trúc

Cho phép chủ shop tự tạo, điều chỉnh, lên lịch và dừng ưu đãi trong admin; website tự tính theo cấu hình. “Tự động điều chỉnh” được hiểu là admin đổi cấu hình và hệ thống áp dụng tự động, không phải thuật toán tự đổi mức giảm theo doanh thu.

Hai nhu cầu ban đầu: khách mua web lần đầu giảm 10%; đơn trên một triệu được giảm theo mức cấu hình. Mức “10$” trong yêu cầu chưa rõ đơn vị, chưa được chuyển thành giá trị mặc định.

Đề xuất một mục **Ưu đãi** trong admin, gồm chương trình tự động, mã giảm giá và khu vực kết nối voucher KiotViet. Bộ tính tiền dùng chung đặt trong backend hiện tại. Chưa cần dịch vụ độc lập.

- Aloha quyết định điều kiện ưu đãi web và lưu kết quả tại thời điểm đặt đơn.
- KiotViet nhận số tiền giảm của đơn web. Đối soát cả chiều gửi và chiều nhận.
- Voucher KiotViet là luồng tích hợp riêng, chỉ mở dùng thực tế sau khi xác minh hợp đồng API và vòng đời thanh toán.
- Học cách tổ chức thiết lập của KiotViet và trải nghiệm chọn mã của sàn; giữ màu sắc, thành phần và ngôn ngữ Aloha.
- Mọi mức giảm, trần giảm, ngưỡng, ngày và đối tượng đều cấu hình được. Không gắn cố định chương trình vào code.

## 2. Nguồn tham khảo và giới hạn xác minh

### 2.1. Những gì đã xác nhận

| Nguồn chính thức | Quan sát dùng làm cơ sở |
|---|---|
| [KiotViet — Voucher](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-voucher/voucher/) | Quản lý theo đợt phát hành, điều kiện, phạm vi, mã và lịch sử; voucher có vai trò thanh toán. |
| [KiotViet — Public API](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ket-noi-api/public-api/) | Mục 2.24 có GET `/vouchercampaign`, GET `/voucher` theo `campaignId`; có tạo/phát hành mã. Tạo giao dịch có `Payments` với phương thức Voucher. Chưa tìm thấy API công khai đọc toàn bộ tab Khuyến mại. |
| [Shopee — Sử dụng voucher](https://help.shopee.vn/portal/4/article/79487) | Khách có thể chọn mã đã lưu hoặc nhập mã khi thanh toán. |
| [Shopee — Kho voucher](https://help.shopee.vn/portal/4/article/79049) | Có sắp xếp và tra cứu mã đã dùng/hết hiệu lực. |
| [Lazada — Điều kiện trợ phí vận chuyển](https://pages.lazada.vn/wow/i/vn/VNCampaign/dieu-kien-tro-phi-van-chuyen) | Điều kiện vận chuyển được trình bày riêng; mức ngưỡng ở trang này chỉ là ví dụ chiến dịch. |
| [Shopify — Loại giảm giá](https://help.shopify.com/en/manual/discounts/discount-types) | Hỗ trợ giảm phần trăm, số tiền và tự động hoặc bằng mã. |
| [Shopify — Kết hợp ưu đãi](https://help.shopify.com/en/manual/discounts/discount-combinations) | Có quy tắc kết hợp theo loại ưu đãi. |
| [commercetools — Cart Discounts](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work) | Tính lại theo thay đổi giỏ, có thứ tự và quy tắc kết hợp. |

Đã đọc tài liệu công khai; chưa đăng nhập khảo sát trực tiếp các ứng dụng, chưa gọi API bằng tài khoản KiotViet của shop. Các bố cục, trạng thái và chính sách ở phần tiếp theo là thiết kế đề xuất cho Aloha, không khẳng định là bản sao hoặc quy chuẩn bắt buộc của các hãng.

### 2.2. Phân biệt ba đối tượng

| Đối tượng | Vai trò trong Aloha | Nguồn quản lý |
|---|---|---|
| Ưu đãi tự động | Đủ điều kiện thì giảm, không cần mã | Admin Aloha |
| Mã giảm giá Aloha | Kích hoạt chương trình giảm giá bằng mã | Admin Aloha |
| Voucher KiotViet | Phiếu có giá trị dùng thanh toán, cần xử lý phương thức thanh toán | KiotViet; Aloha chỉ tích hợp phần được hỗ trợ |

Không tự biến voucher thanh toán thành chiết khấu: dễ sai tổng đã trả, số tiền còn phải thu và báo cáo. Không hứa tạo/sửa đợt voucher KiotViet từ Aloha khi chưa xác minh API cho thao tác đó.

## 3. Chính sách ban đầu đề xuất

| Thuộc tính | Khách mới | Đơn lớn |
|---|---|---|
| Kích hoạt | Tự động | Tự động |
| Điều kiện | Chưa có lần mua web thành công | Tiền hàng đủ điều kiện vượt 1.000.000đ |
| Mức giảm | 10% | Chưa chốt: phần trăm hoặc VND |
| Trần giảm | Admin bắt buộc nhập trước kích hoạt | Bắt buộc nếu giảm phần trăm |
| Đối tượng mặc định | Khách lẻ | Khách lẻ |
| Kết hợp | Chọn một ưu đãi toàn đơn tốt nhất | Cùng nhóm loại trừ với khách mới |
| Lượt dùng | Một lần cho khách mới | Cấu hình theo khách và toàn chương trình |

Các mặc định này cần được xác nhận trước khi chạy thật, không tạo chương trình đang hoạt động khi triển khai code.

- “Trên” là `>`; “từ” là `>=`. Admin chọn rõ, bản tóm tắt dùng đúng từ.
- Tiền xét ngưỡng là tổng giá bán hợp lệ của hàng thuộc phạm vi, sau giảm riêng sản phẩm và trước giảm toàn đơn; không cộng ship. Giữ đúng chế độ thuế/giá hiện có, không tự cộng hay trừ VAT lần nữa.
- Hàng ngoài phạm vi không góp vào ngưỡng và không nhận giảm. Đây là quy tắc mặc định thống nhất, có giải thích ngay trên form.
- Khách từng mua cửa hàng vẫn được hưởng lần đầu web nếu chưa có giao dịch web thành công.
- Ưu đãi phần trăm tính trên tiền hàng đủ điều kiện, giới hạn bởi trần; số tiền cố định không vượt tiền hàng đủ điều kiện.
- Bản đầu cho một ưu đãi toàn đơn, có thể kết hợp chính sách ship hiện tại nếu admin cho phép. Không xây tùy chọn cộng dồn mà backend chưa hỗ trợ.
- Các bậc đơn lớn cùng nhóm: chọn mức tiết kiệm lớn nhất. Khi bằng nhau, dùng thứ tự ưu tiên ổn định rồi ID để kết quả không nhảy giữa các lần tính.

## 4. Thiết kế admin

### 4.1. Điều hướng và danh sách

Thêm menu **Ưu đãi**, route đề xuất `/admin/uu-dai`, dùng AdminShell và Ant Design hiện tại.

Các tab:

1. **Chương trình:** danh sách và thiết lập ưu đãi web.
2. **Mã giảm giá:** mã chung, mã riêng và lịch sử sử dụng.
3. **Voucher KiotViet:** đợt và mã đồng bộ; hiển thị nguồn, lần cập nhật, trạng thái kết nối.
4. **Báo cáo:** số lượt, tiền giảm, đơn hoàn thành/hủy và hiệu quả theo chương trình.

Danh sách chương trình: tên, loại, mức giảm, điều kiện ngắn, thời gian, trạng thái, lượt giữ/đã dùng, ngân sách và thao tác. Lọc theo trạng thái, loại, thời gian; tìm tên/mã. Phân trang phía server.

Trạng thái hiển thị: Nháp, Sắp diễn ra, Đang áp dụng, Tạm dừng, Hết hạn, Hết lượt/ngân sách. Trạng thái cuối phụ thuộc dữ liệu thực tế; backend kiểm tra thời gian khi tính tiền dù tác vụ lịch chưa chạy.

Thao tác: Tạo, Sửa, Nhân bản thành nháp, Xem trước, Tạm dừng, Lưu trữ. Chương trình đã có giao dịch được lưu trữ thay vì xóa lịch sử.

### 4.2. Form tạo/sửa

Desktop dùng form bên trái, bản tóm tắt và thẻ ưu đãi xem trước bên phải. Mobile một cột, nút lưu ở cuối màn hình không che trường nhập.

| Nhóm | Trường cần có | Kiểm tra và hướng dẫn |
|---|---|---|
| Thông tin | Tên nội bộ, tiêu đề khách thấy, mô tả, ghi chú | Không đưa ghi chú nội bộ ra storefront |
| Cách dùng | Tự động / Nhập mã | Chọn nhập mã mới hiện phần mã |
| Giá trị | Giảm % / Giảm VND, mức giảm, trần | % lớn hơn 0 và không quá 100; VND nguyên dương |
| Điều kiện | Không ngưỡng / Trên / Từ; giá trị ngưỡng | Cho ví dụ ngay dưới trường |
| Hàng áp dụng | Toàn bộ / Nhóm / Sản phẩm; danh sách loại trừ | Tìm sản phẩm từ catalog, loại trừ có ưu tiên |
| Khách | Khách lẻ, khách sỉ, nhóm/khách chỉ định, lần đầu web | Mặc định khách lẻ; nhóm nâng cao triển khai sau |
| Thời gian | Bắt đầu, kết thúc | Hiển thị Asia/Ho_Chi_Minh; lưu UTC; kết thúc sau bắt đầu |
| Giới hạn | Lượt toàn chương trình, lượt/khách, ngân sách | Không cho hạ dưới phần đã dùng cộng đang giữ |
| Kết hợp | Nhóm loại trừ, cho kết hợp ưu đãi ship | Hiển thị kết quả bằng câu dễ hiểu |
| Hiển thị | Công khai / Chỉ người có mã; vị trí hiển thị | Không công khai mã dành riêng khách khác |

Nút: **Lưu nháp**, **Xem thử**, **Kích hoạt/Lên lịch**. Lưu nháp không tự phát hành. Bản tóm tắt ví dụ: “Khách mua web lần đầu được giảm 10%, tối đa …đ; áp dụng cho …; không cộng dồn ưu đãi toàn đơn”.

### 4.3. Xem thử trước khi bật

Admin chọn khách mẫu, sản phẩm/số lượng, cách nhận hàng và thời điểm giả lập. Trả về giá, phạm vi đủ điều kiện, mức giảm từng ứng viên, ứng viên được chọn và lý do loại. Gọi cùng bộ tính với checkout nhưng không giữ lượt, tạo đơn hay gọi ghi KiotViet.

Phát hiện cấu hình thiếu, thời gian sai, ngưỡng khó đạt do phạm vi sản phẩm, trùng mã, hai ưu đãi cùng nhóm và trần quá thấp so với ví dụ. Cho phép lưu nháp chưa đủ nhưng không kích hoạt.

### 4.4. Sửa chương trình đang chạy

- Đổi mức giảm, điều kiện hoặc thời hạn tạo phiên bản mới, có người sửa/thời gian/lý do.
- Trước lưu hiển thị phần thay đổi và số lượt đang giữ; giải thích ảnh hưởng đến đơn mới.
- Giỏ chưa đặt dùng cấu hình mới khi báo giá lại. Nếu tiền thay đổi tại lúc đặt, yêu cầu khách xác nhận giá mới.
- Đơn đã chốt giữ cấu hình và tiền cũ trong thời hạn thanh toán. Tạm dừng chỉ ngăn lượt mới.
- Không tự rút ngắn thời hạn đã hứa với đơn cũ. Trường hợp khẩn cấp phải xử lý đơn riêng với dấu vết thay đổi.
- Dùng revision để phát hiện hai admin sửa đồng thời; không ghi đè im lặng.

### 4.5. Mã giảm giá Aloha

Mã chung cho chiến dịch hoặc mã riêng một lần. Chuẩn hóa mã Aloha bằng trim và chữ hoa; không tự áp dụng chuẩn hóa này cho mã KiotViet chưa xác minh.

Mỗi mã gắn một chương trình, hiệu lực và giới hạn riêng không được nới hơn chương trình. Mã dành riêng gắn khách nhận. Sinh mã bằng nguồn ngẫu nhiên bảo mật và ràng buộc duy nhất trong database.

Giai đoạn mở rộng có nhập hàng loạt và xuất danh sách; phải có xem trước, báo dòng sai/trùng, giới hạn kích thước và quyền xuất. Thao tác giữ mã vào ví không giữ ngân sách hoặc bảo đảm chắc chắn còn lượt lúc thanh toán.

## 5. UI/UX phía khách mua

### 5.1. Vị trí hiển thị

- Trang sản phẩm: thẻ ngắn “Có ưu đãi” và đường dẫn điều kiện. Giá có điều kiện phải ghi rõ; không thay giá bán chính bằng giá chưa chắc khách được hưởng.
- Giỏ hàng: dòng **Ưu đãi Aloha — Đã giảm …đ / Chọn ưu đãi** gần bảng tiền.
- Checkout: giữ lựa chọn từ giỏ, kiểm tra lại theo khách/địa chỉ/phương thức. Không bắt nhập lại mã còn hợp lệ.
- Tài khoản, giai đoạn mở rộng: **Ưu đãi của tôi**, các nhóm Còn hiệu lực / Đã dùng / Hết hạn.
- Chi tiết đơn: tên ưu đãi, số tiền giảm đã chốt và phần hoàn nếu có.

### 5.1.1. Tái sử dụng UI ưu đãi hiện có tại trang xác nhận đơn

Đã kiểm tra source: `frontend/components/checkout/CheckoutSummaryAside.tsx` có thẻ Ưu đãi với icon Ticket, nút “Nhập ưu đãi ›”, nằm trên chi tiết thanh toán desktop và có hiển thị trên mobile. Hiện bấm nút chỉ gọi thông báo “Ưu đãi sẽ sớm có”; chưa có chọn mã hay tính giảm. Trang `frontend/app/(storefront)/gio-hang/page.tsx` cũng có thẻ tương tự, nút mới mang nhãn “Sắp có”. Đây là kiểm tra source, chưa chạy trình duyệt xác nhận hình ảnh thực tế.

**Quyết định thiết kế: dùng lại vị trí, kiểu thẻ, icon, màu và bố cục hiện có; nối chức năng vào thẻ này. Không tạo thêm một thẻ ưu đãi trùng trên cùng trang.**

| Thành phần hiện có | Phần giữ lại | Phần cần bổ sung khi triển khai |
|---|---|---|
| CheckoutSummaryAside | Thẻ Ưu đãi, bố cục responsive/sticky, chi tiết thanh toán và nút đặt hàng | Thay alert bằng bảng chọn; nhận kết quả báo giá từ backend; hiển thị giảm giá và tổng mới |
| Thẻ ưu đãi trang giỏ | Vị trí cạnh tóm tắt, Ticket và kiểu hiển thị | Nối cùng trạng thái lựa chọn với checkout; dùng chung thành phần trình bày khi phù hợp |
| CheckoutStickyBar | Khu vực tiền/nút hành động mobile | Dùng cùng báo giá sau giảm với desktop; hiển thị chi tiết giảm ở phần mở rộng/tóm tắt phù hợp |

Trạng thái thẻ dùng lại:

- Chưa áp dụng: “Ưu đãi” — “Xem ưu đãi / Nhập mã”.
- Đang kiểm tra: “Đang tính ưu đãi…”; không hiện số giảm cũ như kết quả cuối.
- Đã tự giảm: “Đã giảm 80.000đ” — “Xem/Đổi”; dòng phụ “Ưu đãi lần đầu · Tự áp dụng”.
- Mã do khách chọn: hiển thị mã/tên và số giảm; cho đổi/bỏ trong bảng chọn.
- Không đủ điều kiện hoặc mã bị mất hiệu lực: lời giải thích rõ và tổng mới để khách xác nhận.

Hai ưu đãi tự động vẫn trừ dù khách không bấm thẻ. Bấm thẻ chỉ mở chi tiết, đổi hoặc nhập mã như mục 5.5. Tính tiền đặt ở backend, không viết công thức giảm riêng trong CheckoutSummaryAside hoặc CheckoutStickyBar.

Lưu ý luồng hiện tại: phần tóm tắt có thông báo shop gửi hình xác nhận rồi khách mới thanh toán/cọc. Vì vậy hiển thị giảm/tổng là tạm tính khi giá còn chờ shop xác nhận; khi gửi báo giá cuối phải kiểm tra lại ưu đãi và được khách xác nhận. UI không được hứa đã thu tiền hay tiêu thụ mã chỉ vì đang hiện mức giảm.

Nghiệm thu: chỉ một điểm mở bảng ưu đãi trên mỗi khu vực tóm tắt; giỏ/checkout/mobile/desktop dùng cùng dữ liệu; phần tiền hàng, giảm giá, ship và tổng rõ ràng; không còn alert “sắp có”; nút đặt hàng không gửi khi báo giá đang cũ hoặc đang tính. Chỉ bổ sung kế hoạch trong lượt này, chưa sửa các thành phần UI.

### 5.2. Bảng chọn ưu đãi

Desktop dùng hộp thoại; mobile dùng bảng trượt từ dưới, có vùng cuộn và nút xác nhận cố định.

Thứ tự: ô nhập mã; lựa chọn “Tự chọn ưu đãi tốt nhất”; mã đủ điều kiện; mã chưa đủ điều kiện kèm lý do; liên kết xem điều kiện đầy đủ.

Mỗi thẻ: mức giảm lớn nhất, trần, ngưỡng, phạm vi, hạn dùng, trạng thái, tiết kiệm thực tế với giỏ hiện tại. Ưu đãi tốt nhất đánh dấu theo kết quả backend, không chỉ so sánh con số phần trăm.

Hành vi chọn:

- Mặc định ở chế độ tự chọn. Tự áp dụng chương trình tự động; mã yêu cầu chọn/nhập chỉ tham gia sau khi khách chọn hoặc nhập thành công. Việc công khai hay lưu mã vào ví không tự cho phép tiêu thụ mã. Phân loại chi tiết tại mục 5.5; không dò mã bí mật để tự áp dụng.
- Khách có thể chọn một mã cụ thể hoặc bỏ ưu đãi. Chế độ tự chọn/thủ công được lưu rõ.
- Nếu mã thủ công giảm ít hơn, thông báo có lựa chọn tốt hơn, không âm thầm thay mã.
- Nếu mã mất điều kiện, giữ mã để khách hiểu nhưng không tính giảm; nêu lý do và gợi ý chuyển tự chọn.
- Chưa đăng nhập: cho xem ưu đãi công khai, ưu đãi lần đầu ghi “Đăng nhập để kiểm tra”; không khẳng định khách đủ điều kiện.

Ví dụ nội dung: “Mua thêm 120.000đ hàng áp dụng để nhận ưu đãi”, “Mã chỉ dành cho lần mua web đầu tiên”, “Mã đã hết lượt”, “Sản phẩm trong giỏ chưa thuộc chương trình”. Với mã riêng không thuộc khách, trả lời chung, không tiết lộ chủ mã.

### 5.3. Trạng thái và khả năng sử dụng

- Đang tải: giữ bố cục, thông báo đang tính; chặn đặt hàng khi chưa có báo giá hợp lệ.
- Không có ưu đãi: thông báo ngắn; vẫn thanh toán bình thường.
- Lỗi tính ưu đãi: cho thử lại hoặc chủ động bỏ ưu đãi và xác nhận tổng mới. Không âm thầm tính giá cao hơn.
- Lỗi sau khi sửa giỏ: chỉ dùng phản hồi mới nhất, bỏ kết quả cũ về trễ.
- Số tiền và điều kiện hiển thị bằng chữ, không chỉ dùng màu. Hỗ trợ bàn phím, focus khi mở/đóng, nhãn đọc màn hình và thông báo tiền thay đổi.
- Nút chạm tối thiểu 44px; kiểm tra màn hình 360px; không tràn số tiền, không che nút đặt hàng.
- Không dùng đếm ngược giả, số lượt giả hoặc bắt thu thập mã cho ưu đãi vốn tự động.

### 5.4. Bảng tiền minh họa

Giả định giỏ 800.000đ, ưu đãi lần đầu 10% chưa chạm trần, ship 30.000đ:

| Khoản | Số tiền |
|---|---:|
| Tiền hàng | 800.000đ |
| Ưu đãi lần đầu | -80.000đ |
| Vận chuyển | 30.000đ |
| Tổng cần thanh toán | 750.000đ |

Khi tích hợp voucher thanh toán, trình bày thêm “Thanh toán bằng voucher” và “Còn phải trả”; không cộng khoản đó vào số tiền giảm giá.

### 5.5. Quy định rõ khi nào tự trừ, khi nào khách chọn

**Mặc định cho hai chương trình ban đầu: tự tính và tự trừ khi đủ điều kiện. Khách không cần bấm nhận, lưu hoặc nhập mã để hưởng ưu đãi lần đầu và ưu đãi đơn lớn.** Nút “Xem/Đổi ưu đãi” là thao tác tùy chọn.

Cơ sở tham khảo bổ sung ngày 28/09/2026:

- [Tiki — mục VII, Gợi ý mã giảm giá tại giỏ hàng](https://hocvien.tiki.vn/faq/tong-hop-cac-tinh-nang-ho-tro-nha-ban/): tài liệu mô tả gợi ý theo giỏ, tự áp dụng mã tốt nhất trong trường hợp đủ điều kiện và gợi ý ngưỡng mua thêm.
- [Shopee — Hướng dẫn sử dụng voucher](https://help.shopee.vn/portal/4/article/79487): có luồng chọn mã đã lưu hoặc nhập mã khi thanh toán. Nguồn này không chứng minh mọi ưu đãi Shopee đều tự trừ.
- [Shopify — Kết hợp giảm giá](https://help.shopify.com/en/manual/discounts/discount-combinations): có lựa chọn ưu đãi tốt nhất khi các ưu đãi được áp dụng không kết hợp được.

Các nền tảng có nhiều cơ chế cùng tồn tại. Thiết kế Aloha dưới đây kết hợp giảm tự động để ít thao tác với quyền chọn mã của khách; không coi một luồng là quy chuẩn duy nhất của mọi sàn.

| Loại | Hành vi mặc định Aloha | Khách cần làm gì? |
|---|---|---|
| Lần đầu web giảm 10% | Tự áp dụng sau khi xác minh khách đủ điều kiện | Đăng nhập/xác minh khi cần; không bấm nhận mã |
| Đơn lớn theo ngưỡng | Tự áp dụng theo hàng đủ điều kiện | Thêm hàng; không cần mở bảng ưu đãi |
| Nhiều ưu đãi tự động loại trừ nhau | Tự chọn số tiền giảm tốt nhất trong phạm vi hỗ trợ | Có thể xem hoặc đổi lựa chọn |
| Mã chiến dịch yêu cầu nhập/chọn | Chỉ tính sau khi khách đưa mã vào đơn | Nhập mã hoặc chọn từ danh sách rồi xác nhận |
| Mã cá nhân dùng một lần | Gợi ý, không tự dùng chỉ vì có trong ví | Chọn áp dụng để quyết định dùng bây giờ hay giữ lại |
| Voucher KiotViet dùng thanh toán | Không tự tiêu thụ | Chọn phương thức/voucher và xác nhận cùng đơn |
| Chính sách miễn ship tự động | Tính theo cấu hình ship và quy tắc kết hợp | Không chọn mã nếu chính sách không yêu cầu mã |
| Mã giảm ship | Chỉ dùng sau lựa chọn nếu là chương trình yêu cầu mã | Chọn/nhập mã; không làm thay đổi định danh CTV |

Quy tắc admin: “Cách dùng = Tự động” hoặc “Khách chọn/nhập mã” quyết định cơ chế. “Công khai/riêng tư” chỉ quyết định ai nhìn thấy. Không suy ra tự áp dụng từ việc mã công khai. Đổi cách dùng khi đang có giao dịch phải tạo phiên bản, giữ đơn cũ.

Luồng cụ thể:

1. Khách thêm hàng: backend tính ưu đãi tự động, frontend hiển thị ngay “Đã tự áp dụng — giảm …đ” và tổng đã giảm.
2. Chưa nhận diện được khách: chỉ tính các ưu đãi đã xác định; ưu đãi lần đầu hiện lời nhắc đăng nhập, chưa khấu trừ như chắc chắn được hưởng.
3. Khách không mở mục ưu đãi: vẫn nhận ưu đãi tự động tốt nhất và đặt đơn bình thường.
4. Khách mở “Xem/Đổi”: xem các ứng viên, điều kiện và mã dành riêng. Lưu mã chỉ đưa vào ví; nút áp dụng đưa mã vào đơn.
5. Nhập/chọn một mã cụ thể: chuyển sang chế độ thủ công đã mô tả ở mục 5.2. Nếu giảm ít hơn chế độ tự động, hiện hai mức tiền và cho khách chọn; không âm thầm dùng mã cá nhân để đổi lấy lợi ích nhỏ hơn.
6. Thay giỏ: tính lại. Chế độ tự động chọn lại tốt nhất; chế độ thủ công giữ lựa chọn nếu hợp lệ, nếu mất điều kiện thì giải thích và cho chuyển tự động.
7. Bấm đặt hàng: kiểm tra lần cuối và giữ lượt; việc hiển thị “đã áp dụng” trong giỏ chỉ là kết quả báo giá, chưa tiêu thụ mã hay giữ ngân sách.

Ví dụ giỏ 1.200.000đ, giả định giảm lần đầu 10% chưa chạm trần, ưu đãi đơn lớn 100.000đ: mặc định tự giảm 120.000đ; khách không cần bấm gì. Nếu khách sở hữu mã riêng giảm 150.000đ, hiển thị “Bạn có mã giúp giảm thêm 30.000đ — Áp dụng”; chỉ đưa mã đó vào đơn khi khách chọn. Các số tiền này minh họa luồng, không thay quyết định mức “10$” còn mở.

Nhãn đề xuất: “Đã tự áp dụng”, “Xem/Đổi ưu đãi”, “Có mã giảm giá?”, “Áp dụng mã này”, “Quay lại tự chọn tốt nhất”. Tránh nút “Nhận ngay” bắt buộc cho ưu đãi tự động.

Tiêu chí nghiệm thu bổ sung: khách không mở bảng ưu đãi vẫn nhận đủ giảm tự động; mã riêng/voucher thanh toán không bị dùng ngoài ý muốn; chọn hoặc bỏ ưu đãi không đổi người giới thiệu; trạng thái giỏ, checkout và đơn cuối thống nhất. “Tốt nhất” chỉ nói về tập ưu đãi được phép tự áp dụng/đã được khách cho phép xét, không hứa tối ưu mọi mã đang tồn tại.

## 6. Bộ tính tiền và tính nhất quán

Thứ tự đề xuất:

1. Xác thực khách, sản phẩm, số lượng; lấy giá từ catalog theo khách lẻ/sỉ.
2. Xác định hàng đủ điều kiện, các giảm giá sản phẩm đã có và tiền xét ngưỡng.
3. Kiểm tra thời gian, đối tượng, quyền dùng mã, lượt và ngân sách.
4. Tính từng ưu đãi toàn đơn; chọn theo chế độ khách và quy tắc kết hợp.
5. Tính ship bằng luồng hiện có; chính sách miễn ship dùng một cơ sở ngưỡng được định nghĩa rõ, không tạo vòng lặp với giảm giá hàng.
6. Trả bảng tiền và lý do. Khi đặt đơn, tính lại và giữ quyền sử dụng một cách nguyên tử.

VND lưu số nguyên. Làm tròn một lần ở mức giảm toàn đơn; phân bổ theo tỷ trọng tiền hàng đủ điều kiện, chia phần dư theo quy tắc ổn định. Tổng phân bổ phải bằng tổng giảm. Phân bổ phục vụ hoàn hàng/hoa hồng, không gửi vừa phân bổ vừa giảm toàn đơn khiến KiotViet trừ hai lần.

Đơn trả hết bằng giảm giá cần luồng tổng bằng 0 rõ ràng, không tạo QR 0đ; kiểm tra khả năng ghi nhận ở KiotViet trước khi cho cấu hình dẫn đến trường hợp này.

Đơn chờ shop xác nhận/đặt trước: giá và ưu đãi ban đầu là tạm tính nếu hàng còn có thể sửa. Khi gửi xác nhận thanh toán, tính lại, giữ đúng khoản mới và cho khách xác nhận. Đơn đã thanh toán không bị tính lại tự động.

## 7. Lần đầu, giới hạn và vòng đời

Nhận diện khách: tài khoản và số điện thoại đã xác minh, ánh xạ KiotViet nếu có. Cần khảo sát hệ thống xác minh hiện tại; nếu chưa có OTP thì đó là hạng mục cần làm hoặc phải chấp nhận hạn chế chống lạm dụng trước bật ưu đãi lần đầu. Không dùng số nhận hàng tự nhập làm bằng chứng xác minh.

Đếm mọi giao dịch web thành công trước đây, kể cả đơn không dùng ưu đãi. Chuyển khoản thành công hoặc COD giao thành công tiêu thụ quyền lần đầu. Một khách có nhiều tài khoản cùng định danh không được cấp lại. Có quy trình xử lý liên kết/đổi số điện thoại và dữ liệu lịch sử thiếu định danh.

| Sự kiện | Lượt và ngân sách |
|---|---|
| Chỉ xem giỏ/lưu mã | Không giữ |
| Đơn hợp lệ được tạo | Giữ lượt và số tiền giảm |
| Thanh toán thành công / COD hoàn tất | Chuyển giữ thành đã dùng |
| Hủy trước thành công / chuyển khoản hết hạn | Giải phóng đúng một lần |
| COD bị hủy/giao thất bại được xác nhận kết thúc | Giải phóng; không giải phóng khi đơn vẫn đang giao |
| Thanh toán đến muộn sau hết hạn | Đối soát riêng, không tự cấp lại ưu đãi đã hết quyền |
| Hoàn sau thành công | Không tự cấp lại lần đầu; ghi nhận hoàn và điều chỉnh báo cáo riêng |

Đơn chờ xác nhận cần thời hạn giữ có cấu hình và tác vụ rà soát. COD đang hoạt động không giải phóng chỉ vì quá một TTL ngắn; đưa vào danh sách cần xử lý nếu tồn lâu.

Ngân sách khả dụng = ngân sách cấu hình - đã dùng - đang giữ. Phần đã hoàn được báo cáo riêng, mặc định không tự tăng ngân sách để tránh tái sử dụng ngoài dự kiến.

Khóa riêng theo khách không đủ cho ngân sách toàn chương trình. Dùng transaction hoặc cập nhật có điều kiện kết hợp sổ giữ lượt duy nhất; xác minh MongoDB hiện tại hỗ trợ transaction. Nếu chưa hỗ trợ, phải thiết kế cơ chế bù và đối soát trước phát hành. Không dựa vào khóa trong bộ nhớ hoặc TTL xóa tài liệu để giải phóng tiền.

## 8. Dữ liệu và API nội bộ dự kiến

Đây là thiết kế, tên có thể điều chỉnh theo quy ước repo khi triển khai.

| Đối tượng | Nội dung |
|---|---|
| promotions | Điều kiện, phạm vi, hiệu lực, mức giảm, giới hạn, nguồn, revision |
| promotion_versions | Phiên bản bất biến của cấu hình đã kích hoạt |
| promotion_codes | Mã, chương trình, khách sở hữu, hạn, giới hạn |
| promotion_redemptions | Lượt giữ/đã dùng/giải phóng, đơn, khách, tiền, idempotency |
| promotion_audit | Ai sửa gì, giá trị trước/sau, lý do |
| saved_promotions | Mã đã lưu vào ví; chưa cần cho bản đầu |
| kv_voucher_cache | Đợt/mã ngoài hệ thống, thời điểm đồng bộ; không là nguồn xác nhận dùng cuối cùng |

Đơn lưu snapshot: chương trình/phiên bản/mã, cơ sở tính, tổng giảm, phân bổ từng dòng, tiền ship, thuế nếu có, tổng cần trả, tổng đã trả, tiền còn phải thu. Giữ tách các khái niệm dù code cũ dùng tên totalPayment chưa đồng nhất.

Ràng buộc: mã Aloha duy nhất; một thao tác giữ cho một idempotency; chỉ một quyền lần đầu đang giữ hoặc đã dùng cho định danh; giới hạn lượt khách và ngân sách kiểm tra nguyên tử. Retry dùng lại kết quả, không tạo lượt mới.

API đề xuất:

- Admin: liệt kê, tạo/sửa nháp, preview, kích hoạt, tạm dừng, lưu trữ, mã, lịch sử và báo cáo.
- Shop: lấy ưu đãi công khai/thuộc khách; báo giá giỏ; đặt đơn với mã/chế độ chọn và revision báo giá.
- Báo giá trả từng khoản tiền, ứng viên hợp lệ, lý do không hợp lệ, thời hạn báo giá. Báo giá không bảo đảm giữ lượt; đặt đơn mới giữ.
- Phân quyền phía server: xem, sửa, kích hoạt, xuất mã, xem lịch sử. Không chỉ ẩn nút frontend.
- Hạn chế tần suất thử mã; không ghi token hoặc toàn bộ mã riêng vào log công khai.

## 9. KiotViet và đối soát

### 9.1. Ưu đãi web

Gửi một biểu diễn giảm giá thống nhất; ưu tiên giảm cấp đơn cho hai chương trình ban đầu, chỉ quyết định mapping cuối sau kiểm thử giao dịch mẫu. Đọc tổng KiotViet trả về để kiểm tra trước phát hành QR/thu COD.

Xác minh riêng: giảm theo đơn vị hay toàn dòng khi quantity > 1, trước/sau thuế, phí ship là dòng dịch vụ hay phí giao hàng, totalPayment là tiền đã thu. Chưa xác minh thì không suy từ tên trường.

Chiều nhận KiotViet phải đọc đủ giảm cấp đơn, giảm từng dòng, ship và thuế liên quan. Không lấy tổng dòng cộng ship rồi ghi đè tổng đã giảm.

Nếu nhân viên sửa đơn trên KiotViet: phát hiện revision/chênh lệch, tính lại theo chính sách đơn chưa thanh toán, cho khách xác nhận; đơn đã thanh toán đưa vào quy trình điều chỉnh/hoàn thu thêm. Không âm thầm sửa QR đang dùng.

### 9.2. Voucher KiotViet

Giai đoạn đầu chỉ xem đợt/mã và trạng thái đồng bộ. Hiển thị điều kiện đọc được; dữ liệu thiếu không được coi là không có điều kiện.

Trước bật checkout phải kiểm chứng trên gian hàng thử:

- Quyền GET hai endpoint, bộ lọc, phân trang và độ đầy đủ dữ liệu.
- Cách lấy trạng thái mới, giá trị và điều kiện thực tế từng mã.
- Việc dùng Payments/Voucher làm thay đổi trạng thái mã ở thời điểm nào.
- Retry sau timeout, hủy đơn/hóa đơn, khôi phục mã và trường hợp hoàn một phần.
- Một mã đồng thời dùng ở cửa hàng và website: khóa tại Aloha không khóa được POS. Cần KiotViet từ chối tiêu thụ trùng một cách đáng tin cậy; thiếu cơ chế này thì chưa mở thanh toán voucher chung hai kênh.
- Nếu KiotViet lỗi, không xác nhận voucher đã dùng chỉ dựa trên cache. Giữ tình trạng chờ đối soát và cho khách biết, không tự chuyển sang thu thêm tiền.

Không dùng API coupon đánh dấu đã dùng để thay cho voucher. Không dùng phiên đăng nhập API nội bộ làm phụ thuộc vận hành.

### 9.3. Đồng bộ có thể thử lại

Lưu công việc đồng bộ cùng đơn, retry có giới hạn/backoff và mã liên kết ổn định. Nếu KiotViet đã nhận nhưng phản hồi mất, tra cứu trước khi tạo lại. Nếu kết quả chưa rõ, không giải phóng quyền ưu đãi ngay. Có màn hình đối soát đơn lệch tiền/lỗi đồng bộ và thao tác xử lý có nhật ký.

## 10. Hoàn hàng, hoa hồng và báo cáo

- Hoa hồng CTV tính theo giá trị dòng sau phần giảm được phân bổ, theo chính sách hoa hồng chốt tại đơn.
- Hoàn từng phần căn cứ số lượng và giá trị thực trả đã phân bổ. Không tự định giá lại các món đã mua theo chương trình hiện tại.
- Ship hoàn hay không là chính sách riêng. Voucher thanh toán hoàn bằng gì phải chốt và kiểm chứng trước mở tích hợp.
- Báo cáo tách tiền đang giữ, đã dùng, hoàn, hủy; số khách mới, đơn hoàn thành, doanh thu sau giảm, lỗi đồng bộ.
- Không gọi doanh thu đơn dùng mã là “doanh thu tăng thêm” nếu chưa có phép so sánh phù hợp.

## 11. Điểm tích hợp trong repo

Các đường dẫn tương đối từ thư mục dự án; cần kiểm tra lại nếu kế hoạch tách file đã được thực hiện.

| Khu vực | Việc dự kiến |
|---|---|
| frontend/components/admin/shell/AdminSidebar.tsx | Thêm menu ưu đãi |
| frontend/components/admin/shell/AdminShell.tsx | Tái sử dụng shell/provider; không đặt bộ tính ưu đãi ở đây |
| frontend/app/admin/uu-dai/ | Route quản trị mới đề xuất |
| frontend/components/admin/promotions/ | Form, danh sách, preview, báo cáo tách nhỏ |
| frontend/app/(storefront)/gio-hang/page.tsx và thành phần checkout | Tích hợp chọn mã và bảng tiền; tìm đúng nơi checkout đang được mount |
| backend/shopPromotions/ | Module mới đề xuất: validation, evaluator, reservations, routes, repositories |
| backend/shopOrders/orderRouteShared.ts | Đặt bước tính ưu đãi sau xác minh giá catalog; hiện discount bị đặt 0 |
| backend/shopOrders/orderCreateRoutes.ts | Báo giá lại, giữ lượt và lưu snapshot; hiện tổng = subtotal + ship |
| backend/shopOrders/kvPush.ts | Mapping giảm và tổng tiền sang KiotViet |
| backend/shopOrders/kvOrderMoneySync.ts | Nhận đủ giảm cấp đơn, tránh ghi đè sai |
| backend/shopOrders/markPaid.ts, completeDelivered.ts và luồng hủy/hết hạn | Chuyển trạng thái lượt sử dụng |
| backend/shopOrders/commission.ts | Phân bổ ưu đãi khi tính tiền hoa hồng |
| backend/shopAppearance/ | Gắn banner vào chương trình thật; cấu hình couponCode không tự chứng minh mã hợp lệ |

Chưa sửa bất kỳ file triển khai nào. Không trộn thay đổi tính năng này với đợt chỉ tách file trong KE_HOACH_TACH_FILE.md.

## 12. Lộ trình và tiêu chí hoàn tất

### Giai đoạn 0 — xác minh trước triển khai

- Chốt chính sách còn mở ở mục 14.
- Kiểm tra định danh, lịch sử đơn, MongoDB, ship, thuế và hợp đồng tiền KiotViet.
- Phác thảo admin và bảng chọn mã theo mục 4–5, chốt luồng giá của đơn chờ xác nhận.
- Hoàn tất khi có ví dụ tiền đầu vào/đầu ra thống nhất và không còn điểm chưa rõ ở mapping tài chính cho phạm vi bản đầu.

### Giai đoạn 1 — ưu đãi web và admin tự cấu hình

- Bộ tính, phiên bản, snapshot, giữ lượt và giới hạn.
- Admin tạo/sửa/preview/lên lịch/tạm dừng; hai mẫu khách mới và đơn lớn.
- Giỏ/checkout tự chọn ưu đãi, giải thích điều kiện và tổng tiền.
- Đồng bộ KiotViet, thanh toán, hủy/hết hạn, sửa đơn và hoa hồng cùng phạm vi.
- Hoàn tất khi admin đổi mức/ngưỡng mà không deploy; đơn cũ không đổi; không vượt lượt/ngân sách khi đặt đồng thời; tổng Aloha và KiotViet khớp.

### Giai đoạn 2 — mã và trải nghiệm mở rộng

- Mã chung/mã riêng, phát hành hàng loạt, ví ưu đãi, nhập/xuất, báo cáo nâng cao.
- Nhóm khách/sản phẩm nâng cao và ưu đãi ship nếu cần; mở từng loại kèm quy tắc kết hợp rõ.
- Hoàn tất khi mã riêng không lộ, người không đủ điều kiện biết cách xử lý, giữ và tiêu thụ đúng qua mọi trạng thái đơn.

### Giai đoạn 3 — voucher KiotViet

- Đọc và hiển thị trước; sau đó mới tích hợp tiêu thụ mã và hoàn/hủy khi các kiểm chứng mục 9.2 đạt.
- Nếu API không hỗ trợ thao tác cần thiết, ghi rõ hạn chế và giữ thao tác đó trên KiotViet; không giả lập trạng thái thành công tại web.

## 13. Ma trận kiểm thử và phát hành

| Nhóm | Ca bắt buộc |
|---|---|
| Ngưỡng | 999.999 / 1.000.000 / 1.000.001đ với cả trên và từ |
| Phần trăm | Chạm trần; giá trị lẻ; nhiều dòng; quantity > 1; không tổng âm |
| Phạm vi | Hàng loại trừ, nhóm, khách sỉ, hàng chưa có giá, sản phẩm hết hàng |
| Lần đầu | Lịch sử mua không dùng mã; đã mua cửa hàng; hai tài khoản cùng định danh; hủy trước trả; hoàn sau thành công |
| Đồng thời | Hai đơn cùng khách; hai khách tranh lượt cuối/ngân sách cuối; retry cùng idempotency |
| Thời gian | Biên bắt đầu/kết thúc theo múi giờ; admin sửa/tạm dừng khi checkout; đơn giữ trước kết thúc |
| Thanh toán | Chuyển khoản, COD, chờ xác nhận, đặt trước, trả thiếu/đến muộn, tổng 0 |
| Đồng bộ | KiotViet timeout trước/sau nhận; webhook lặp; nhân viên sửa đơn; giảm toàn đơn không bị mất |
| Hoàn/hoa hồng | Hoàn một món; nhiều lần hoàn; phân bổ đúng; không hoàn/chi vượt tiền thực |
| UI | 360px, desktop, bàn phím, đọc màn hình, tải/lỗi/rỗng, phản hồi báo giá về sai thứ tự |
| Quyền | Không quản lý vẫn không gọi được API ghi; mã riêng không bị liệt kê; hai admin sửa xung đột |

Khi triển khai: kiểm thử đơn vị bộ tính và trạng thái; tích hợp database cho cạnh tranh; kiểm thử hợp đồng KiotViet trên môi trường thử; E2E các luồng thanh toán quan trọng. Tài liệu hiện tại không yêu cầu chạy test ứng dụng vì chưa thay code.

Phát hành bằng cờ tính năng, chương trình mặc định là nháp. Bật cho nhóm thử trước, theo dõi sai lệch tiền/lượt và lỗi đồng bộ. Tắt cờ ngăn lượt mới nhưng vẫn xử lý đơn đã giữ/đã thanh toán. Lưu dữ liệu lịch sử khi rollback. Không tự deploy production trong phạm vi lập kế hoạch này.

## 14. Các quyết định còn cần chốt trước chạy thật

| Câu hỏi | Đề xuất hoặc trạng thái |
|---|---|
| “10$” là gì? | Chưa rõ; bản đầu hỗ trợ % hoặc VND; nếu thật sự USD cần chính sách tiền tệ riêng |
| Trần giảm lần đầu bao nhiêu? | Bắt buộc chủ shop nhập theo lợi nhuận; chưa tự chọn số |
| Trên hay từ một triệu? | Giữ “trên” theo yêu cầu, admin có thể chọn “từ” |
| Có cộng hai ưu đãi toàn đơn? | Mặc định chọn một tốt nhất |
| Hàng sỉ và hàng đang giảm có được hưởng? | Sỉ loại trừ mặc định; xác định rõ giá nào đang là giá khuyến mại |
| Thời hạn giữ đơn chờ xác nhận? | Cấu hình theo quy trình vận hành thực tế |
| Có OTP/định danh đủ tin cậy chưa? | Cần kiểm tra trước phát hành ưu đãi lần đầu |
| Dùng voucher KiotViet ngay bản đầu? | Đề xuất sau ưu đãi web, phụ thuộc xác minh API thực tế |
| Ngưỡng miễn ship trước hay sau giảm? | Khảo sát và giữ chính sách hiện tại, ghi rõ trên UI; không tự đổi |

Các điểm chưa chốt không cản việc thiết kế form tổng quát. Chúng phải được điền trước khi kích hoạt chương trình thật.

## 15. Danh mục tình huống vận hành và cách xử lý

Phụ lục này mở rộng kế hoạch thành các tình huống cụ thể để thiết kế màn hình và viết ca kiểm thử. Đây là chính sách **đề xuất cho Aloha**, không phải khẳng định tất cả sàn áp dụng giống nhau, cũng không phải mô tả tính năng đã tồn tại. Danh mục bao phủ các nhóm thường cần xử lý; cần bổ sung khi phát hiện tình huống mới trong vận hành.

### 15.1. Quy ước đọc và ví dụ tiền

- Mỗi mã tình huống dùng để truy vết yêu cầu, kiểm thử và lỗi về sau.
- Các ví dụ dùng VND, giả định giá hàng là giá thanh toán theo chế độ thuế đã cấu hình, không cộng thuế lần nữa.
- Ví dụ tỷ lệ CTV 5%, mức giảm cố định 100.000đ và thời hạn ghi nhận 30 ngày chỉ để minh họa; chưa phải chính sách được duyệt.
- Hoa hồng cơ sở = tổng tiền từng dòng sau giảm được phân bổ × tỷ lệ CTV của dòng; loại phí ship. Phiếu thanh toán không tự làm giảm doanh thu tính hoa hồng như một chiết khấu.
- “Chốt đơn” là lưu giá, ưu đãi, người giới thiệu và tỷ lệ vào đơn. Với đơn chờ báo giá, thời điểm chốt là lúc khách xác nhận báo giá cuối.
- “Khôi phục lượt” chỉ thực hiện một lần sau khi chắc chắn giao dịch chưa thành công đã kết thúc; không đồng nghĩa tự hoàn mã bên KiotViet.
- Các khoản tiền hoàn và hoa hồng điều chỉnh phải có lịch sử; không xóa giao dịch cũ để sửa số dư.

### 15.2. Khách mới, tài khoản và lịch sử mua

| Mã | Tình huống | Xử lý đề xuất | Khách/admin cần thấy |
|---|---|---|---|
| KH01 | Chưa từng mua web, đã xác minh định danh | Cho ưu đãi lần đầu nếu đủ điều kiện khác; giữ quyền khi đặt | Số tiền giảm và điều kiện |
| KH02 | Đã mua cửa hàng, lần đầu mua web | Vẫn đủ điều kiện lần đầu web | Ghi rõ “lần đầu trên website” |
| KH03 | Đã có đơn web thành công nhưng chưa từng dùng mã | Không còn quyền lần đầu | Giải thích dựa trên lần mua, không dựa trên lần dùng mã |
| KH04 | Chỉ có đơn đã hủy trước thanh toán | Được xét lại sau khi giải phóng lượt | Ưu đãi khả dụng trở lại |
| KH05 | Có đơn chuyển khoản đang giữ ưu đãi, đặt thêm đơn | Không cấp quyền lần đầu cho đơn thứ hai | Đường dẫn đơn đang giữ; hướng dẫn tiếp tục hoặc hủy |
| KH06 | Có đơn COD đang giao | Giữ quyền đến khi đơn kết thúc | Không hứa cấp lại vì khách chưa trả tiền |
| KH07 | Đã thanh toán rồi hoàn toàn bộ | Không tự khôi phục quyền lần đầu | Chính sách hoàn không cấp lại ưu đãi |
| KH08 | Hai tài khoản cùng số điện thoại đã xác minh | Dùng chung định danh xét quyền; không phát sinh hai lượt | Admin có bằng chứng liên kết, không lộ tài khoản kia cho khách |
| KH09 | Khách đổi số điện thoại | Chuyển liên kết theo quy trình xác minh; giữ lịch sử quyền cũ | Không coi là khách mới chỉ vì đổi số |
| KH10 | Khách vãng lai chưa đăng nhập | Cho xem ưu đãi công khai; kiểm tra lần đầu sau đăng nhập | “Đăng nhập để kiểm tra ưu đãi” |
| KH11 | Mua hộ, số người nhận khác chủ tài khoản | Xét quyền theo người mua đã xác minh | Số nhận hàng không cấp thêm quyền |
| KH12 | Dữ liệu lịch sử cũ thiếu định danh | Không suy ra khách mới chỉ từ việc thiếu dữ liệu; đối chiếu/mở xử lý thủ công | Trạng thái cần xác minh và quy trình hỗ trợ |
| KH13 | Tài khoản chuyển khách lẻ sang sỉ trước đặt | Báo giá lại theo giá và phạm vi mới | Tổng tiền mới cần xác nhận |
| KH14 | Nhiều người chung địa chỉ/IP | Không tự từ chối chỉ do chung mạng/địa chỉ; kết hợp tín hiệu và xét duyệt | Không công khai cáo buộc gian lận |

### 15.3. Giá trị giỏ, loại hàng và kết hợp ưu đãi

| Mã | Tình huống | Xử lý đề xuất | Minh họa/hiển thị |
|---|---|---|---|
| GH01 | Điều kiện “trên 1 triệu”, giỏ đúng 1 triệu | Không đủ | Nếu toàn bộ hàng hợp lệ, thiếu ít nhất 1đ; nội dung tránh làm khách hiểu “từ” |
| GH02 | Điều kiện “từ 1 triệu”, giỏ đúng 1 triệu | Đủ | Ghi đúng từ “từ” |
| GH03 | Tiền hàng 980.000đ, ship 30.000đ | Không đạt ngưỡng một triệu | Ship không góp vào tiền xét ngưỡng |
| GH04 | Giỏ 1,2 triệu nhưng hàng đủ điều kiện chỉ 800.000đ | Xét ngưỡng trên 800.000đ | Chỉ rõ món không thuộc phạm vi |
| GH05 | Hàng đã giảm riêng từ 1,1 triệu còn 990.000đ | Xét trên 990.000đ theo chính sách đã chọn | Không dùng giá niêm yết để tăng ngưỡng |
| GH06 | Giảm 10% giỏ 2 triệu, trần 100.000đ | Giảm 100.000đ | “Đã áp dụng mức giảm tối đa” |
| GH07 | Mã giảm 100.000đ nhưng hàng hợp lệ 80.000đ | Giảm tối đa 80.000đ nếu không có ngưỡng khác | Không phát sinh số âm hoặc trả phần giảm dư bằng tiền |
| GH08 | Khách mới đủ cả 10% và giảm cố định | Chọn mức tiết kiệm lớn hơn trong nhóm loại trừ | Giỏ 1,2 triệu, 10% chưa chạm trần thắng 100.000đ |
| GH09 | Hai ưu đãi cho số tiền giảm bằng nhau | Giữ thứ tự ưu tiên ổn định | Không đổi tên ưu đãi liên tục khi tải lại |
| GH10 | Khách chủ động chọn mã kém lợi hơn | Tôn trọng lựa chọn; gợi ý ưu đãi tốt hơn | Nút đổi, không tự ghi đè mã |
| GH11 | Xóa một món làm mất ngưỡng | Tính lại; bỏ khoản giảm không còn hợp lệ | Nêu thay đổi trước đặt hàng |
| GH12 | Thêm số lượng vượt bậc giảm tiếp theo | Tính lại, tự chọn bậc tốt nhất trong chế độ tự động | Thể hiện số tiền tiết kiệm mới |
| GH13 | Mã giảm hàng và chính sách miễn ship cùng hợp lệ | Chỉ kết hợp nếu cấu hình cho phép; mỗi khoản một dòng | Không gọi giảm ship là giảm tiền hàng |
| GH14 | Địa chỉ mới làm tăng ship | Báo giá lại ship; giữ giảm hàng nếu điều kiện không đổi | Tổng mới và yêu cầu xác nhận nếu cần |
| GH15 | Sản phẩm bị ngừng bán/hết hàng trước đặt | Kiểm tra lại hàng rồi tính ưu đãi | Không giữ ưu đãi cho đơn chưa tạo được |
| GH16 | Giỏ có hàng đặt trước và hàng có sẵn | Xác định giá cuối, giao tách và điều kiện trước chốt | Không nhân đôi ưu đãi khi chia kiện |
| GH17 | Tổng bằng 0 sau giảm | Dùng luồng đơn 0đ đã kiểm chứng; không QR/thu COD 0đ | Không tự xác nhận thanh toán ngân hàng |
| GH18 | Tiền giảm có phần lẻ qua nhiều món | Làm tròn và phân bổ ổn định, tổng phân bổ đúng tổng giảm | Không lệch 1–2đ giữa web, đơn và hoàn hàng |
| GH19 | Giỏ chứa quà tặng hoặc sản phẩm 0đ | Không góp ngưỡng hoặc hoa hồng trừ chính sách rõ khác | Không dùng số lượng quà để mở thêm ưu đãi |
| GH20 | Khách sỉ nhận link ưu đãi khách lẻ | Kiểm tra vai trò và giá phía server | Giải thích không thuộc đối tượng, giữ giá sỉ đúng |

### 15.4. Mã giảm giá và ví ưu đãi

| Mã | Tình huống | Xử lý đề xuất | Khách/admin cần thấy |
|---|---|---|---|
| MA01 | Nhập mã Aloha có dấu cách/chữ thường | Chuẩn hóa theo quy tắc mã Aloha rồi tra cứu | Mã chuẩn sau áp dụng |
| MA02 | Mã không tồn tại hoặc không thuộc khách | Trả lỗi chung phù hợp; không lộ chủ sở hữu | “Mã không hợp lệ hoặc không dành cho tài khoản này” |
| MA03 | Mã chưa bắt đầu/hết hạn | Không áp dụng | Thời gian hiệu lực theo giờ Việt Nam |
| MA04 | Mã hợp lệ nhưng hết lượt/ngân sách | Không giữ thêm | Lý do rõ và ưu đãi thay thế nếu có |
| MA05 | Mã dùng một lần đã dùng ở đơn thành công | Không áp dụng lại | Liên kết lịch sử đơn của chính khách |
| MA06 | Mã đang giữ ở đơn khác | Không cấp đồng thời | Cho xem đơn đang chờ |
| MA07 | Khách lưu mã nhưng chưa đặt | Chỉ lưu vào ví, không giữ lượt/ngân sách | “Áp dụng khi còn lượt và đủ điều kiện” |
| MA08 | Mã bị tạm dừng sau khi khách lưu | Ví cập nhật trạng thái | Không tiếp tục quảng cáo là dùng được |
| MA09 | Mã riêng bị chia sẻ cho người khác | Kiểm tra khách sở hữu phía server | Không chỉ dựa vào biết chuỗi mã |
| MA10 | Thử mã liên tục để dò mã | Giới hạn tần suất, theo dõi bất thường | Cho thử lại sau; không khóa vô thời hạn do một lỗi gõ |
| MA11 | Import mã có trùng và dòng lỗi | Xem trước kết quả, xác định rõ nhập toàn bộ hay phần hợp lệ | Số tạo/thất bại và lý do theo dòng |
| MA12 | Một mã kích hoạt chương trình đã sửa | Mã trỏ chương trình; đơn mới dùng phiên bản hiện hành | Điều kiện ví đồng bộ với phiên bản mới |
| MA13 | Mã chung còn lượt nhưng khách hết hạn mức cá nhân | Từ chối riêng khách đó | Không hiển thị sai là toàn chương trình hết lượt |
| MA14 | Mã web trùng chuỗi mã KiotViet | Phân biệt nguồn ở bước tra cứu/chọn | Không tự tiêu thụ cả hai hoặc đoán nguồn |

### 15.5. CTV — quy tắc ghi nhận cần chốt

Đề xuất: ghi nhận lượt giới thiệu hợp lệ gần nhất trong thời hạn cấu hình, theo phạm vi link (sản phẩm/toàn shop). Không gắn khách vĩnh viễn. Đây là thay đổi chính sách cần kiểm tra với hệ thống CTV hiện có trước triển khai.

Lưu bằng chứng phía server: CTV, loại link, sản phẩm/phạm vi, thời điểm, hạn ghi nhận và nguồn lượt giới thiệu. Không tin ctvCode tùy ý gửi từ trình duyệt. Khi khách đăng nhập, chỉ liên kết lượt giới thiệu trong phiên hợp lệ; không tự chuyển giới thiệu giữa các tài khoản dùng chung thiết bị.

Khi có nhiều lượt hợp lệ, chọn lượt mới nhất có phạm vi bao phủ từng dòng sản phẩm. Link sản phẩm B không thay ghi nhận của sản phẩm A. Nếu hỗ trợ link toàn shop, phải hiển thị rõ phạm vi cho CTV và kiểm thử tương tác giữa hai loại link.

| Mã | Tình huống | Ghi nhận và hoa hồng đề xuất | Hiển thị/đối soát |
|---|---|---|---|
| CT01 | Khách mới mua qua link A, hưởng giảm lần đầu | A nhận theo tiền hàng sau giảm nếu link hợp lệ | Hàng 1 triệu, giảm 100.000đ, tỷ lệ 5% → 45.000đ |
| CT02 | Lần hai tiếp tục vào link A | Có lượt mới hợp lệ; A được ghi nhận; không giảm lần đầu | Hàng 1 triệu, không giảm, 5% → 50.000đ |
| CT03 | Lần hai vào trực tiếp, lượt A còn hạn | Giữ A trong phạm vi đã được giới thiệu | Nếu giảm đơn lớn 100.000đ, hoa hồng còn 45.000đ |
| CT04 | Lần hai vào trực tiếp, lượt A hết hạn | Không tự phát sinh hoa hồng A | Lịch sử khách cũ không tự tạo quyền hưởng |
| CT05 | Khách bấm A rồi B trước đặt | B thắng trên các dòng B có phạm vi hợp lệ | Lưu bằng chứng chọn B, không chỉ ghi tên người thắng |
| CT06 | Khách bấm link B sau khi đơn đã chốt | Không đổi CTV của đơn cũ | Có thể tác động đơn mới đủ điều kiện |
| CT07 | A giới thiệu món X, B giới thiệu món Y trong cùng giỏ | Ghi nhận từng dòng X/A, Y/B nếu cả hai lượt hợp lệ | Mỗi CTV chỉ thấy phần quyền lợi của mình |
| CT08 | Chỉ có link A cho X, khách mua thêm Y | Y không tự thuộc A nếu link chỉ bao phủ X | Phạm vi link phải rõ trên công cụ chia sẻ |
| CT09 | Khách vào link toàn shop B sau link món X của A | Theo đề xuất lượt hợp lệ gần nhất, B có thể thắng cả X | Cần duyệt chính sách link toàn shop trước bật |
| CT10 | CTV bị khóa trước khách đặt | Không tạo quyền mới; xử lý quyền cũ theo chính sách khóa | Không tự xóa hoa hồng đã đủ điều kiện nếu chưa có kết luận vi phạm |
| CT11 | Khách nhập mã giảm giá của chiến dịch B sau link A | Mã giảm giá không tự thay người giới thiệu | Nếu mã có ghi nhận CTV phải có loại riêng và thứ tự ưu tiên đã chốt |
| CT12 | CTV tự mua hoặc tạo tài khoản có liên hệ để hưởng hoa hồng | Đánh dấu xét duyệt theo chính sách tự mua; không tự trả | Ưu đãi khách và hoa hồng là hai quyết định riêng |
| CT13 | Khách đổi máy/xóa cookie trước đặt | Chỉ giữ ghi nhận nếu đã liên kết hợp lệ phía server | Không hứa theo dõi mọi thiết bị khi chưa nhận diện được khách |
| CT14 | Nhiều khách dùng chung trình duyệt | Không để ghi nhận cá nhân của khách trước tự sang khách sau | Tách phiên và định danh |
| CT15 | Client sửa ctvCode hoặc thời điểm link | Backend từ chối bằng chứng không hợp lệ | Log sự kiện an toàn, không tin dữ liệu tự khai |
| CT16 | Admin đổi tỷ lệ từ 5% lên 7% sau chốt | Đơn cũ dùng tỷ lệ 5% đã lưu; đơn mới theo chính sách mới | Hiển thị tỷ lệ và nguồn tại đơn |
| CT17 | Lượt giới thiệu hết hạn sau khi đã chốt đơn | Giữ CTV của đơn; không mất hoa hồng chỉ vì giao hàng muộn | Thời điểm chốt làm căn cứ |
| CT18 | Hai tab có link CTV khác nhau, khách đặt từ một tab | Chọn theo bằng chứng hợp lệ server và chính sách thời điểm, không theo phản hồi mạng về cuối | Lưu thứ tự sự kiện; kiểm thử tránh race |
| CT19 | Đơn dùng mã giảm sâu khiến lợi nhuận thấp | Áp dụng tỷ lệ và cơ sở đã cấu hình trước; không tự cắt sau chốt | Admin preview tổng chi phí ưu đãi cộng hoa hồng |
| CT20 | Thanh toán đủ nhưng chưa giao | Hoa hồng chờ hoàn tất, chưa chi | Tạm tính / Chờ đối soát / Được thanh toán / Đã chi |

### 15.6. Ví dụ phân bổ ưu đãi và hoa hồng theo dòng

Giỏ gồm X giá trị 600.000đ thuộc CTV A tỷ lệ 5%, Y giá trị 400.000đ thuộc CTV B tỷ lệ 8%. Ưu đãi toàn đơn 100.000đ áp dụng cả hai món:

| Dòng | Tiền trước giảm | Giảm được phân bổ | Cơ sở hoa hồng | Hoa hồng |
|---|---:|---:|---:|---:|
| X / A | 600.000đ | 60.000đ | 540.000đ | 27.000đ |
| Y / B | 400.000đ | 40.000đ | 360.000đ | 28.800đ |
| Tổng | 1.000.000đ | 100.000đ | 900.000đ | 55.800đ |

Nếu chỉ X đủ điều kiện giảm thì phân bổ toàn bộ giảm hợp lệ cho X, không chia sang Y. Nếu Y không có CTV hợp lệ thì vẫn phân bổ phần giảm của Y nhưng không phát sinh hoa hồng cho Y. Ship 30.000đ làm tổng khách trả thành 930.000đ, không làm tăng cơ sở hoa hồng 900.000đ.

### 15.7. Đặt đơn, giữ quyền và thanh toán

| Mã | Tình huống | Xử lý đề xuất | Hiển thị/tiền |
|---|---|---|---|
| TT01 | Nhấn đặt hàng hai lần/retry do mạng | Cùng idempotency trả lại cùng đơn và lượt giữ | Không hai QR, hai lượt, hai hoa hồng |
| TT02 | Hai tab đặt hai đơn dùng quyền lần đầu | Chỉ một đơn giữ thành công bằng ràng buộc DB | Đơn còn lại nhận lý do và báo giá mới |
| TT03 | Hai khách tranh lượt cuối | Chỉ một khách giữ thành công | Khách còn lại xác nhận lại tổng, không tự thu cao hơn |
| TT04 | Còn ngân sách 50.000đ, ưu đãi dự kiến 80.000đ | Không áp dụng chương trình đó; không tự giảm xuống 50.000đ | Có thể chọn ưu đãi khác nếu hợp lệ |
| TT05 | Giữ lượt thành công nhưng lưu đơn lỗi | Rollback hoặc bù có kiểm soát; không treo quyền | Theo dõi lỗi, retry không tạo giữ mới |
| TT06 | Chuyển khoản đúng và trong hạn | Chuyển giữ thành đã dùng, vẫn chờ giao để chi CTV | Tổng đã trả khớp số cần trả |
| TT07 | Chuyển khoản thiếu | Giữ trạng thái chưa đủ, tính số còn thiếu | Không tính là đã hoàn tất chỉ vì có giao dịch |
| TT08 | Chuyển khoản thừa | Ghi dư và quy trình hoàn/đối soát riêng | Không tăng hoa hồng theo tiền khách chuyển thừa |
| TT09 | Hết hạn chưa nhận tiền | Hủy/hết hạn theo quy trình, giải phóng một lần | Khách đặt lại được kiểm tra theo ưu đãi hiện hành |
| TT10 | Tiền tới sau hết hạn và quyền đã giải phóng | Đối soát thủ công hoặc luồng khôi phục có kiểm tra | Không âm thầm tạo đơn giá cũ hoặc chi hoa hồng |
| TT11 | Webhook thanh toán bị gửi lặp | Xử lý idempotent theo giao dịch | Không tăng tiền đã trả/tiêu thụ mã hai lần |
| TT12 | Webhook hủy và thanh toán đến sai thứ tự | Kiểm tra trạng thái và giao dịch thực tế; đưa tranh chấp vào đối soát | Không ghi “chưa trả” khi tiền đã nhận |
| TT13 | COD giao thành công | Tiêu thụ lượt, ghi nhận thu tiền theo quy trình vận chuyển | Hoa hồng chờ hết thời gian đối soát |
| TT14 | COD từ chối nhận/giao thất bại kết thúc | Hủy hoa hồng, giải phóng ưu đãi chưa thành công | Phí giao thất bại là khoản riêng theo chính sách |
| TT15 | Khách đổi COD sang chuyển khoản | Cập nhật cùng đơn, giữ cùng lượt; tạo QR đúng tiền còn phải thu | Không nhân đôi ưu đãi |
| TT16 | Có thanh toán một phần rồi yêu cầu hủy | Hoàn/đối soát tiền trước khi đóng trạng thái | Chỉ giải phóng quyền khi trạng thái giao dịch được xác định |
| TT17 | Đơn đã giữ trước giờ chương trình hết hạn | Giữ giá trong hạn thanh toán đã hứa | Tạo đơn mới sau hết hạn không được hưởng |
| TT18 | Hệ thống khởi động lại sau giữ lượt | Khôi phục từ DB, tác vụ đối soát sửa giữ mồ côi | Không dựa vào bộ nhớ tiến trình |

### 15.8. Sửa đơn, tách giao, hủy và hoàn hàng

| Mã | Tình huống | Tiền/ưu đãi | Hoa hồng và trải nghiệm |
|---|---|---|---|
| DH01 | Shop bỏ món trước thanh toán làm rớt ngưỡng | Báo giá lại, điều chỉnh lượt giữ/ngân sách nguyên tử | Tính lại hoa hồng tạm tính; khách xác nhận |
| DH02 | Shop thêm món sau khách đã trả | Lập thay đổi có chênh lệch cần thu; không ghi đè đơn đã trả | Không tự mở rộng phạm vi CTV cho món thêm |
| DH03 | Đổi sang món cùng giá trước thanh toán | Kiểm tra phạm vi ưu đãi và CTV của món mới | Giá bằng nhau không có nghĩa điều kiện giống nhau |
| DH04 | Shop tự hết hàng sau chốt | Đề xuất giữ quyền lợi đã cam kết trên phần giao được khi phù hợp, hoặc báo giá lại được khách đồng ý | Chính sách thiếu hàng do shop cần chốt; không tự truy thu |
| DH05 | Một đơn giao nhiều kiện | Một ưu đãi và một lượt sử dụng theo đơn gốc | Không tạo hoa hồng lặp theo kiện |
| DH06 | Tách một đơn thành nhiều đơn con | Phân bổ snapshot gốc, liên kết gốc/con, bảo toàn tổng | Đơn con không được tự nhận thêm ưu đãi lần đầu |
| DH07 | Gộp hai đơn đã chốt | Không tự gộp ưu đãi; xử lý điều chỉnh có kiểm soát | Tránh dùng hai lượt lần đầu cho một khách |
| DH08 | Hủy toàn bộ trước thành công | Giải phóng lượt/ngân sách đủ điều kiện; hoàn tiền nếu có | Hủy hoa hồng tạm tính |
| DH09 | Hoàn toàn bộ sau giao thành công | Hoàn phần thực trả theo chính sách; không cấp lại lần đầu | Void/điều chỉnh hoa hồng; ship xử lý riêng |
| DH10 | Hoàn X trong ví dụ mục 15.6 | Hoàn tiền hàng X tối đa 540.000đ, không phải 600.000đ | Giảm hoa hồng A 27.000đ; B giữ 28.800đ |
| DH11 | Hoàn một trong nhiều đơn vị cùng dòng | Phân bổ phần giảm theo đơn vị với quy tắc phần dư ổn định | Không để tổng nhiều lần hoàn vượt dòng gốc |
| DH12 | Hoàn làm tiền hàng còn lại thấp hơn ngưỡng | Mặc định không tính lại giá món giữ; hoàn theo snapshot đã phân bổ | Nếu muốn thu hồi ưu đãi theo ngưỡng phải thiết kế chính sách riêng trước chạy |
| DH13 | Hoa hồng đã chi rồi mới hoàn | Ghi điều chỉnh kỳ sau với liên kết đơn hoàn | Không xóa phiếu chi; nêu rõ khoản bị trừ |
| DH14 | Một yêu cầu hoàn được gửi lại nhiều lần | Duy nhất theo mã yêu cầu; kiểm tra số lượng còn hoàn được | Không hoàn tiền/thu hồi hoa hồng lặp |
| DH15 | Đổi hàng sau giao | Ghi giao dịch đổi/hoàn và chênh lệch; không dùng ưu đãi mới để sửa giá cũ tùy tiện | Tính hoa hồng điều chỉnh theo hàng giữ/thay và chính sách đã chốt |
| DH16 | Tranh chấp tự mua/đơn giả sau giao | Tạm giữ phần hoa hồng cần xét duyệt; tiền khách theo quy trình riêng | Nhật ký kết luận, người xử lý và lý do |

### 15.9. Voucher KiotViet, đồng bộ và sai lệch tiền

| Mã | Tình huống | Xử lý đề xuất | Tiêu chí đối soát |
|---|---|---|---|
| KV01 | Đợt và mã đọc được nhưng thiếu điều kiện | Không mặc định là dùng tự do; xác minh trước áp dụng | Hiển thị chưa đủ thông tin |
| KV02 | Cache còn mã, POS vừa dùng xong | Kiểm tra/tiêu thụ ở nguồn; chấp nhận nguồn từ chối | Không ghi nhận thành công chỉ vì cache báo còn |
| KV03 | Website và POS dùng cùng mã đồng thời | Phụ thuộc bảo đảm chống dùng trùng của KiotViet; chưa kiểm chứng thì chưa mở | Khóa Aloha không bảo vệ được POS |
| KV04 | KiotViet nhận đơn nhưng trả lời timeout | Tra cứu bằng liên kết ổn định trước retry | Không tạo hóa đơn hoặc tiêu thụ voucher lần hai |
| KV05 | KiotViet trả tổng khác web | Chặn bước xác nhận số tiền thanh toán, đối soát mapping | Ghi tiền dự kiến/thực tế/chênh lệch |
| KV06 | Đồng bộ ngược đơn có giảm toàn đơn | Đọc giảm đầy đủ, bảo toàn snapshot/đánh dấu thay đổi | Không cộng dòng và ship rồi bỏ giảm |
| KV07 | Nhân viên thêm giảm giá trên KiotViet | Nhận diện thay đổi; xử lý theo trạng thái trả tiền | Không tự cộng chồng ưu đãi web lần nữa |
| KV08 | Mã voucher hết hạn giữa báo giá và xác nhận | Không tiêu thụ; báo tổng mới để khách quyết định | Không âm thầm thu phần thiếu |
| KV09 | Đã dùng voucher rồi hủy hóa đơn | Xác minh cơ chế hoàn mã của nguồn trước khi hứa khôi phục | Không tự sửa cache thành “chưa dùng” |
| KV10 | Voucher lớn hơn tiền còn cần thanh toán | Chỉ hỗ trợ sau khi chốt quy tắc dùng dư/số dư ở nguồn | Không tự trả phần dư bằng tiền mặt |
| KV11 | Đơn vừa giảm 100.000đ vừa trả voucher 200.000đ | Hàng 1 triệu → giá trị sau giảm 900.000đ → còn trả 700.000đ, chưa tính ship | CTV 5% trên 900.000đ = 45.000đ nếu voucher là phương thức trả tiền |
| KV12 | Voucher được tặng để marketing thay vì bán | Cần chính sách tài trợ/hoa hồng riêng nếu shop muốn trừ chi phí đó | Không tự đồng nhất mọi voucher với giảm giá |
| KV13 | Hoàn đơn đã trả bằng tiền và voucher | Phân bổ hoàn theo nguồn và khả năng API đã xác minh | Không hoàn hết bằng tiền mặt tùy tiện |
| KV14 | Token hết hạn/mạng lỗi khi kiểm tra mã | Retry xác thực phù hợp; trạng thái chờ, không thành công giả | Không lộ token hoặc lỗi kỹ thuật cho khách |
| KV15 | Ship vừa là dòng dịch vụ vừa là phí giao hàng | Mapping chỉ tính đúng một lần | Kiểm thử riêng đơn có/không ship |
| KV16 | Giảm dòng quantity > 1 khác ngữ nghĩa hai hệ thống | Kiểm chứng hợp đồng, chuyển đổi rõ đơn vị/toàn dòng | Không lấy tên discount làm bằng chứng công thức |

### 15.10. Admin, thời gian, UI và kiểm soát vận hành

| Mã | Tình huống | Xử lý đề xuất | Hiển thị/kiểm thử |
|---|---|---|---|
| AD01 | Admin sửa 10% thành 15% khi khách đang checkout | Giỏ chưa chốt báo giá lại; đơn chốt giữ snapshot | Khách xác nhận tổng thay đổi |
| AD02 | Admin tạm dừng chương trình đang có lượt giữ | Ngăn lượt mới, giữ cam kết đơn cũ | Số đơn đang giữ và ảnh hưởng thao tác |
| AD03 | Hai admin lưu cùng chương trình | Dùng revision, báo xung đột | So sánh thay đổi, không last-write-wins im lặng |
| AD04 | Giảm ngân sách thấp hơn đã dùng + đang giữ | Từ chối cấu hình không hợp lệ | Nêu ngân sách tối thiểu hiện tại |
| AD05 | Admin xóa chương trình đã phát sinh giao dịch | Chuyển lưu trữ, giữ lịch sử | Không mất điều kiện cũ trên đơn |
| AD06 | Nhân bản chương trình đang chạy | Tạo bản nháp với mã mới | Không vô tình chạy hai chương trình |
| AD07 | Tác vụ lên lịch bị trễ | Backend vẫn kiểm tra thời gian mỗi lần tính | Trạng thái UI lấy từ thời gian thực |
| AD08 | Thiết bị khách sai giờ | Dùng giờ server | Giờ hiển thị thống nhất Việt Nam |
| AD09 | Preview admin làm nhiều lần | Không tăng lượt hoặc gọi API tạo giao dịch | Kết quả có dấu “Xem thử” |
| AD10 | Nhân viên chỉ có quyền xem gọi API sửa | Backend từ chối | Kiểm thử quyền trực tiếp qua API |
| AD11 | Banner còn mã nhưng chương trình đã dừng | Banner dùng trạng thái chương trình hoặc tự ẩn | Không để mã hiển thị tách rời hiệu lực |
| AD12 | Hoàn đơn làm báo cáo doanh thu giảm | Ghi riêng hoàn, không xóa lượt lịch sử | Định nghĩa rõ doanh thu sau giảm và sau hoàn |
| UX01 | Giỏ thay đổi liên tục, phản hồi cũ về sau | Chỉ hiển thị báo giá của revision mới nhất | Không nhảy ngược tổng tiền |
| UX02 | Mất mạng khi áp dụng mã | Giữ đầu vào, báo lỗi, cho thử lại | Không báo đã áp dụng nếu chưa có kết quả |
| UX03 | Người dùng đóng/mở bảng chọn mã | Giữ lựa chọn đã xác nhận; thay đổi chưa xác nhận có thể hủy | Nút áp dụng/hủy rõ |
| UX04 | Mã không đủ ngưỡng | Hiển thị lý do và phần tiền thiếu của hàng hợp lệ | Không tính cả món ngoài phạm vi vào gợi ý |
| UX05 | Mã riêng của khách khác có trong URL chia sẻ | Không liệt kê thông tin cá nhân | Thông báo chung, có thể chọn mã công khai khác |
| UX06 | Khách dùng bàn phím/trình đọc màn hình | Focus đúng, nhãn rõ, đọc được tiền thay đổi | Không dùng màu đơn thuần để báo lỗi |
| UX07 | Mobile màn hình nhỏ, nhiều mã | Bảng cuộn, nút xác nhận luôn tiếp cận được | Không che tổng tiền hoặc nội dung điều kiện |
| UX08 | Không có chương trình nào | Hiển thị ngắn, cho thanh toán tiếp | Không tạo cảm giác bắt buộc có mã |
| VH01 | Tắt tính năng sau khi phát hiện lỗi | Ngăn lượt mới, tiếp tục đối soát đơn cũ | Không xóa giữ lượt đang gắn thanh toán |
| VH02 | Tác vụ giải phóng chạy lại | Chuyển trạng thái có điều kiện, duy nhất | Không cộng ngân sách hai lần |
| VH03 | Log/báo cáo lỗi chứa mã riêng | Che dữ liệu nhạy cảm và giới hạn quyền xem | Giữ ID phục vụ điều tra thay cho toàn bộ mã |
| VH04 | Số lượt tổng lệch với sổ giao dịch | Rà soát sổ giữ/tiêu thụ/giải phóng, sửa có nhật ký | Không tự tăng hạn mức để che sai lệch |

## 16. Chính sách CTV và các quyết định bổ sung cần duyệt

Các mục dưới đây bổ sung mục 14; chưa được coi là đã triển khai hoặc đã được chủ shop đồng ý.

| Quyết định | Đề xuất |
|---|---|
| Ghi nhận lần mua sau | Theo lượt giới thiệu hợp lệ trong thời hạn; không gắn vĩnh viễn |
| Thời hạn link | Admin cấu hình; 30 ngày chỉ là ví dụ |
| Ưu tiên giữa A/B | Lượt hợp lệ gần nhất có phạm vi bao phủ từng dòng |
| Link sản phẩm hay toàn shop | Xác minh loại đang có; chỉ mở toàn shop sau chốt ảnh hưởng đến CTV |
| Mã giảm giá có đổi CTV không | Mặc định không; mã giới thiệu có hoa hồng phải có chính sách riêng |
| Tự mua của CTV | Chốt cho phép hay không, tiêu chí xét duyệt và cách khiếu nại |
| Thời điểm chi hoa hồng | Giao thành công và hết thời gian đối soát/đổi trả được cấu hình |
| Đổi tỷ lệ khi đã đặt | Giữ tỷ lệ snapshot; điều chỉnh ngoại lệ có lịch sử và thông báo |
| Hoàn sau khi đã chi | Điều chỉnh kỳ tiếp theo, xử lý số dư âm theo chính sách được duyệt |
| Voucher thanh toán và cơ sở CTV | Không tự trừ như chiết khấu; voucher tài trợ marketing cần quyết định riêng |
| Shop hết hàng sau chốt | Chốt chính sách giữ quyền lợi và ai chịu khoản chênh lệch |
| Link khi đổi thiết bị/tài khoản | Chỉ liên kết khi có bằng chứng định danh; không hứa ghi nhận khi dữ liệu không đủ |

## 17. Cách dùng phụ lục khi triển khai

1. Chốt chính sách ở mục 14 và 16; mọi giá trị ví dụ vẫn là ví dụ cho đến khi được duyệt.
2. Gắn mã tình huống vào yêu cầu và test; tình huống thuộc giai đoạn sau đánh dấu chưa hỗ trợ và không bật UI cho khách dùng.
3. Với mỗi test ghi đầu vào (khách, giỏ, mã, CTV, thời gian), trạng thái trước/sau, tiền hàng/giảm/ship/đã trả/còn thu, lượt/ngân sách, hoa hồng và kết quả KiotViet nếu có.
4. Kiểm tra toàn luồng KH01 → CT01 → TT06/TT13 → DH10/DH13, không chỉ kiểm tra phép tính giảm giá riêng lẻ.
5. Ca cạnh tranh TT02–TT05 và KV03–KV04 cần test nhiều yêu cầu đồng thời và lỗi sau từng bước ghi, không chỉ thao tác thủ công lần lượt.
6. Ghi kết quả Đạt / Không đạt / Chưa hỗ trợ cùng bằng chứng. Không coi việc mô tả trong tài liệu là tính năng đã hoàn thành.

Phạm vi cập nhật lần này: chỉ bổ sung tài liệu kế hoạch và các tình huống; chưa thay đổi code, database hoặc cấu hình ưu đãi thực tế.

## 18. Đặc tả UI/UX thống nhất cho Shop, Admin và CTV

### 18.1. Mục tiêu và cơ sở tham khảo

Người lần đầu sử dụng phải nhận biết được: mình đang ở đâu, được lợi gì, cần bấm gì tiếp theo và số tiền đang xem là tạm tính hay đã chốt. Đây là mục tiêu phải kiểm thử với người dùng, không thể bảo đảm chỉ bằng việc chọn màu và bo góc.

Tham khảo bổ sung từ nguồn chính thức:

- [Shopify — Quản lý giảm giá](https://help.shopify.com/en/manual/discounts/managing-discounts): chỉnh sửa, nhân bản, tạm dừng và lọc chương trình. Áp dụng cho cách tổ chức công việc admin.
- [Shopify — Thiết kế form](https://shopify.dev/docs/apps/design/user-experience/forms): hành vi lưu rõ ràng. Aloha giữ lưu nháp/kích hoạt tách biệt, không tự phát hành khi đang gõ.
- [Amazon Associates — Báo cáo](https://affiliate-program.amazon.com/help/node/topic/GMWAK55DQX8JEK7C): trình bày lượt bấm, hàng đặt/giao và thu nhập, có thông tin thời điểm cập nhật.
- [Amazon Associates — Khoản âm trong thu nhập](https://affiliate-program.amazon.com/help/node/topic/GF7VJDBPANJTKYQE): trả/hoàn có thể dẫn tới điều chỉnh hoa hồng. Aloha cần giải thích khoản điều chỉnh và liên kết giao dịch gốc.

Kết hợp các nguồn Shopee, Tiki, KiotViet tại mục 2 và 5.5. Đây là tham khảo luồng sử dụng, không sao chép thương hiệu hoặc cam kết mọi sàn có cùng bố cục. Chưa đánh giá giao diện thực tế bằng trình duyệt ở lượt lập kế hoạch này.

### 18.2. Ngôn ngữ thiết kế Aloha

| Hạng mục | Đặc tả đề xuất |
|---|---|
| Phong cách | Sáng, thoáng, nền trung tính, thẻ trắng, đường viền nhẹ; ưu tiên số tiền và hành động |
| Màu | Tái sử dụng token `--aloha-green`, `--aloha-ink`, `--aloha-muted`, `--aloha-price`, radius/shadow hiện có; không dựng bộ màu riêng cho ưu đãi |
| Phân cấp | Tiêu đề trang 24–28px desktop/20–24px mobile; nội dung 14–16px; điều kiện quan trọng không dùng chữ nhỏ khó đọc |
| Khoảng cách | Nhịp 4/8px; khoảng trong thẻ 16–24px, giữa các nhóm 16–24px; bố cục co theo màn hình |
| Số tiền | Canh phải trong bảng, chữ số đều chiều rộng, định dạng VND thống nhất; không cắt cụt tổng tiền |
| Nút | Mỗi khu vực có một hành động chính rõ nhất; nút phụ nhẹ hơn; icon phải có nhãn khi ý nghĩa chưa hiển nhiên |
| Thẻ ưu đãi | Mức giảm → điều kiện chính → hạn → trạng thái/hành động; tên dài được xuống dòng |
| Trạng thái | Nhãn chữ cộng màu/icon; xanh cho hợp lệ, vàng cho cần xử lý, đỏ cho lỗi, xám cho chưa khả dụng |
| Chuyển động | Ngắn, phục vụ phản hồi; tôn trọng giảm chuyển động; không banner nhấp nháy/countdown giả |
| Nhất quán | Dùng Ant Design trong admin/CTV theo hệ thống hiện tại; shop giữ phong cách hiện có; chia sẻ token và thuật ngữ |

Không bắt buộc đổi framework hoặc đưa Polaris vào repo. Các kích thước là tiêu chí thiết kế đề xuất cần đối chiếu token hiện tại khi dựng prototype.

### 18.3. Responsive theo nội dung

| Màn hình | Shop | Admin | CTV |
|---|---|---|---|
| 320–767px | Một cột; thẻ ưu đãi hiện có; bảng chọn từ dưới; tổng/nút đặt hàng ở thanh đáy hiện có | Menu trong drawer; danh sách chương trình dạng thẻ; form một cột | Giữ menu mobile của portal; thẻ đơn và số dư; nút sao chép dễ chạm |
| 768–1023px | Một hoặc hai cột nếu đủ chỗ; tránh ép ô nhập nhỏ | Form một cột chính, preview thu gọn; bộ lọc mở thành panel | KPI hai cột; danh sách thích ứng, chi tiết drawer |
| Từ 1024px | Giỏ/nội dung trái, ưu đãi và bảng tiền phải; sticky không che footer | Sidebar hiện có; bảng danh sách; form và preview bên cạnh | Sidebar hiện có; bảng chuyển đổi; bộ lọc và chi tiết bên cạnh |

Ở tablet, quyết định theo vùng nội dung còn lại chứ không chỉ độ rộng thiết bị. Tái sử dụng breakpoint dự án khi phù hợp.

- Kiểm tra tối thiểu 320, 360, 390, 768, 1024, 1440px, cả xoay ngang và zoom 200%.
- Không cuộn ngang toàn trang. Bảng tài chính chi tiết có thể cuộn trong vùng được chỉ dẫn; tác vụ chính và số tiền tổng không bị khuất.
- Bảng chọn mobile tối đa khoảng 90% vùng nhìn thấy, có safe area và chiều cao thích ứng bàn phím. Khi nhập mã, ô nhập/lỗi/nút áp dụng vẫn tiếp cận được.
- Không có hai thanh cố định đè nhau. Thêm khoảng đệm cuối trang bằng chiều cao thanh đáy thực tế.
- Thông tin bị rút gọn trên thẻ phải mở được bằng “Xem chi tiết”, không phụ thuộc hover.

### 18.4. Shop — khách nhìn thấy lợi ích ngay

#### A. Trang sản phẩm

Giữ ảnh, tên, giá và mua hàng là trọng tâm. Gần giá đặt một dòng ngắn như “Khách mua web lần đầu được giảm 10%” kèm điều kiện/trần thực tế và “Xem điều kiện”. Không ghi giá sau ưu đãi như giá chắc chắn nếu chưa xác minh khách.

#### B. Giỏ và xác nhận đơn

Dùng lại thẻ CheckoutSummaryAside theo mục 5.1.1. Trình tự đọc:

1. Tiền hàng.
2. Ưu đãi đã áp dụng, lý do và số giảm.
3. Phí giao hàng hoặc trạng thái chờ xác định.
4. Tổng tạm tính/tổng đã chốt đúng trạng thái đơn.
5. Nút hành động chính theo quy trình hiện tại.

Ví dụ thẻ sau khi áp dụng: **Đã giảm 80.000đ**; dòng phụ “Ưu đãi lần đầu · Tự áp dụng”; nút phụ **Xem/Đổi**. Khách không cần mở thẻ để nhận giảm.

#### C. Bảng ưu đãi

Thứ tự: tiêu đề “Ưu đãi cho đơn này” → mức tiết kiệm hiện tại → ô “Bạn có mã giảm giá?” → lựa chọn tự động → các mã có thể chọn → mã chưa đủ điều kiện có lý do. Mỗi mã có một nút rõ như “Áp dụng mã này”, không dùng biểu tượng khó đoán.

Mã đủ điều kiện ở trên; trong chế độ tự chọn sắp theo lợi ích thực tế. Mã cá nhân một lần chỉ gợi ý. Chỉ gắn “Tiết kiệm nhất” trong phạm vi ứng viên đã giải thích ở mục 5.5.

Nút mở điều kiện không thay lựa chọn; nút chọn mã không đóng ngay khi còn lỗi kiểm tra. Khi xác nhận thành công, đóng panel, trả focus về thẻ và cập nhật bảng tiền. Toast ngắn là phản hồi phụ; kết quả phải còn nhìn thấy trên trang.

#### D. Sau đặt hàng

Hiển thị tên ưu đãi, tiền giảm, tổng chốt và bước tiếp theo. Đơn chờ ảnh/báo giá dùng “Ưu đãi tạm tính” với giải thích ngắn. Khi tổng đổi, trình bày tiền trước/sau và nguyên nhân, không chỉ báo “Có lỗi”.

### 18.5. Admin — tạo đúng ngay từ lần đầu

#### A. Trang danh sách

Header: “Ưu đãi” + mô tả một câu + nút **Tạo ưu đãi**. Dưới là các trạng thái có số lượng, ô tìm kiếm, bộ lọc. Bộ lọc đã chọn hiện thành nhãn có nút bỏ; có “Xóa bộ lọc”. Giữ bộ lọc và vị trí khi mở chi tiết rồi quay lại.

Desktop ưu tiên cột: tên, cách áp dụng, giá trị, thời hạn, trạng thái, đã dùng/giới hạn. Tiền ngân sách và dữ liệu ít dùng mở trong chi tiết. Mobile mỗi chương trình thành thẻ cùng các thông tin này; không nhét nguyên bảng desktop vào màn hình nhỏ.

#### B. Tạo và sửa

Đầu tiên chọn mẫu: **Khách mua lần đầu**, **Đơn đạt ngưỡng**, **Mã giảm giá**. Mẫu chỉ điền cấu hình gợi ý và vẫn cho sửa; không tạo chương trình hoạt động ngay.

Form chia nhóm theo thứ tự: thông tin → giá trị → điều kiện → khách/hàng → thời gian → giới hạn. Tùy chọn ít dùng trong “Thiết lập nâng cao”; điều kiện ảnh hưởng trực tiếp tiền không được giấu khó tìm.

Mỗi trường có nhãn cố định, đơn vị %/đ rõ và ví dụ ngắn. Radio “Trên/Từ” đi kèm ví dụ đúng 1.000.000đ có được hưởng hay không. Không bắt admin nhập JSON hoặc tên trường kỹ thuật.

Preview bên phải trên desktop; mobile có nút “Xem khách sẽ thấy gì”. Preview gồm thẻ ưu đãi, câu tóm tắt và một giỏ mẫu, được đánh dấu đang xem thử. Nếu preview lỗi/cũ, không trình bày như đã kiểm chứng.

Thanh lưu hiện rõ “Có thay đổi chưa lưu”, **Lưu nháp** và **Kích hoạt/Lên lịch**. Khi lỗi, giữ dữ liệu, đưa focus tới nhóm lỗi đầu và có tóm tắt lỗi. Thoát khi chưa lưu có lựa chọn ở lại hoặc bỏ thay đổi. Xác nhận chỉ dùng cho thao tác có ảnh hưởng, không chặn mọi lần nhập.

#### C. Chi tiết và vận hành

Các tab: Thông tin / Mã / Lượt sử dụng / Lịch sử thay đổi. Mở dòng sử dụng xem đơn, tiền giảm và trạng thái giữ/đã dùng/giải phóng. Tab Voucher KiotViet có thời điểm đồng bộ và nút thử lại; nguồn dữ liệu được phân biệt rõ cho admin.

Tạm dừng chương trình: hiển thị số đơn đang giữ và giải thích chỉ chặn lượt mới. Bản so sánh trước/sau khi sửa tập trung giá trị, ngưỡng và thời gian. Lỗi đồng bộ có hành động tiếp theo, không chỉ đổ thông báo kỹ thuật.

### 18.6. CTV — biết chia sẻ gì và vì sao nhận số tiền đó

Đã đọc source CtvPortalShell và ConversionsPanel: portal có Tổng quan, Báo cáo chuyển đổi, Thanh toán, Sản phẩm, Tài khoản; báo cáo đã có nhãn và giải thích trạng thái hoa hồng. Mở rộng các khu vực này trước khi thêm menu mới. Chưa khẳng định mọi màn hình hiện tại đã đạt responsive nếu chưa kiểm tra trình duyệt.

| Màn hình | Nội dung chính | Hành động dễ nhận biết |
|---|---|---|
| Tổng quan | Hoa hồng tạm tính, chờ đối soát, có thể thanh toán, đã chi; kỳ thời gian và lần cập nhật | “Chọn sản phẩm để chia sẻ” và mở chi tiết từng số |
| Sản phẩm | Ảnh/tên/giá, tỷ lệ, cơ sở tính hoa hồng, ưu đãi khách có thể hưởng và điều kiện | “Sao chép link”; “Xem như khách” là nút phụ |
| Báo cáo chuyển đổi | Mã đơn, trạng thái đơn, tiền hàng được ghi nhận, giảm được phân bổ, tỷ lệ, hoa hồng | “Xem cách tính” |
| Chi tiết hoa hồng | Dòng sản phẩm, snapshot tỷ lệ, phần giảm, tiền cơ sở, khoản điều chỉnh và lịch sử | Mở đơn được phép xem hoặc gửi yêu cầu đối soát |
| Thanh toán | Số đủ điều kiện, kỳ thanh toán, đang xử lý, đã chi và điều chỉnh | Nút yêu cầu thanh toán chỉ nếu quy trình hiện tại hỗ trợ; không tự tạo nghiệp vụ mới |

Tách ba loại trạng thái: đơn hàng, thanh toán của khách, hoa hồng. Ví dụ “Khách đã thanh toán” đi cùng “Hoa hồng chờ giao hàng”; không gộp thành một nhãn “Thành công” gây hiểu nhầm đã rút được tiền.

Chi tiết ví dụ: “Tiền hàng thuộc bạn: 1.000.000đ → ưu đãi phân bổ: 100.000đ → tiền tính hoa hồng: 900.000đ × 5% → tạm tính: 45.000đ”. Hiển thị khoản trừ hoàn hàng riêng, có ngày/lý do/giao dịch gốc. Không xóa dòng cũ khiến CTV không hiểu vì sao số dư giảm.

Trang sản phẩm chưa biết giỏ và khách cuối không được hứa chắc hoa hồng sau ưu đãi. Ghi “Ước tính theo giá hiện tại; thay đổi theo ưu đãi và đơn thực tế”. Link sản phẩm/toàn shop phải có nhãn phạm vi đúng khả năng đang hỗ trợ.

Khi sao chép: thông báo “Đã sao chép link”, cho sao chép thủ công nếu trình duyệt từ chối. Chia sẻ nội dung phải kèm điều kiện ưu đãi, không hứa mọi khách đều giảm lần đầu. Xem như khách không tính lượt click thật hoặc tạo hoa hồng thử.

Desktop báo cáo dạng bảng có lọc thời gian/trạng thái; mobile dạng thẻ đơn, tiền và trạng thái nổi bật, mở chi tiết theo dòng. Xuất báo cáo là thao tác phụ. Chỉ hiển thị dữ liệu và phần đơn thuộc CTV đó; che dữ liệu khách không cần thiết, không lộ hoa hồng CTV khác.

### 18.7. Bộ trạng thái dùng chung

| Trạng thái | Cách hiển thị | Hành động |
|---|---|---|
| Lần đầu chưa có dữ liệu | Giải thích một câu đúng vai trò | Shop tiếp tục mua; admin tạo ưu đãi; CTV chọn sản phẩm |
| Đang tải lần đầu | Khung chờ có kích thước ổn định | Không hiện số 0 như dữ liệu thật |
| Làm mới dữ liệu | Giữ dữ liệu cũ có nhãn đang cập nhật | Không chặn toàn trang; chặn hành động cần báo giá mới |
| Lỗi mạng | Lý do dễ hiểu, giữ dữ liệu đã nhập | Thử lại; không gửi lặp khi chưa rõ kết quả |
| Thành công | Thay đổi hiển thị ngay trong ngữ cảnh | Toast hỗ trợ, không là bằng chứng duy nhất |
| Không đủ điều kiện | Lý do cụ thể trong phạm vi được phép tiết lộ | Mua thêm/xem hàng hợp lệ/chọn mã khác |
| Không có quyền | Không cho sửa và giải thích phù hợp | Liên hệ quản lý nếu cần |
| Dữ liệu cập nhật chậm | Thời điểm cập nhật và trạng thái đối soát | Làm mới; không hứa số tiền đã quyết toán |

### 18.8. Khả năng tiếp cận và hiệu năng

Mục tiêu thiết kế: vùng chạm 44×44px, tương phản chữ thường ít nhất 4,5:1; chữ lớn ít nhất 3:1. Đây là tiêu chí nghiệm thu của Aloha; chưa tuyên bố sản phẩm hiện tại đạt chứng nhận nào.

Modal/drawer có tiêu đề, đóng bằng nút và bàn phím, quản lý focus và trả focus khi đóng. Lỗi gắn với trường nhập. Thay đổi số tiền được thông báo cho công cụ hỗ trợ nhưng không đọc lặp liên tục theo từng phím.

Không dùng tooltip làm nơi duy nhất giải thích trần giảm hoặc trạng thái hoa hồng. Không chỉ gạch ngang/đổi màu để diễn đạt hết hạn. Nội dung Việt dài, số tiền lớn, tên sản phẩm nhiều dòng đều phải kiểm tra.

Danh sách lớn phân trang phía server; tìm kiếm có debounce và hủy/bỏ kết quả cũ. Ảnh đúng kích thước, không tải toàn bộ ví mã hay báo cáo một lần. Không thêm thư viện biểu đồ nặng chỉ để trang trí; biểu đồ có số liệu tóm tắt thay thế.

### 18.9. Bố cục tham chiếu để dựng prototype

**Shop mobile:** sản phẩm → giao nhận → thẻ “Đã giảm … / Xem-Đổi” → điều kiện xác nhận; thanh đáy hiện có chứa tổng và đặt hàng. Panel ưu đãi mở trên cùng, không chồng thêm thanh đặt hàng vào panel.

**Admin desktop:** sidebar hiện có | tiêu đề + Tạo ưu đãi | lọc | bảng; khi sửa: form 2/3 vùng nội dung và preview 1/3. Mobile chuyển một cột, preview mở theo yêu cầu.

**CTV mobile:** tiêu đề/kỳ báo cáo → các số tiền theo trạng thái → nút chia sẻ → đơn gần đây → xem chi tiết cách tính. Giữ menu của portal; không tự thêm bottom navigation nếu gây trùng drawer hiện có.

### 18.10. Kiểm thử người dùng lần đầu và tiêu chí bàn giao

Trước triển khai đầy đủ, dựng prototype các màn hình: shop xác nhận đơn và bảng ưu đãi; admin danh sách/tạo/sửa/preview; CTV sản phẩm/báo cáo/chi tiết hoa hồng. Có bản mobile và desktop, kèm tải/rỗng/lỗi/mất điều kiện.

Thử tối thiểu 5 người mỗi vai trò với nhiệm vụ phù hợp; đây là kiểm tra định tính ban đầu, không phải bằng chứng thống kê cho mọi người dùng. Không hướng dẫn trước vị trí nút.

| Vai trò | Nhiệm vụ | Mục tiêu đề xuất |
|---|---|---|
| Khách | Chỉ ra đang giảm bao nhiêu và còn trả bao nhiêu | Tìm đúng trong 10 giây |
| Khách | Đổi mã và giải thích vì sao mã khác chưa dùng được | Hoàn thành trong 30 giây sau khi trang tải |
| Admin | Tạo nháp giảm lần đầu có trần/ngày và xem thử | Hoàn thành trong 3 phút, không kích hoạt nhầm |
| Admin | Dừng chương trình và giải thích ảnh hưởng đơn cũ | Không hiểu nhầm là hủy mọi ưu đãi đã giữ |
| CTV | Lấy link đúng sản phẩm để chia sẻ | Trong 20 giây |
| CTV | Giải thích vì sao 1 triệu × 5% chỉ còn 45.000đ | Tìm được giảm 100.000đ và cơ sở 900.000đ |
| CTV | Phân biệt tiền tạm tính và tiền được thanh toán | Không nhầm hai trạng thái |

Mục tiêu đạt ít nhất 4/5 người mỗi nhóm hoàn thành không cần trợ giúp; mọi lỗi gây hiểu sai tiền, áp dụng mã ngoài ý muốn hoặc kích hoạt nhầm đều phải sửa dù đạt tỷ lệ. Đo lại sau sửa. Không ghi “dễ dùng ngay” chỉ dựa vào cảm nhận người thiết kế.

Checklist bàn giao UI: dùng lại thẻ ưu đãi shop; giữ shell admin/CTV; bảng tiền và thuật ngữ thống nhất; trạng thái đầy đủ; responsive không che nội dung; bàn phím sử dụng được; chính sách ở mục 14/16 phản ánh đúng trong nhãn; không hiển thị nút chức năng backend chưa hỗ trợ.

Phần này là đặc tả mở rộng cho các giai đoạn ở mục 12. Chưa tạo prototype, chưa sửa giao diện hay triển khai tính năng trong lần cập nhật kế hoạch này.
