# Kế hoạch ưu đãi và voucher Aloha

Ngày lập: 28/09/2026. Trạng thái: đề xuất để triển khai, chưa viết code tính năng.

## 1. Mục tiêu và quyết định kiến trúc

Ràng buộc triển khai: sử dụng công nghệ và thành phần sẵn có đã kiểm tra tại mục 19. Các đề xuất dữ liệu, UI và API trong tài liệu phải được triển khai theo bản đồ đó; không mặc định đưa thêm framework hoặc dịch vụ mới.

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
- Nhóm khách/sản phẩm nâng cao và ưu đãi ship nếu cần; mở từng loại kèm quy tắc kết hợp rõ. Voucher hỗ trợ phí ship theo khu vực: xem mục 24.
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
| Ngưỡng miễn ship trước hay sau giảm? | Chốt 29/09/2026: sau mọi giảm tiền hàng, không cộng ship, tính ở server (mục 24.7.2) |

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

## 19. Áp dụng công nghệ và thành phần sẵn có của dự án

### 19.1. Phạm vi xác minh

Đã đọc package.json gốc/frontend cùng source của shell, checkout, query/store CTV, provider giao diện, Redis, sync bus và ví dụ test ngày 28/09/2026. Phiên bản dưới đây là dải khai báo trong manifest, không khẳng định là phiên bản đã cài hoặc đang chạy production. Chưa kiểm tra kết nối Redis, topology MongoDB hoặc hệ thống triển khai thực tế.

### 19.2. Bản đồ công nghệ → tính năng

| Công nghệ có sẵn | Bằng chứng | Áp dụng trong kế hoạch |
|---|---|---|
| Next.js ^15.5.2, React ^19.2.6, TypeScript | frontend/package.json; frontend/app | Giữ App Router; thêm trang ưu đãi admin trong cây route hiện tại; thành phần tương tác dùng client component đúng phạm vi |
| Tailwind CSS ^4.1.14 và token Aloha | frontend/package.json; CheckoutSummaryAside | Responsive shop, màu/radius/shadow hiện có; không thêm bộ CSS độc lập |
| Ant Design ^6.6.4 | AdminAntdProvider, AdminShell, CtvPortalShell | Table/Card/Form controls/Drawer/Modal/Tag trong admin và CTV; theme/locale Việt sẵn có |
| Lucide React, @ant-design/icons | Manifest, các shell | Dùng icon cùng bộ với khu vực hiện tại; Ticket cho ưu đãi, nhãn chữ cho hành động |
| React Hook Form ^7.86.0, resolvers ^5.9.1, Zod 4 | PayoutPanel, AccountPanel, form admin/si | Form cấu hình chương trình, mã và preview; validate trường, lỗi theo nhóm, dữ liệu bẩn chưa lưu |
| TanStack React Query ^5.90.2 | ctvPortalQueries, query admin | Danh sách/chi tiết/báo cáo, mutation và invalidation; cache theo khách, quyền, bộ lọc |
| Zustand ^5.0.14 | ctvPortalUiStore | Trạng thái UI: bộ lọc, tab, chế độ chọn; không là nguồn xác nhận tiền/lượt |
| Sonner ^2.0.8 | Shell và provider hiện tại | Toast lưu thành công/sao chép; lỗi quan trọng vẫn nằm tại form/thẻ |
| Express ^4.21.2, TypeScript, tsx ^4.21.0 | package.json, backend/shop_standalone_server.ts | Module backend/shopPromotions theo cách đăng ký route hiện có; bộ tính dùng lại cho preview và checkout |
| MongoDB driver ^7.5.0 | package.json, các collection shopOrders | Lưu cấu hình, phiên bản, snapshot, sổ lượt, audit và công việc đồng bộ bền vững |
| Redis ^4.7.1 | backend/redis.ts | Cache, khóa có owner/TTL khi phù hợp, pub/sub và hỗ trợ hạn chế tần suất; không thay sổ tiền MongoDB |
| SSE + syncBus + Redis pub/sub | backend/syncBus.ts, AdminOpsSync, CtvMeStreamSync | Báo thay đổi sau commit để client làm mới dữ liệu theo quyền |
| JWT, cookie-parser và xác thực shop/admin hiện có | Manifest; middleware/shell hiện tại | Tái sử dụng phiên và quyền; không tạo hệ đăng nhập riêng cho ưu đãi |
| ExcelJS ^4.4.0; exportCsv hiện có | Manifest gốc; shared/format CTV | CSV cho báo cáo đơn giản, Excel khi thật sự cần; giới hạn quyền và dữ liệu xuất |
| node:test, node:assert, tsx, TypeScript | tests/checkout-submit.test.ts và manifest | Kiểm thử bộ tính/trạng thái và tích hợp theo cách repo đang dùng |

Không nâng dependency chỉ vì có tính năng mới. Zod backend/frontend đang có dải phiên bản khác nhau; hợp đồng payload cần tương thích và được kiểm thử, không giả định cài đặt giống hệt.

### 19.3. Tái sử dụng frontend theo từng vai trò

**Shop:** giữ route xác nhận đơn `frontend/app/(storefront)/xac-nhan-don-hang/page.tsx`, CheckoutSummaryAside và CheckoutStickyBar. Thêm thành phần hiển thị/chọn ưu đãi nhỏ dùng chung với giỏ; nhận kết quả báo giá đã kiểm chứng. Dùng formatVnd hiện có. Bảng chọn có thể dùng primitive sẵn có phù hợp storefront; phải kiểm tra provider/theme trước khi đưa Ant Design vào shop, không kéo toàn bộ shell admin vào checkout.

**Admin:** route `/admin/uu-dai` chạy trong AdminShell; bổ sung AdminSidebar; dùng AdminAntdProvider để thống nhất theme. Tái sử dụng AdminDateRangePicker và các mẫu tìm kiếm/phân trang hiện có nếu hợp đồng phù hợp. Form phức tạp dùng React Hook Form + Zod; Ant Design cung cấp control/layout. Không để Antd Form và React Hook Form cùng sở hữu hai bản giá trị của một trường.

**CTV:** mở rộng các panel tại `frontend/components/ctv-portal/panels/`: ProductsPanel, OverviewPanel, ConversionsPanel, PayoutPanel. Giữ CtvPortalShell, ctvPortalFetch, query keys có định danh khách và bộ lọc thời gian. Dùng `CTV_COMMISSION_UX`, `resolveCtvCommissionStatus`, `ctvCommissionHint` trong shared/format làm điểm thống nhất nhãn; bổ sung mapping khi có trạng thái mới thay vì tạo bộ nhãn thứ hai.

Các biểu đồ nhỏ ưu tiên mẫu DailySpark/ConversionCard sẵn có. Không thêm thư viện biểu đồ chỉ để minh họa vài số tổng.

### 19.4. Phân chia trạng thái và luồng dữ liệu

| Loại trạng thái | Nơi quản lý | Quy tắc |
|---|---|---|
| Cấu hình/lượt/ngân sách/đơn thật | Backend và MongoDB | Nguồn quyết định cuối cùng |
| Danh sách, báo cáo, báo giá nhận từ server | React Query hoặc cơ chế fetch hiện có được tích hợp nhất quán | Query key bao gồm khách và đầu vào ảnh hưởng kết quả; phản hồi cũ không thay phản hồi mới |
| Form đang sửa | React Hook Form | Default values rõ; phát hiện revision khi lưu |
| Panel mở, filter, chế độ tự động/thủ công | Local state hoặc Zustand khi cần chia sẻ | Không persist token, dữ liệu khách hoặc số tiền đã tính như dữ liệu đáng tin |
| Trạng thái cập nhật thời gian thực | SSE → invalidate query → fetch | Sự kiện là tín hiệu làm mới, không là chứng từ đã thu tiền |

Admin lưu → backend xác thực và commit → publish thay đổi → client invalidate cấu hình/báo giá liên quan. Checkout đã chốt vẫn dùng snapshot. SSE bị mất kết nối thì refetch khi focus hoặc polling theo `visibleRefetchInterval`; lần đặt hàng luôn kiểm tra lại ở server.

Không cập nhật lạc quan số tiền đã được giữ/đã dùng hoặc số dư CTV trước khi server xác nhận. Logout/đổi tài khoản phải xóa cache và lựa chọn riêng của khách cũ. Mã cá nhân không persist ở store chung không gắn định danh.

### 19.5. Backend, khóa và lưu trữ

Giữ Express và MongoDB native driver; không đưa ORM mới vào module ưu đãi. Tách evaluator thuần, validation, repository, reservation, route và mapping KiotViet để kiểm thử độc lập.

Tái sử dụng middleware xác thực/role hiện có và `shopRateLimitOrReject` sau khi đọc hành vi fallback. Hạn chế thử mã theo định danh phù hợp, không chỉ theo IP dùng chung. Payload client chỉ nêu giỏ và lựa chọn, không quyết định tiền giảm hoặc quyền CTV.

Redis hiện có `redisAcquireLock`, `redisRenewLock`, `redisReleaseLock`: có thể tái sử dụng cho giảm tranh chấp, phải giữ owner token và xử lý mất khóa. Redis offline hoặc TTL hết không được cho hai đơn vượt ngân sách. Ràng buộc duy nhất và cập nhật có điều kiện trong MongoDB vẫn bắt buộc.

Chưa xác minh MongoDB hỗ trợ transaction ở môi trường thật. Trước triển khai phải kiểm tra topology; nếu dùng transaction, thiết kế ranh giới đơn + lượt + ngân sách + công việc đồng bộ. Nếu không có, cần phương án atomic/bù/đối soát được test; không tuyên bố khóa Redis tự giải quyết transaction nhiều tài liệu.

Đọc stockHold để học vòng đời giữ/giải phóng, không dùng chung collection/key với ưu đãi và không sao chép mọi ngữ nghĩa TTL. TTL chỉ dọn dữ liệu phụ sau lưu lịch sử cần thiết; việc hoàn ngân sách thực hiện bằng chuyển trạng thái có điều kiện.

### 19.6. KiotViet, thanh toán và công việc nền

Tiếp tục dùng lớp kết nối hiện có trong shopOrders/kvPush, kvOrderMoneySync, kvPaymentReconcile cùng luồng markPaid/completeDelivered. Đọc đầy đủ từng adapter trước mở rộng. Không dựng đường gọi KiotViet riêng bỏ qua cấu hình, xác thực, kiểm soát retry và quy trình thanh toán hiện tại.

Sổ công việc đồng bộ trong MongoDB là phần sẽ bổ sung theo thiết kế, chưa phải queue đã xác minh tồn tại. Dùng cơ chế tác vụ nền hiện có nếu phù hợp; nếu nhiều instance phải claim công việc nguyên tử, có thời hạn xử lý và retry. Không bắt buộc thêm BullMQ, Kafka hay dịch vụ mới khi chưa chứng minh nhu cầu.

SSE/pub-sub có thể mất sự kiện, nên không dùng làm hàng đợi giao dịch bền vững. Các việc giải phóng lượt, trả tiền và retry KiotViet phải khôi phục được từ dữ liệu đã lưu.

Định dạng giờ dùng tiện ích ngày sẵn có và khả năng Intl của nền tảng khi đủ; nhập/hiển thị Asia/Ho_Chi_Minh, lưu thời điểm UTC. Không thêm thư viện ngày chỉ cho hiển thị đơn giản; kiểm tra cách date picker chuyển đổi trước chốt triển khai.

### 19.7. Kiểm thử và lệnh kiểm tra sẵn có

- Backend: `npm run typecheck:api` sử dụng tsconfig.backend.json.
- Frontend: `npm run typecheck:web`; script frontend có tên lint nhưng thực tế chạy `tsc --noEmit`, không phải ESLint.
- Cả hai: `npm run typecheck`.
- Kiểm thử logic mới theo node:test/assert và cách chạy TypeScript hiện có trong repo; phải kiểm tra lệnh runner trước dùng, không giả định có npm test.
- Build frontend khi đã thay UI: `npm run build --prefix frontend`.
- Manifest đã đọc chưa khai báo Playwright/Cypress/Vitest/Jest. Các yêu cầu E2E ở mục 12–13 là mục tiêu kiểm chứng, chưa được coi là đã có framework. Kiểm tra script/tooling thực tế rồi chọn kiểm tra trình duyệt hoặc đề xuất dependency cần thiết riêng.
- Test concurrency thật cần MongoDB/Redis phù hợp môi trường thử, không thể thay hoàn toàn bằng mock bộ nhớ. Không chạy thử ghi tiền/đơn trên production.

Lượt này chỉ cập nhật Markdown, không chạy build/test ứng dụng hoặc cài package.

### 19.8. Checklist trước khi bắt đầu code theo kế hoạch

1. Đọc lại module vì kế hoạch tách file có thể đã đổi vị trí; dùng tên hàm/route để tìm.
2. Kiểm tra lockfile, phiên bản thực tế và provider của vùng UI được mở rộng.
3. Xác định một nguồn form, một nguồn báo giá và một cơ chế phân quyền cho mỗi luồng.
4. Xác minh transaction MongoDB, Redis fallback, công việc nền, SSE và khả năng retry KiotViet.
5. Tái sử dụng giao diện/tiện ích được liệt kê trước khi tạo bản khác; thêm module nghiệp vụ mới khi trách nhiệm thật sự mới.
6. Bất kỳ dependency mới nào phải nêu khoảng trống mà công nghệ hiện có chưa đáp ứng, tác động vận hành và cách kiểm thử. Phạm vi cơ bản ưu đãi web dự kiến dùng stack hiện tại.

Đây là ràng buộc công nghệ cho toàn bộ kế hoạch, không phải thay đổi phần mềm đã thực hiện. Các công nghệ chỉ mới có trong manifest được phân biệt với khả năng đã thấy dùng trong source và khả năng production còn cần xác minh.

## 20. Kế hoạch QA/QC và quy tắc thực thi test

### 20.1. Mục tiêu, phạm vi và giới hạn

Bộ test dưới đây ánh xạ đầy đủ 142 tình huống mục 15 thành 142 test case riêng, cộng 42 test case bổ sung về bảo mật, validation, khôi phục, hiệu năng, UI và E2E: **184 test case cấp cao**. Một case có nhiều bộ dữ liệu phải chạy từng bộ riêng; số lần chạy thực tế lớn hơn 184.

Không có bộ test hữu hạn bao phủ mọi sự cố. Đây là bộ kiểm thử theo rủi ro của Aloha, không phải chứng nhận “chuẩn mọi công ty” hoặc bằng chứng phần mềm đang hoạt động đúng. Tất cả hiện là **Not run — Chưa chạy**. Các ví dụ/tỷ lệ ở đây chỉ là fixture thử, không cấu hình production.

Phạm vi theo giai đoạn mục 12: ưu đãi web trước; mã mở rộng/voucher nguồn sau. Chức năng ngoài đợt phát hành đánh dấu Out of scope với lý do và chủ sở hữu; không ghi Pass. Chính sách chưa duyệt hoặc môi trường chưa có phải ghi Blocked khi chuẩn bị chạy.

### 20.2. Vai trò và quy trình

- Chủ sản phẩm/chủ shop: duyệt quy tắc tiền, link CTV, hoàn và các điểm mục 14/16.
- QA: kiểm tra yêu cầu có đo được, phân tích rủi ro, dữ liệu thử, truy vết và kế hoạch.
- Developer: kiểm thử bộ tính, trạng thái, idempotency; cung cấp điểm chèn lỗi ở môi trường thử và hợp đồng API.
- QC/Tester: chạy test, so kết quả thực tế với kỳ vọng, lưu bằng chứng và báo lỗi; QA/QC có thể cùng người nhưng trách nhiệm rõ.
- Người phụ trách vận hành: kiểm chứng đối soát, khôi phục và quyền xử lý ngoại lệ.
- Chủ nghiệp vụ nghiệm thu UAT: chạy luồng shop/admin/CTV và duyệt chính sách; kiểm thử kỹ thuật không thay quyết định này.

### 20.3. Điều kiện vào test

1. Có build/commit cụ thể, phạm vi và chính sách đã duyệt; hợp đồng request/response/status code được ghi rõ.
2. Môi trường riêng, dữ liệu tổng hợp, không khách thật; KiotViet dùng gian hàng thử được phép ghi hoặc mock được ghi rõ.
3. Bộ seed/reset fixture độc lập; khóa đồng hồ cho test biên; giữ timezone Việt Nam. Không dùng chờ nhiều ngày thật.
4. Có tài khoản đúng vai trò: khách mới/cũ/sỉ, hai CTV, admin sửa và admin chỉ xem.
5. Có cách xem snapshot, sổ giữ/used/released, counters, công việc nguồn, giao dịch thu/hoàn và audit bằng quyền kiểm thử.
6. Các test cạnh tranh chạy ít nhất hai instance API nếu kiến trúc triển khai hỗ trợ; test Redis lỗi không làm ảnh hưởng hệ khác.
7. Không áp dụng lỗi mạng/dừng DB/worker vào production. Test runner phù hợp stack mục 19; tài liệu này chưa tạo script seed hoặc test.

### 20.4. Fixture và phép tính chuẩn

| Fixture | Giá trị dùng trong test |
|---|---|
| U_NEW | Khách lẻ đã xác minh, không đơn web thành công, không lượt giữ |
| U_OLD | Khách lẻ đã có đơn web thành công; không còn quyền lần đầu |
| U_STORE | Chỉ có giao dịch cửa hàng thành công; không lịch sử web |
| U_OTHER, U_NEW1, U_NEW2 | Các định danh độc lập; dùng khi cần kiểm tra quyền hoặc tranh lượt |
| U_SI | Khách sỉ đang hoạt động; giá riêng theo ca |
| G800 | Hàng đủ điều kiện 800.000đ, ship 30.000đ |
| G1000 | Hàng đủ điều kiện 1.000.000đ; ship 0 nếu ca không ghi khác |
| GXY | X=600.000đ, Y=400.000đ; ship 0; A/X 5%, B/Y 8% khi cần CTV |
| FIRST10 | Tự động 10%, trần 200.000đ, lần đầu web, không cộng ưu đãi toàn đơn |
| BIG100 | Tự động giảm 100.000đ, >1.000.000đ; ca ghi >= hoặc trần khác sẽ ghi đè |
| FIX100 | Mã chọn tay giảm 100.000đ, không ngưỡng, phạm vi toàn bộ hàng đủ điều kiện |
| PRIVATE | Mã cá nhân thuộc người được chỉ định, một lần; giá trị ghi tại từng ca |
| T0/T1 | Bắt đầu/kết thúc; đề xuất khoảng [T0,T1), cần duyệt làm hợp đồng thời gian |
| K1/K2, PAY1, R1 | Khóa đặt đơn, mã giao dịch thu và mã hoàn độc lập trong mỗi test |
| Ưu tiên khi bằng giảm | Priority được cấu hình, sau đó ID ổn định; cần cố định quy tắc trong evaluator |

Reset riêng trước mỗi test. Chỉ bật chương trình được nêu trong case, tránh FIRST10/BIG100 vô tình ảnh hưởng mã khác. Không tạo fixture này thành chương trình thật. Nếu feature đang dùng review-first, thao tác “đặt và trả” phải qua bước shop xác nhận ảnh/báo giá và khách xác nhận cuối; không bỏ qua luồng đó.

Quy tắc số thử: VND nguyên; số giảm tổng làm tròn half-up với số không âm, phân bổ phần dư lớn nhất theo tỷ trọng dòng hợp lệ, khi bằng nhau theo ID dòng ổn định. Đây là đề xuất cụ thể hóa mục 6; nếu chọn thuật toán khác phải duyệt và sửa kỳ vọng GH18 cùng các ca hoàn trước chạy.

### 20.5. Bất biến phải kiểm tra ở mọi ca tiền

- Tổng giảm hàng không âm, không vượt tiền hàng đủ điều kiện; tổng phân bổ dòng bằng tổng giảm.
- Tổng đơn = hàng sau giảm + ship sau giảm + khoản thuế/phụ thu riêng nếu có; không cộng thuế đã nằm trong giá lần nữa.
- Tiền còn thu = max(0, giá trị đơn - tổng phương thức thanh toán được công nhận); trả dư ghi riêng.
- Giữ + đã dùng không vượt hạn/ngân sách; giải phóng/thu/hoàn và hoa hồng có đúng một hiệu lực cho mỗi idempotency.
- Đơn chốt giữ phiên bản, tỷ lệ CTV và nguồn giới thiệu; cấu hình mới không viết lại lịch sử.
- Tổng đã hoàn từng dòng không vượt số lượng/tiền thực trả có thể hoàn; điều chỉnh CTV theo đúng phần ghi nhận.
- UI desktop/mobile, API, DB và KiotViet cùng ngữ nghĩa; không xem toast hoặc HTTP 200 là bằng chứng duy nhất.
- Request bị từ chối không để lại đơn/lượt/tiền mồ côi. Kết quả nguồn chưa rõ thì chờ đối soát, không tự coi chưa từng thành công.

### 20.6. Mức ưu tiên, lớp kiểm thử và bằng chứng

P0: sai tiền, thu/hoàn trùng, vượt quyền/ngân sách, lộ dữ liệu hoặc sai CTV. P1: luồng chính và quản trị. P2: tiện ích, trình bày ít ảnh hưởng tiền. Priority của test khác Severity của lỗi; lỗi mới phải đánh giá mức ảnh hưởng thực tế.

Mỗi test case bên dưới gồm tiền điều kiện/dữ liệu, bước chạy, kỳ vọng và hậu kiểm. Lớp kiểm thử: logic/API cho công thức và quyền; tích hợp DB/nguồn cho đồng thời/đối soát; E2E trình duyệt cho luồng và UI. Mock không được tính là đã xác nhận hợp đồng KiotViet thật.

Phiếu chạy bắt buộc: Run ID, Test ID, bộ dữ liệu, policy version, build/commit, môi trường/trình duyệt/viewport, người chạy, thời gian, Actual Result, Status, evidence và Defect ID. Trạng thái cho phép: Not run, Pass, Fail, Blocked, Out of scope. Hiện mọi test dưới đây mặc định Not run; không có Actual Result hoặc evidence vì chưa chạy.

Bằng chứng tối thiểu: ảnh/video UI nếu liên quan; request/response đã che bí mật; ID đơn/lượt/giao dịch/job; snapshot và counters trước/sau; audit và log correlation ID. Các ca tiền cần đối chiếu phép tính độc lập, không lấy cùng hàm đang kiểm thử để sinh kỳ vọng.

Sau mỗi ca: lưu bằng chứng trước; reset dữ liệu thử theo danh sách ID; khôi phục đồng hồ/cờ lỗi/quyền. Với giao dịch nguồn đã tạo, đóng/hoàn theo quy trình sandbox có audit, không xóa tùy tiện để che trạng thái.

## 21. Test case chi tiết cho 142 tình huống đã liệt kê

Mã TC-<mã tình huống> ánh xạ trực tiếp tới mục 15. Mỗi bước ngăn bằng dấu chấm phẩy trong dữ liệu gốc được chuyển thành bước riêng bên dưới. Phần kỳ vọng nghiệp vụ dẫn chiếu là yêu cầu cần đối chiếu, không phải kết quả chạy.

### Nhóm KH — Khách và lịch sử mua

#### TC-KH01 — Chưa từng mua web, đã xác minh định danh

- **Truy vết:** KH01, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW, G800, chỉ FIRST10 hoạt động.

**Bước thực hiện:**

1. Đăng nhập U_NEW.
2. mở xác nhận không bấm thẻ ưu đãi.
3. đặt đơn K1.

**Kết quả mong đợi:** Giảm 80.000đ, tổng 750.000đ; đúng một lượt giữ 80.000đ.

**Đối chiếu nghiệp vụ/UI:** Cho ưu đãi lần đầu nếu đủ điều kiện khác; giữ quyền khi đặt. Số tiền giảm và điều kiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH02 — Đã mua cửa hàng, lần đầu mua web

- **Truy vết:** KH02, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_STORE có hóa đơn cửa hàng thành công nhưng không đơn web; G800.

**Bước thực hiện:**

1. Đăng nhập.
2. xem giỏ.
3. đặt K1.

**Kết quả mong đợi:** Giảm 80.000đ, tổng 750.000đ; lịch sử cửa hàng không loại quyền web.

**Đối chiếu nghiệp vụ/UI:** Vẫn đủ điều kiện lần đầu web. Ghi rõ “lần đầu trên website”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH03 — Đã có đơn web thành công nhưng chưa từng dùng mã

- **Truy vết:** KH03, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD đã có đơn web thành công không mã; G800.

**Bước thực hiện:**

1. Đăng nhập.
2. yêu cầu FIRST10 trên UI rồi gửi lại lựa chọn qua API.

**Kết quả mong đợi:** FIRST10 bị loại; tổng 830.000đ; không có lượt giữ FIRST10.

**Đối chiếu nghiệp vụ/UI:** Không còn quyền lần đầu. Giải thích dựa trên lần mua, không dựa trên lần dùng mã.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH04 — Chỉ có đơn đã hủy trước thanh toán

- **Truy vết:** KH04, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW từng giữ FIRST10 rồi hủy đơn chưa trả; lượt đã giải phóng.

**Bước thực hiện:**

1. Mở giỏ G800.
2. đặt K2.
3. đọc sổ lượt.

**Kết quả mong đợi:** K2 giữ 80.000đ, tổng 750.000đ; lượt cũ vẫn có lịch sử giải phóng.

**Đối chiếu nghiệp vụ/UI:** Được xét lại sau khi giải phóng lượt. Ưu đãi khả dụng trở lại.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH05 — Có đơn chuyển khoản đang giữ ưu đãi, đặt thêm đơn

- **Truy vết:** KH05, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW đang có K1 chuyển khoản giữ FIRST10; G800.

**Bước thực hiện:**

1. Mở tab khác.
2. đặt K2 với khóa khác.
3. xem K1.

**Kết quả mong đợi:** K1 giữ nguyên; K2 không nhận FIRST10; phải xác nhận báo giá không giảm trước khi tạo nếu tiếp tục.

**Đối chiếu nghiệp vụ/UI:** Không cấp quyền lần đầu cho đơn thứ hai. Đường dẫn đơn đang giữ; hướng dẫn tiếp tục hoặc hủy.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH06 — Có đơn COD đang giao

- **Truy vết:** KH06, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 COD đang giao giữ FIRST10.

**Bước thực hiện:**

1. Cho thời gian vượt TTL chuyển khoản.
2. báo giá G800 trên đơn khác.

**Kết quả mong đợi:** Không giải phóng lượt COD đang giao; không cấp lần đầu thêm.

**Đối chiếu nghiệp vụ/UI:** Giữ quyền đến khi đơn kết thúc. Không hứa cấp lại vì khách chưa trả tiền.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH07 — Đã thanh toán rồi hoàn toàn bộ

- **Truy vết:** KH07, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD có FIRST10 đã thanh toán rồi hoàn toàn bộ.

**Bước thực hiện:**

1. Báo giá G800.
2. nhập FIRST10.
3. thử đặt.

**Kết quả mong đợi:** Không cấp lại lần đầu; tổng 830.000đ; khoản hoàn không xóa dấu đã dùng.

**Đối chiếu nghiệp vụ/UI:** Không tự khôi phục quyền lần đầu. Chính sách hoàn không cấp lại ưu đãi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH08 — Hai tài khoản cùng số điện thoại đã xác minh

- **Truy vết:** KH08, mục 15. **Ưu tiên:** P0. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai tài khoản thử A1/A2 liên kết cùng định danh đã xác minh; G800.

**Bước thực hiện:**

1. A1 đặt K1.
2. A2 báo giá rồi đặt K2.

**Kết quả mong đợi:** Tối đa một quyền đang giữ/đã dùng; A2 không thấy email/tên riêng A1.

**Đối chiếu nghiệp vụ/UI:** Dùng chung định danh xét quyền; không phát sinh hai lượt. Admin có bằng chứng liên kết, không lộ tài khoản kia cho khách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH09 — Khách đổi số điện thoại

- **Truy vết:** KH09, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD đã dùng FIRST10; có quy trình đổi số được duyệt.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đổi và xác minh số mới.
2. đăng nhập lại.
3. báo giá G800.

**Kết quả mong đợi:** Không trở thành khách mới; lịch sử liên kết còn truy vết.

**Đối chiếu nghiệp vụ/UI:** Chuyển liên kết theo quy trình xác minh; giữ lịch sử quyền cũ. Không coi là khách mới chỉ vì đổi số.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH10 — Khách vãng lai chưa đăng nhập

- **Truy vết:** KH10, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Phiên chưa đăng nhập; G800; FIRST10 công khai.

**Bước thực hiện:**

1. Mở checkout.
2. mở điều kiện.
3. đăng nhập U_NEW.
4. báo giá lại.

**Kết quả mong đợi:** Trước đăng nhập chưa trừ FIRST10; sau đăng nhập giảm 80.000đ, tổng 750.000đ.

**Đối chiếu nghiệp vụ/UI:** Cho xem ưu đãi công khai; kiểm tra lần đầu sau đăng nhập. “Đăng nhập để kiểm tra ưu đãi”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH11 — Mua hộ, số người nhận khác chủ tài khoản

- **Truy vết:** KH11, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; người nhận có số khác chưa mua; G800.

**Bước thực hiện:**

1. Đổi tên/số giao hàng.
2. tính lại.
3. thử FIRST10.

**Kết quả mong đợi:** Không cấp lại quyền theo người nhận; tổng 830.000đ.

**Đối chiếu nghiệp vụ/UI:** Xét quyền theo người mua đã xác minh. Số nhận hàng không cấp thêm quyền.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH12 — Dữ liệu lịch sử cũ thiếu định danh

- **Truy vết:** KH12, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Khách có đơn cũ không đủ định danh để ghép.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đăng nhập.
2. yêu cầu lần đầu.
3. admin mở trạng thái hỗ trợ.

**Kết quả mong đợi:** Không tự kết luận đủ quyền; thông báo cần xác minh; chưa giữ lượt cho tới quyết định có dấu vết.

**Đối chiếu nghiệp vụ/UI:** Không suy ra khách mới chỉ từ việc thiếu dữ liệu; đối chiếu/mở xử lý thủ công. Trạng thái cần xác minh và quy trình hỗ trợ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH13 — Tài khoản chuyển khách lẻ sang sỉ trước đặt

- **Truy vết:** KH13, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW giá lẻ G800 đang preview FIRST10; giá sỉ tổng 700.000đ.

**Bước thực hiện:**

1. Admin chuyển khách sang sỉ hợp lệ.
2. khách bấm đặt với revision cũ.

**Kết quả mong đợi:** Yêu cầu báo giá lại: tiền hàng 700.000đ, không FIRST10; với ship 30.000đ tổng 730.000đ.

**Đối chiếu nghiệp vụ/UI:** Báo giá lại theo giá và phạm vi mới. Tổng tiền mới cần xác nhận.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KH14 — Nhiều người chung địa chỉ/IP

- **Truy vết:** KH14, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW1/U_NEW2 định danh khác cùng IP/địa chỉ, không cờ rủi ro khác.

**Bước thực hiện:**

1. Mỗi khách đặt G800.
2. kiểm tra kết quả độc lập.

**Kết quả mong đợi:** Mỗi người nhận 80.000đ hợp lệ; không chặn chỉ vì chung IP.

**Đối chiếu nghiệp vụ/UI:** Không tự từ chối chỉ do chung mạng/địa chỉ; kết hợp tín hiệu và xét duyệt. Không công khai cáo buộc gian lận.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm GH — Giỏ và phép tính

#### TC-GH01 — Điều kiện “trên 1 triệu”, giỏ đúng 1 triệu

- **Truy vết:** GH01, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; chỉ BIG100 điều kiện >1.000.000đ.

**Bước thực hiện:**

1. Lần lượt báo giá 999.999đ, 1.000.000đ, 1.000.001đ.
2. ship 0.

**Kết quả mong đợi:** Hai giỏ đầu giảm 0; giỏ cuối giảm 100.000đ, tổng 900.001đ.

**Đối chiếu nghiệp vụ/UI:** Không đủ. Nếu toàn bộ hàng hợp lệ, thiếu ít nhất 1đ; nội dung tránh làm khách hiểu “từ”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH02 — Điều kiện “từ 1 triệu”, giỏ đúng 1 triệu

- **Truy vết:** GH02, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; BIG100 đổi thành >=1.000.000đ.

**Bước thực hiện:**

1. Lặp ba giá trị 999.999đ, 1.000.000đ, 1.000.001đ.

**Kết quả mong đợi:** Giảm lần lượt 0/100.000/100.000đ; đúng ngưỡng tổng 900.000đ.

**Đối chiếu nghiệp vụ/UI:** Đủ. Ghi đúng từ “từ”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH03 — Tiền hàng 980.000đ, ship 30.000đ

- **Truy vết:** GH03, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; BIG100 >=1 triệu; hàng 980.000đ, ship 30.000đ.

**Bước thực hiện:**

1. Báo giá.
2. thử chọn BIG100.

**Kết quả mong đợi:** Giảm 0; tổng 1.010.000đ; thiếu tiền hàng 20.000đ.

**Đối chiếu nghiệp vụ/UI:** Không đạt ngưỡng một triệu. Ship không góp vào tiền xét ngưỡng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH04 — Giỏ 1,2 triệu nhưng hàng đủ điều kiện chỉ 800.000đ

- **Truy vết:** GH04, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; BIG100 >=1 triệu chỉ nhóm E; E=800.000đ, ngoài E=400.000đ.

**Bước thực hiện:**

1. Báo giá.
2. mở lý do loại.

**Kết quả mong đợi:** Tiền xét ngưỡng 800.000đ, thiếu 200.000đ; không giảm.

**Đối chiếu nghiệp vụ/UI:** Xét ngưỡng trên 800.000đ. Chỉ rõ món không thuộc phạm vi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH05 — Hàng đã giảm riêng từ 1,1 triệu còn 990.000đ

- **Truy vết:** GH05, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; giá gốc 1.100.000đ, giá bán sau giảm sản phẩm 990.000đ.

**Bước thực hiện:**

1. Thêm hàng.
2. báo giá BIG100 >=1 triệu.

**Kết quả mong đợi:** Cơ sở 990.000đ; BIG100 giảm 0; không cộng giảm sản phẩm lần hai.

**Đối chiếu nghiệp vụ/UI:** Xét trên 990.000đ theo chính sách đã chọn. Không dùng giá niêm yết để tăng ngưỡng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH06 — Giảm 10% giỏ 2 triệu, trần 100.000đ

- **Truy vết:** GH06, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIRST10 giới hạn trần 100.000đ; U_NEW; hàng 2 triệu, ship 0.

**Bước thực hiện:**

1. Báo giá.
2. đặt.

**Kết quả mong đợi:** Giảm 100.000đ, tổng 1.900.000đ, giữ ngân sách 100.000đ.

**Đối chiếu nghiệp vụ/UI:** Giảm 100.000đ. “Đã áp dụng mức giảm tối đa”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH07 — Mã giảm 100.000đ nhưng hàng hợp lệ 80.000đ

- **Truy vết:** GH07, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100 không ngưỡng; hàng hợp lệ 80.000đ; ship 30.000đ.

**Bước thực hiện:**

1. Nhập mã.
2. báo giá.
3. đặt.

**Kết quả mong đợi:** Giảm 80.000đ, tổng 30.000đ; không hoàn 20.000đ dư.

**Đối chiếu nghiệp vụ/UI:** Giảm tối đa 80.000đ nếu không có ngưỡng khác. Không phát sinh số âm hoặc trả phần giảm dư bằng tiền.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH08 — Khách mới đủ cả 10% và giảm cố định

- **Truy vết:** GH08, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW; hàng 1,2 triệu; FIRST10 trần 200.000đ và BIG100 >1 triệu; ship 0.

**Bước thực hiện:**

1. Để tự động.
2. báo giá và mở danh sách.

**Kết quả mong đợi:** Chọn FIRST10 giảm 120.000đ; tổng 1.080.000đ; không giảm thành 220.000đ.

**Đối chiếu nghiệp vụ/UI:** Chọn mức tiết kiệm lớn hơn trong nhóm loại trừ. Giỏ 1,2 triệu, 10% chưa chạm trần thắng 100.000đ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH09 — Hai ưu đãi cho số tiền giảm bằng nhau

- **Truy vết:** GH09, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai chương trình đều giảm 100.000đ, priority khác, cùng điều kiện.

**Bước thực hiện:**

1. Báo giá 5 lần.
2. đổi thứ tự dữ liệu từ repository.
3. báo giá lại.

**Kết quả mong đợi:** Luôn cùng chương trình theo priority/ID đã chốt, giảm 100.000đ.

**Đối chiếu nghiệp vụ/UI:** Giữ thứ tự ưu tiên ổn định. Không đổi tên ưu đãi liên tục khi tải lại.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH10 — Khách chủ động chọn mã kém lợi hơn

- **Truy vết:** GH10, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Giỏ 1,2 triệu, tự động giảm 120.000đ; mã chọn tay FIX100.

**Bước thực hiện:**

1. Chọn FIX100.
2. xác nhận.
3. tải lại checkout.

**Kết quả mong đợi:** Giảm 100.000đ, tổng 1,1 triệu; gợi ý tốt hơn 20.000đ; không thay lựa chọn im lặng.

**Đối chiếu nghiệp vụ/UI:** Tôn trọng lựa chọn; gợi ý ưu đãi tốt hơn. Nút đổi, không tự ghi đè mã.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH11 — Xóa một món làm mất ngưỡng

- **Truy vết:** GH11, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; BIG100 >=1 triệu; giỏ 1,2 triệu, ship 0.

**Bước thực hiện:**

1. Xóa món 300.000đ.
2. đặt với báo giá trước khi xóa.

**Kết quả mong đợi:** Báo giá mới 900.000đ, giảm 0; không chấp nhận báo giá cũ 1,1 triệu.

**Đối chiếu nghiệp vụ/UI:** Tính lại; bỏ khoản giảm không còn hợp lệ. Nêu thay đổi trước đặt hàng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH12 — Thêm số lượng vượt bậc giảm tiếp theo

- **Truy vết:** GH12, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Bậc >=1 triệu giảm 100.000đ, >=2 triệu giảm 250.000đ.

**Bước thực hiện:**

1. Tăng giỏ từ 1,5 lên 2 triệu.
2. tự chọn.

**Kết quả mong đợi:** Mức giảm chuyển 100.000→250.000đ; tổng sau cùng 1.750.000đ khi ship 0.

**Đối chiếu nghiệp vụ/UI:** Tính lại, tự chọn bậc tốt nhất trong chế độ tự động. Thể hiện số tiền tiết kiệm mới.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH13 — Mã giảm hàng và chính sách miễn ship cùng hợp lệ

- **Truy vết:** GH13, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hàng 1 triệu, giảm 100.000đ, ship 30.000đ; free ship đủ điều kiện.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Chạy cấu hình cho kết hợp.
2. reset rồi chạy cấu hình không kết hợp.

**Kết quả mong đợi:** Cho kết hợp tổng 900.000đ; không kết hợp dùng quy tắc đã duyệt, không tự cộng cả hai; lưu từng khoản.

**Đối chiếu nghiệp vụ/UI:** Chỉ kết hợp nếu cấu hình cho phép; mỗi khoản một dòng. Không gọi giảm ship là giảm tiền hàng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH14 — Địa chỉ mới làm tăng ship

- **Truy vết:** GH14, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800 FIRST10; đổi địa chỉ làm ship 30.000→50.000đ.

**Bước thực hiện:**

1. Báo giá.
2. đổi địa chỉ.
3. chờ quote ship mới.

**Kết quả mong đợi:** Giảm giữ 80.000đ; tổng 750.000→770.000đ; không giữ quote ship cũ.

**Đối chiếu nghiệp vụ/UI:** Báo giá lại ship; giữ giảm hàng nếu điều kiện không đổi. Tổng mới và yêu cầu xác nhận nếu cần.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH15 — Sản phẩm bị ngừng bán/hết hàng trước đặt

- **Truy vết:** GH15, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800 đã báo giá; sản phẩm sau đó hết hàng/ngừng bán.

**Bước thực hiện:**

1. Đặt đơn với báo giá cũ.

**Kết quả mong đợi:** Không tạo đơn không hợp lệ hoặc giữ lượt mồ côi; hiển thị món cần sửa.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra lại hàng rồi tính ưu đãi. Không giữ ưu đãi cho đơn chưa tạo được.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH16 — Giỏ có hàng đặt trước và hàng có sẵn

- **Truy vết:** GH16, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Giỏ hai món 600.000/400.000đ, một món đặt trước; giảm 100.000đ.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Tạo đơn chờ xác nhận.
2. xác nhận giá cuối.
3. chia giao.

**Kết quả mong đợi:** Tổng hàng sau giảm 900.000đ; một lượt; các kiện không tự thêm giảm.

**Đối chiếu nghiệp vụ/UI:** Xác định giá cuối, giao tách và điều kiện trước chốt. Không nhân đôi ưu đãi khi chia kiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH17 — Tổng bằng 0 sau giảm

- **Truy vết:** GH17, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100, hàng 100.000đ, nhận tại cửa hàng, ship 0.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Áp dụng.
2. đặt.
3. kiểm tra quy trình đơn 0đ.

**Kết quả mong đợi:** Nếu luồng được duyệt: tổng 0, không QR/COD thu 0đ; nếu chưa hỗ trợ: chặn rõ, không giả lập thanh toán.

**Đối chiếu nghiệp vụ/UI:** Dùng luồng đơn 0đ đã kiểm chứng; không QR/thu COD 0đ. Không tự xác nhận thanh toán ngân hàng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH18 — Tiền giảm có phần lẻ qua nhiều món

- **Truy vết:** GH18, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Ba dòng giá 101/102/103đ, giảm 10%, ship 0.

**Bước thực hiện:**

1. Tính lại 5 lần.
2. đặt.
3. xem phân bổ và tổng.

**Kết quả mong đợi:** Round half-up: giảm 31đ; phần dư lớn nhất phân bổ 10/10/11đ; tổng trả 275đ.

**Đối chiếu nghiệp vụ/UI:** Làm tròn và phân bổ ổn định, tổng phân bổ đúng tổng giảm. Không lệch 1–2đ giữa web, đơn và hoàn hàng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH19 — Giỏ chứa quà tặng hoặc sản phẩm 0đ

- **Truy vết:** GH19, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hàng trả tiền 900.000đ và quà 0đ; BIG100 >=1 triệu.

**Bước thực hiện:**

1. Thêm/tăng số quà trong giới hạn hợp lệ.
2. báo giá.

**Kết quả mong đợi:** Ngưỡng vẫn 900.000đ, không BIG100; quà không phát sinh CTV.

**Đối chiếu nghiệp vụ/UI:** Không góp ngưỡng hoặc hoa hồng trừ chính sách rõ khác. Không dùng số lượng quà để mở thêm ưu đãi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-GH20 — Khách sỉ nhận link ưu đãi khách lẻ

- **Truy vết:** GH20, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_SI giá sỉ 700.000đ; FIRST10 chỉ khách lẻ.

**Bước thực hiện:**

1. Mở link ưu đãi.
2. gửi yêu cầu áp dụng qua API.

**Kết quả mong đợi:** Không giảm FIRST10; giá sỉ không bị đổi thành giá lẻ hoặc cộng thêm giảm.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra vai trò và giá phía server. Giải thích không thuộc đối tượng, giữ giá sỉ đúng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm MA — Mã ưu đãi

#### TC-MA01 — Nhập mã Aloha có dấu cách/chữ thường

- **Truy vết:** MA01, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100 hợp lệ, G1000, ship 0.

**Bước thực hiện:**

1. Nhập khoảng trắng + fix100 chữ thường.
2. áp dụng.

**Kết quả mong đợi:** Chuẩn thành FIX100; giảm 100.000đ; một ứng viên mã.

**Đối chiếu nghiệp vụ/UI:** Chuẩn hóa theo quy tắc mã Aloha rồi tra cứu. Mã chuẩn sau áp dụng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA02 — Mã không tồn tại hoặc không thuộc khách

- **Truy vết:** MA02, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mã NONE không tồn tại và mã PRIVATE thuộc khách khác.

**Bước thực hiện:**

1. Lần lượt nhập bằng U_NEW.
2. xem response và UI.

**Kết quả mong đợi:** Không giảm; lỗi không lộ chủ mã hay thông tin tài khoản.

**Đối chiếu nghiệp vụ/UI:** Trả lỗi chung phù hợp; không lộ chủ sở hữu. “Mã không hợp lệ hoặc không dành cho tài khoản này”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA03 — Mã chưa bắt đầu/hết hạn

- **Truy vết:** MA03, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mã hiệu lực [T0,T1), đồng hồ server điều khiển được.

**Bước thực hiện:**

1. Thử T0-1ms, T0, T1-1ms, T1.

**Kết quả mong đợi:** Không/được/được/không áp dụng; không dựa giờ thiết bị.

**Đối chiếu nghiệp vụ/UI:** Không áp dụng. Thời gian hiệu lực theo giờ Việt Nam.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA04 — Mã hợp lệ nhưng hết lượt/ngân sách

- **Truy vết:** MA04, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100; chạy riêng bộ hết tổng lượt và bộ hết ngân sách.

**Bước thực hiện:**

1. Nhập mã.
2. đặt đồng thời với một lượt xem.

**Kết quả mong đợi:** Không tạo giữ mới hoặc ngân sách âm; lý do đúng từng bộ.

**Đối chiếu nghiệp vụ/UI:** Không giữ thêm. Lý do rõ và ưu đãi thay thế nếu có.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA05 — Mã dùng một lần đã dùng ở đơn thành công

- **Truy vết:** MA05, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mã ONE1 một lần đã tiêu thụ trên đơn thành công của U_OLD.

**Bước thực hiện:**

1. Nhập lại.
2. gửi API đặt lại.

**Kết quả mong đợi:** Không tiêu thụ lần hai; lịch sử chỉ hiện đơn của người đang đăng nhập.

**Đối chiếu nghiệp vụ/UI:** Không áp dụng lại. Liên kết lịch sử đơn của chính khách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA06 — Mã đang giữ ở đơn khác

- **Truy vết:** MA06, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** ONE1 đang giữ ở K1 chưa trả.

**Bước thực hiện:**

1. Đặt K2 bằng ONE1.

**Kết quả mong đợi:** Không thêm giữ; khách xem/tiếp tục K1 hoặc hủy theo quy trình.

**Đối chiếu nghiệp vụ/UI:** Không cấp đồng thời. Cho xem đơn đang chờ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA07 — Khách lưu mã nhưng chưa đặt

- **Truy vết:** MA07, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** ONE1 còn lượt, chưa giữ.

**Bước thực hiện:**

1. Lưu vào ví.
2. tải lại.
3. xem counters.

**Kết quả mong đợi:** Ví có mã; held/used/budget không đổi.

**Đối chiếu nghiệp vụ/UI:** Chỉ lưu vào ví, không giữ lượt/ngân sách. “Áp dụng khi còn lượt và đủ điều kiện”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA08 — Mã bị tạm dừng sau khi khách lưu

- **Truy vết:** MA08, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Khách đã lưu ONE1, chưa đặt.

**Bước thực hiện:**

1. Admin dừng chương trình.
2. khách mở ví và thử dùng.

**Kết quả mong đợi:** Đánh dấu tạm dừng, không giảm/giữ mới; cache không cho vượt kiểm tra server.

**Đối chiếu nghiệp vụ/UI:** Ví cập nhật trạng thái. Không tiếp tục quảng cáo là dùng được.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA09 — Mã riêng bị chia sẻ cho người khác

- **Truy vết:** MA09, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** PRIVATE thuộc U_NEW; U_OTHER biết chuỗi.

**Bước thực hiện:**

1. U_OTHER nhập mã và sửa request ownerId thành U_NEW.

**Kết quả mong đợi:** Backend dùng danh tính phiên, từ chối; không đọc dữ liệu chủ mã.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra khách sở hữu phía server. Không chỉ dựa vào biết chuỗi mã.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA10 — Thử mã liên tục để dò mã

- **Truy vết:** MA10, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Môi trường test cấu hình hạn L lần/cửa sổ W.

**Bước thực hiện:**

1. Gửi L+1 lần thử sai theo cùng định danh.
2. đợi W.
3. thử mã hợp lệ.

**Kết quả mong đợi:** Chặn phần vượt với thời gian thử lại; sau cửa sổ dùng được; không lộ mã.

**Đối chiếu nghiệp vụ/UI:** Giới hạn tần suất, theo dõi bất thường. Cho thử lại sau; không khóa vô thời hạn do một lỗi gõ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA11 — Import mã có trùng và dòng lỗi

- **Truy vết:** MA11, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** File có NEW1 hợp lệ, DUP đã có, hai dòng SAME, một mã sai định dạng.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Upload.
2. xem preview.
3. chạy theo chế độ import đã duyệt.

**Kết quả mong đợi:** Mỗi dòng có kết quả; không mã trùng; tổng thành công/thất bại khớp; chính sách toàn bộ/từng phần phải chốt trước chấm.

**Đối chiếu nghiệp vụ/UI:** Xem trước kết quả, xác định rõ nhập toàn bộ hay phần hợp lệ. Số tạo/thất bại và lý do theo dòng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA12 — Một mã kích hoạt chương trình đã sửa

- **Truy vết:** MA12, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mã FIX trỏ v1 giảm 50.000đ; một đơn đã chốt; v2 giảm 100.000đ.

**Bước thực hiện:**

1. Sửa/kích hoạt v2.
2. báo giá và đặt đơn mới.
3. mở đơn cũ.

**Kết quả mong đợi:** Đơn mới giảm 100.000đ; đơn cũ 50.000đ, giữ version chính xác.

**Đối chiếu nghiệp vụ/UI:** Mã trỏ chương trình; đơn mới dùng phiên bản hiện hành. Điều kiện ví đồng bộ với phiên bản mới.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA13 — Mã chung còn lượt nhưng khách hết hạn mức cá nhân

- **Truy vết:** MA13, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100 còn 10 lượt toàn cục; U_OLD hết 1 lượt/khách; U_NEW chưa dùng.

**Bước thực hiện:**

1. Hai khách lần lượt báo giá mã.

**Kết quả mong đợi:** U_OLD bị loại theo hạn cá nhân; U_NEW dùng được; không báo hết toàn chương trình.

**Đối chiếu nghiệp vụ/UI:** Từ chối riêng khách đó. Không hiển thị sai là toàn chương trình hết lượt.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-MA14 — Mã web trùng chuỗi mã KiotViet

- **Truy vết:** MA14, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Chuỗi SAME tồn tại ở Aloha và voucher KV.

**Bước thực hiện:**

1. Nhập SAME.
2. chọn nguồn rõ ràng.
3. xác nhận một nguồn.

**Kết quả mong đợi:** Chỉ thao tác nguồn đã chọn; không giảm và thanh toán hai lần vì trùng tên.

**Đối chiếu nghiệp vụ/UI:** Phân biệt nguồn ở bước tra cứu/chọn. Không tự tiêu thụ cả hai hoặc đoán nguồn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm CT — Giới thiệu và hoa hồng CTV

#### TC-CT01 — Khách mới mua qua link A, hưởng giảm lần đầu

- **Truy vết:** CT01, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW; G1000; FIRST10; link A cho cả hàng thử, rate 5%; ship 0.

**Bước thực hiện:**

1. Vào link.
2. đặt.
3. đọc chi tiết hoa hồng.

**Kết quả mong đợi:** Giảm 100.000đ; tổng 900.000đ; A tạm tính 45.000đ.

**Đối chiếu nghiệp vụ/UI:** A nhận theo tiền hàng sau giảm nếu link hợp lệ. Hàng 1 triệu, giảm 100.000đ, tỷ lệ 5% → 45.000đ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT02 — Lần hai tiếp tục vào link A

- **Truy vết:** CT02, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; G1000; không chương trình giảm; A 5%.

**Bước thực hiện:**

1. Vào lại link A hợp lệ.
2. đặt.

**Kết quả mong đợi:** Không FIRST10; A tạm tính 50.000đ.

**Đối chiếu nghiệp vụ/UI:** Có lượt mới hợp lệ; A được ghi nhận; không giảm lần đầu. Hàng 1 triệu, không giảm, 5% → 50.000đ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT03 — Lần hai vào trực tiếp, lượt A còn hạn

- **Truy vết:** CT03, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; G1000; link A còn hạn; FIX100 đã chọn.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Quay lại trực tiếp.
2. đặt.

**Kết quả mong đợi:** A tạm tính 45.000đ; giảm 100.000đ; không cần bấm link lại trong hạn giả định.

**Đối chiếu nghiệp vụ/UI:** Giữ A trong phạm vi đã được giới thiệu. Nếu giảm đơn lớn 100.000đ, hoa hồng còn 45.000đ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT04 — Lần hai vào trực tiếp, lượt A hết hạn

- **Truy vết:** CT04, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD; G1000; link A hết hạn; không link khác.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Vào trực tiếp.
2. đặt.

**Kết quả mong đợi:** Không hoa hồng A; tổng theo ưu đãi độc lập.

**Đối chiếu nghiệp vụ/UI:** Không tự phát sinh hoa hồng A. Lịch sử khách cũ không tự tạo quyền hưởng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT05 — Khách bấm A rồi B trước đặt

- **Truy vết:** CT05, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G1000; A 5%, B 8%; cùng phạm vi, A t0 rồi B t1>t0.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Bấm A rồi B.
2. đặt không giảm.

**Kết quả mong đợi:** B 80.000đ, A 0; lưu bằng chứng thời điểm server.

**Đối chiếu nghiệp vụ/UI:** B thắng trên các dòng B có phạm vi hợp lệ. Lưu bằng chứng chọn B, không chỉ ghi tên người thắng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT06 — Khách bấm link B sau khi đơn đã chốt

- **Truy vết:** CT06, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn G1000 chốt A 5%.

**Bước thực hiện:**

1. Bấm link B sau đặt.
2. mở đơn cũ.

**Kết quả mong đợi:** Đơn vẫn A 50.000đ; không thay snapshot.

**Đối chiếu nghiệp vụ/UI:** Không đổi CTV của đơn cũ. Có thể tác động đơn mới đủ điều kiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT07 — A giới thiệu món X, B giới thiệu món Y trong cùng giỏ

- **Truy vết:** CT07, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY, A cho X 5%, B cho Y 8%, giảm 100.000đ.

**Bước thực hiện:**

1. Bấm hai link.
2. đặt.
3. đăng nhập xem báo cáo từng CTV.

**Kết quả mong đợi:** A 27.000đ; B 28.800đ; không lộ phần riêng CTV kia.

**Đối chiếu nghiệp vụ/UI:** Ghi nhận từng dòng X/A, Y/B nếu cả hai lượt hợp lệ. Mỗi CTV chỉ thấy phần quyền lợi của mình.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT08 — Chỉ có link A cho X, khách mua thêm Y

- **Truy vết:** CT08, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY, link A chỉ X, không B, không giảm.

**Bước thực hiện:**

1. Vào link X rồi thêm Y.
2. đặt.

**Kết quả mong đợi:** A nhận 600.000×5%=30.000đ; Y không nhận CTV.

**Đối chiếu nghiệp vụ/UI:** Y không tự thuộc A nếu link chỉ bao phủ X. Phạm vi link phải rõ trên công cụ chia sẻ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT09 — Khách vào link toàn shop B sau link món X của A

- **Truy vết:** CT09, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY; A link X trước, B toàn shop sau.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Bấm theo thứ tự.
2. đặt không giảm.

**Kết quả mong đợi:** Theo chính sách đề xuất B 8% nhận 80.000đ cả giỏ; blocked nếu loại link/chính sách chưa duyệt.

**Đối chiếu nghiệp vụ/UI:** Theo đề xuất lượt hợp lệ gần nhất, B có thể thắng cả X. Cần duyệt chính sách link toàn shop trước bật.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT10 — CTV bị khóa trước khách đặt

- **Truy vết:** CT10, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** A đang có hoa hồng cũ đủ điều kiện và lượt giới thiệu mới; sau đó bị khóa.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Khóa A.
2. khách mới vào link và đặt.
3. xem hoa hồng cũ.

**Kết quả mong đợi:** Không cấp quyền mới; hoa hồng cũ không bị xóa tự động; xử lý giữ/chi theo chính sách khóa đã duyệt.

**Đối chiếu nghiệp vụ/UI:** Không tạo quyền mới; xử lý quyền cũ theo chính sách khóa. Không tự xóa hoa hồng đã đủ điều kiện nếu chưa có kết luận vi phạm.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT11 — Khách nhập mã giảm giá của chiến dịch B sau link A

- **Truy vết:** CT11, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G1000, link A 5%, mã chiến dịch tên B giảm 100.000đ không chức năng referral.

**Bước thực hiện:**

1. Nhập mã B.
2. đặt.

**Kết quả mong đợi:** A vẫn nhận 45.000đ; không gán CTV theo tên mã.

**Đối chiếu nghiệp vụ/UI:** Mã giảm giá không tự thay người giới thiệu. Nếu mã có ghi nhận CTV phải có loại riêng và thứ tự ưu tiên đã chốt.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT12 — CTV tự mua hoặc tạo tài khoản có liên hệ để hưởng hoa hồng

- **Truy vết:** CT12, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** CTV A mua bằng tài khoản mình hoặc tài khoản liên kết theo quy tắc rủi ro thử.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đặt qua link A.
2. xem duyệt hoa hồng.

**Kết quả mong đợi:** Không tự chi trước kết luận; điều kiện ưu đãi khách được xét riêng; policy self-buy chưa duyệt thì blocked.

**Đối chiếu nghiệp vụ/UI:** Đánh dấu xét duyệt theo chính sách tự mua; không tự trả. Ưu đãi khách và hoa hồng là hai quyết định riêng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT13 — Khách đổi máy/xóa cookie trước đặt

- **Truy vết:** CT13, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai thiết bị; bộ 1 referral đã liên kết server, bộ 2 chỉ có phiên ẩn danh.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Bấm link máy 1.
2. mua máy 2 với cùng tài khoản ở bộ 1.
3. lặp bộ 2.

**Kết quả mong đợi:** Bộ 1 giữ nếu hợp lệ; bộ 2 không tự tạo bằng chứng; không hứa chắc ghi nhận khi thiếu dữ liệu.

**Đối chiếu nghiệp vụ/UI:** Chỉ giữ ghi nhận nếu đã liên kết hợp lệ phía server. Không hứa theo dõi mọi thiết bị khi chưa nhận diện được khách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT14 — Nhiều khách dùng chung trình duyệt

- **Truy vết:** CT14, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Thiết bị chung; khách U1 đã gắn referral, khách U2 độc lập.

**Bước thực hiện:**

1. U1 logout.
2. U2 login không bấm link.
3. đặt.

**Kết quả mong đợi:** Không chuyển referral cá nhân/cache riêng của U1 sang U2.

**Đối chiếu nghiệp vụ/UI:** Không để ghi nhận cá nhân của khách trước tự sang khách sau. Tách phiên và định danh.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT15 — Client sửa ctvCode hoặc thời điểm link

- **Truy vết:** CT15, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G1000; không bằng chứng link A hợp lệ.

**Bước thực hiện:**

1. Sửa ctvCode, timestamp và scope trong request.
2. đặt.

**Kết quả mong đợi:** Không cấp hoa hồng giả; dữ liệu giả bị từ chối/bỏ theo hợp đồng, có dấu vết xử lý.

**Đối chiếu nghiệp vụ/UI:** Backend từ chối bằng chứng không hợp lệ. Log sự kiện an toàn, không tin dữ liệu tự khai.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT16 — Admin đổi tỷ lệ từ 5% lên 7% sau chốt

- **Truy vết:** CT16, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G1000 chốt A 5%; sau đó config A 7%.

**Bước thực hiện:**

1. Sửa tỷ lệ.
2. hoàn tất đơn cũ.
3. tạo đơn mới hợp lệ không giảm.

**Kết quả mong đợi:** Cũ 50.000đ; mới 70.000đ; không tính lại cũ thành 70.000đ.

**Đối chiếu nghiệp vụ/UI:** Đơn cũ dùng tỷ lệ 5% đã lưu; đơn mới theo chính sách mới. Hiển thị tỷ lệ và nguồn tại đơn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT17 — Lượt giới thiệu hết hạn sau khi đã chốt đơn

- **Truy vết:** CT17, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn chốt A trong hạn; giao khi referral đã hết hạn.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đẩy đồng hồ qua hạn link.
2. giao thành công.

**Kết quả mong đợi:** Giữ hoa hồng snapshot; hết hạn link không hủy đơn đã ghi nhận.

**Đối chiếu nghiệp vụ/UI:** Giữ CTV của đơn; không mất hoa hồng chỉ vì giao hàng muộn. Thời điểm chốt làm căn cứ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT18 — Hai tab có link CTV khác nhau, khách đặt từ một tab

- **Truy vết:** CT18, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai tab có A/B cùng phạm vi; cố ý trì hoãn response A.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Ghi nhận A rồi B ở server.
2. cho response A về muộn.
3. đặt.

**Kết quả mong đợi:** Chọn B theo thứ tự server đã ghi, không theo response cuối trình duyệt.

**Đối chiếu nghiệp vụ/UI:** Chọn theo bằng chứng hợp lệ server và chính sách thời điểm, không theo phản hồi mạng về cuối. Lưu thứ tự sự kiện; kiểm thử tránh race.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT19 — Đơn dùng mã giảm sâu khiến lợi nhuận thấp

- **Truy vết:** CT19, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G1000 giảm 500.000đ hợp lệ; A 5%; biên lợi nhuận thấp.

**Bước thực hiện:**

1. Preview.
2. chốt.
3. admin xem lợi nhuận thấp sau đó.

**Kết quả mong đợi:** Hoa hồng 25.000đ theo snapshot; không tự cắt còn 0.

**Đối chiếu nghiệp vụ/UI:** Áp dụng tỷ lệ và cơ sở đã cấu hình trước; không tự cắt sau chốt. Admin preview tổng chi phí ưu đãi cộng hoa hồng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-CT20 — Thanh toán đủ nhưng chưa giao

- **Truy vết:** CT20, mục 15. **Ưu tiên:** P0. **Lớp:** Logic + API + tích hợp báo cáo. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** CT01 đã trả đủ, chưa giao.

**Bước thực hiện:**

1. Mở portal.
2. thử yêu cầu chi nếu có API.

**Kết quả mong đợi:** 45.000đ ở trạng thái chờ; chưa vào số có thể thanh toán.

**Đối chiếu nghiệp vụ/UI:** Hoa hồng chờ hoàn tất, chưa chi. Tạm tính / Chờ đối soát / Được thanh toán / Đã chi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm TT — Đặt đơn và thanh toán

#### TC-TT01 — Nhấn đặt hàng hai lần/retry do mạng

- **Truy vết:** TT01, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G800, khóa K1.

**Bước thực hiện:**

1. Gửi hai request đồng thời cùng K1 và retry sau mất response.

**Kết quả mong đợi:** Cùng một đơn; một giữ 80.000đ; một công việc KV; không hai hoa hồng.

**Đối chiếu nghiệp vụ/UI:** Cùng idempotency trả lại cùng đơn và lượt giữ. Không hai QR, hai lượt, hai hoa hồng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT02 — Hai tab đặt hai đơn dùng quyền lần đầu

- **Truy vết:** TT02, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G800, hai khóa K1/K2.

**Bước thực hiện:**

1. Dùng barrier gửi đồng thời.
2. đợi hoàn tất.

**Kết quả mong đợi:** Chỉ một quyền FIRST10; yêu cầu thua không tự tạo đơn giá cao hơn khi chưa xác nhận.

**Đối chiếu nghiệp vụ/UI:** Chỉ một đơn giữ thành công bằng ràng buộc DB. Đơn còn lại nhận lý do và báo giá mới.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT03 — Hai khách tranh lượt cuối

- **Truy vết:** TT03, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai khách mới, chương trình còn một lượt.

**Bước thực hiện:**

1. Gửi đồng thời request đặt hai khách.

**Kết quả mong đợi:** Chỉ một giữ; tổng held+used không vượt một; khách thua có lý do.

**Đối chiếu nghiệp vụ/UI:** Chỉ một khách giữ thành công. Khách còn lại xác nhận lại tổng, không tự thu cao hơn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT04 — Còn ngân sách 50.000đ, ưu đãi dự kiến 80.000đ

- **Truy vết:** TT04, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800 FIRST10, ngân sách còn 50.000đ.

**Bước thực hiện:**

1. Báo giá rồi đặt.

**Kết quả mong đợi:** Không giữ 80.000đ, không tự cắt giảm thành 50.000đ; báo giá khác cần xác nhận.

**Đối chiếu nghiệp vụ/UI:** Không áp dụng chương trình đó; không tự giảm xuống 50.000đ. Có thể chọn ưu đãi khác nếu hợp lệ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT05 — Giữ lượt thành công nhưng lưu đơn lỗi

- **Truy vết:** TT05, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800 FIRST10; điểm chèn lỗi sau giữ trước lưu đơn.

**Bước thực hiện:**

1. Gây lỗi.
2. retry cùng khóa.
3. chạy đối soát.

**Kết quả mong đợi:** Hoặc một đơn hợp lệ với một giữ, hoặc không đơn và không giữ ròng; không kẹt ngân sách.

**Đối chiếu nghiệp vụ/UI:** Rollback hoặc bù có kiểm soát; không treo quyền. Theo dõi lỗi, retry không tạo giữ mới.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT06 — Chuyển khoản đúng và trong hạn

- **Truy vết:** TT06, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 tổng 750.000đ, giữ 80.000đ.

**Bước thực hiện:**

1. Gửi sự kiện thu 750.000đ hợp lệ trước hạn.

**Kết quả mong đợi:** Đã trả 750.000đ, còn thu 0; held chuyển used 80.000đ; CTV chưa được chi nếu chưa giao.

**Đối chiếu nghiệp vụ/UI:** Chuyển giữ thành đã dùng, vẫn chờ giao để chi CTV. Tổng đã trả khớp số cần trả.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT07 — Chuyển khoản thiếu

- **Truy vết:** TT07, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 tổng 750.000đ.

**Bước thực hiện:**

1. Gửi thu 700.000đ.
2. sau đó thêm 50.000đ giao dịch khác.

**Kết quả mong đợi:** Sau lần 1 còn 50.000đ chưa đủ; sau lần 2 đủ 750.000đ, tiêu thụ một lượt.

**Đối chiếu nghiệp vụ/UI:** Giữ trạng thái chưa đủ, tính số còn thiếu. Không tính là đã hoàn tất chỉ vì có giao dịch.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT08 — Chuyển khoản thừa

- **Truy vết:** TT08, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 tổng 750.000đ; A hưởng trên hàng sau giảm 720.000đ.

**Bước thực hiện:**

1. Gửi thu 800.000đ.

**Kết quả mong đợi:** Dư 50.000đ có đối soát; CTV vẫn 36.000đ với 5%, không dựa 800.000đ.

**Đối chiếu nghiệp vụ/UI:** Ghi dư và quy trình hoàn/đối soát riêng. Không tăng hoa hồng theo tiền khách chuyển thừa.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT09 — Hết hạn chưa nhận tiền

- **Truy vết:** TT09, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 chưa trả, hết hạn T1.

**Bước thực hiện:**

1. Chạy hết hạn hai lần.
2. tạo báo giá mới.

**Kết quả mong đợi:** Giải phóng 80.000đ một lần; K1 hết hạn; đơn mới theo phiên bản hiện hành.

**Đối chiếu nghiệp vụ/UI:** Hủy/hết hạn theo quy trình, giải phóng một lần. Khách đặt lại được kiểm tra theo ưu đãi hiện hành.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT10 — Tiền tới sau hết hạn và quyền đã giải phóng

- **Truy vết:** TT10, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 đã hết hạn, quyền được đơn K2 giữ.

**Bước thực hiện:**

1. Gửi thu muộn cho K1.

**Kết quả mong đợi:** Đưa đối soát; không tiêu thụ quyền đang thuộc K2 hoặc tự chi CTV.

**Đối chiếu nghiệp vụ/UI:** Đối soát thủ công hoặc luồng khôi phục có kiểm tra. Không âm thầm tạo đơn giá cũ hoặc chi hoa hồng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT11 — Webhook thanh toán bị gửi lặp

- **Truy vết:** TT11, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1, giao dịch PAY1=750.000đ.

**Bước thực hiện:**

1. Gửi cùng PAY1 10 lần gồm song song.

**Kết quả mong đợi:** Tổng đã trả 750.000đ; đúng một chuyển lượt; không 7,5 triệu.

**Đối chiếu nghiệp vụ/UI:** Xử lý idempotent theo giao dịch. Không tăng tiền đã trả/tiêu thụ mã hai lần.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT12 — Webhook hủy và thanh toán đến sai thứ tự

- **Truy vết:** TT12, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1; sự kiện hủy và thu tiền thực tế cùng thời điểm.

**Bước thực hiện:**

1. Chạy hai thứ tự và đồng thời trong ba lần reset.

**Kết quả mong đợi:** Không mất ghi nhận tiền; trạng thái cần đối soát khi xung đột; không giải phóng rồi cấp trùng quyền.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra trạng thái và giao dịch thực tế; đưa tranh chấp vào đối soát. Không ghi “chưa trả” khi tiền đã nhận.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT13 — COD giao thành công

- **Truy vết:** TT13, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 COD tổng 750.000đ, giữ FIRST10.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Gửi giao thành công.
2. gửi lại.
3. đối soát thu hộ theo quy trình.

**Kết quả mong đợi:** Tiêu thụ một lần; đủ điều kiện chi chỉ sau thời hạn đối soát đã duyệt.

**Đối chiếu nghiệp vụ/UI:** Tiêu thụ lượt, ghi nhận thu tiền theo quy trình vận chuyển. Hoa hồng chờ hết thời gian đối soát.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT14 — COD từ chối nhận/giao thất bại kết thúc

- **Truy vết:** TT14, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 COD đang giao rồi hoàn về kết thúc chưa thành công.

**Bước thực hiện:**

1. Gửi thất bại kết thúc.
2. chạy lại sự kiện.

**Kết quả mong đợi:** Giải phóng một lần; hoa hồng về hủy; chi phí giao không tăng hoa hồng.

**Đối chiếu nghiệp vụ/UI:** Hủy hoa hồng, giải phóng ưu đãi chưa thành công. Phí giao thất bại là khoản riêng theo chính sách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT15 — Khách đổi COD sang chuyển khoản

- **Truy vết:** TT15, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 COD chưa thu, tổng 750.000đ.

**Bước thực hiện:**

1. Đổi Transfer.
2. mở QR.
3. thử retry đổi phương thức.

**Kết quả mong đợi:** Cùng đơn/lượt; QR 750.000đ; không tạo đơn COD thứ hai.

**Đối chiếu nghiệp vụ/UI:** Cập nhật cùng đơn, giữ cùng lượt; tạo QR đúng tiền còn phải thu. Không nhân đôi ưu đãi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT16 — Có thanh toán một phần rồi yêu cầu hủy

- **Truy vết:** TT16, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 tổng 750.000đ, đã thu 200.000đ.

**Bước thực hiện:**

1. Yêu cầu hủy.
2. xác nhận hoàn hợp lệ.
3. retry.

**Kết quả mong đợi:** Có khoản hoàn 200.000đ đúng một lần; không đóng như chưa từng nhận tiền.

**Đối chiếu nghiệp vụ/UI:** Hoàn/đối soát tiền trước khi đóng trạng thái. Chỉ giải phóng quyền khi trạng thái giao dịch được xác định.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT17 — Đơn đã giữ trước giờ chương trình hết hạn

- **Truy vết:** TT17, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 tạo T1-1 phút, hạn thanh toán T1+9 phút.

**Bước thực hiện:**

1. Đợi qua T1.
2. trả đủ trong hạn.
3. khách khác tạo đơn mới.

**Kết quả mong đợi:** K1 giữ giá cũ; đơn mới không nhận chương trình hết hạn.

**Đối chiếu nghiệp vụ/UI:** Giữ giá trong hạn thanh toán đã hứa. Tạo đơn mới sau hết hạn không được hưởng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-TT18 — Hệ thống khởi động lại sau giữ lượt

- **Truy vết:** TT18, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đã commit đơn/lượt nhưng tiến trình dừng trước response.

**Bước thực hiện:**

1. Khởi động lại.
2. retry K1.
3. chạy job đối soát.

**Kết quả mong đợi:** Khôi phục một đơn/một giữ; không phụ thuộc dữ liệu RAM.

**Đối chiếu nghiệp vụ/UI:** Khôi phục từ DB, tác vụ đối soát sửa giữ mồ côi. Không dựa vào bộ nhớ tiến trình.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm DH — Sửa, hủy, đổi và hoàn

#### TC-DH01 — Shop bỏ món trước thanh toán làm rớt ngưỡng

- **Truy vết:** DH01, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD giỏ 1,2 triệu BIG100>=1 triệu chưa trả.

**Bước thực hiện:**

1. Shop bỏ món 300.000đ.
2. gửi báo giá cuối.

**Kết quả mong đợi:** Giảm về 0, tổng hàng 900.000đ; giải phóng giữ BIG100; khách xác nhận.

**Đối chiếu nghiệp vụ/UI:** Báo giá lại, điều chỉnh lượt giữ/ngân sách nguyên tử. Tính lại hoa hồng tạm tính; khách xác nhận.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH02 — Shop thêm món sau khách đã trả

- **Truy vết:** DH02, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn đã trả đủ 900.000đ sau giảm.

**Bước thực hiện:**

1. Shop đề nghị thêm món 200.000đ không ưu đãi.
2. khách xác nhận.

**Kết quả mong đợi:** Tạo điều chỉnh cần thu 200.000đ; chứng từ cũ không bị ghi đè; không tự gán CTV món mới.

**Đối chiếu nghiệp vụ/UI:** Lập thay đổi có chênh lệch cần thu; không ghi đè đơn đã trả. Không tự mở rộng phạm vi CTV cho món thêm.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH03 — Đổi sang món cùng giá trước thanh toán

- **Truy vết:** DH03, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** X và Z cùng giá 600.000đ; X đủ ưu đãi/referral, Z không.

**Bước thực hiện:**

1. Đổi X→Z trước thanh toán.
2. báo giá lại.

**Kết quả mong đợi:** Không giữ giảm/referral của X trên Z chỉ vì bằng giá.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra phạm vi ưu đãi và CTV của món mới. Giá bằng nhau không có nghĩa điều kiện giống nhau.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH04 — Shop tự hết hàng sau chốt

- **Truy vết:** DH04, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn chốt; shop phát hiện thiếu hàng.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đánh dấu thiếu.
2. gửi phương án xử lý theo chính sách được duyệt.

**Kết quả mong đợi:** Không tự thu thêm; lưu xác nhận khách và lý do; blocked phần tiền cụ thể nếu chính sách chưa chốt.

**Đối chiếu nghiệp vụ/UI:** Đề xuất giữ quyền lợi đã cam kết trên phần giao được khi phù hợp, hoặc báo giá lại được khách đồng ý. Chính sách thiếu hàng do shop cần chốt; không tự truy thu.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH05 — Một đơn giao nhiều kiện

- **Truy vết:** DH05, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY giảm 100.000đ, giao hai kiện.

**Bước thực hiện:**

1. Gửi cập nhật từng kiện và lặp sự kiện.

**Kết quả mong đợi:** Tổng giảm 100.000đ, một lượt; tổng hoa hồng 55.800đ, không nhân hai.

**Đối chiếu nghiệp vụ/UI:** Một ưu đãi và một lượt sử dụng theo đơn gốc. Không tạo hoa hồng lặp theo kiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH06 — Tách một đơn thành nhiều đơn con

- **Truy vết:** DH06, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY đã chốt giảm 100.000đ.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Tách X/Y thành hai đơn con qua chức năng được hỗ trợ.

**Kết quả mong đợi:** Giảm con 60.000/40.000đ, tổng 100.000đ; hoa hồng 27.000/28.800đ; không FIRST10 mới.

**Đối chiếu nghiệp vụ/UI:** Phân bổ snapshot gốc, liên kết gốc/con, bảo toàn tổng. Đơn con không được tự nhận thêm ưu đãi lần đầu.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH07 — Gộp hai đơn đã chốt

- **Truy vết:** DH07, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai đơn đã chốt độc lập.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Yêu cầu gộp.
2. kiểm tra giao diện/API.

**Kết quả mong đợi:** Không tự gộp nếu chưa hỗ trợ; nếu hỗ trợ phải bảo toàn chứng từ/lượt và có phương án duyệt.

**Đối chiếu nghiệp vụ/UI:** Không tự gộp ưu đãi; xử lý điều chỉnh có kiểm soát. Tránh dùng hai lượt lần đầu cho một khách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH08 — Hủy toàn bộ trước thành công

- **Truy vết:** DH08, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 G800 chưa trả và đang giữ.

**Bước thực hiện:**

1. Khách hủy.
2. retry hủy.
3. xem ledger.

**Kết quả mong đợi:** Giữ 80.000đ giải phóng một lần, hoa hồng tạm hủy; không phiếu hoàn khi chưa thu.

**Đối chiếu nghiệp vụ/UI:** Giải phóng lượt/ngân sách đủ điều kiện; hoàn tiền nếu có. Hủy hoa hồng tạm tính.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH09 — Hoàn toàn bộ sau giao thành công

- **Truy vết:** DH09, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn G1000 giảm 100.000đ, ship 0, đã trả/giao, CTV 45.000đ.

**Bước thực hiện:**

1. Hoàn toàn bộ.
2. chạy sự kiện lặp.

**Kết quả mong đợi:** Hoàn 900.000đ một lần; CTV đảo 45.000đ; lần đầu không cấp lại.

**Đối chiếu nghiệp vụ/UI:** Hoàn phần thực trả theo chính sách; không cấp lại lần đầu. Void/điều chỉnh hoa hồng; ship xử lý riêng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH10 — Hoàn X trong ví dụ mục 15.6

- **Truy vết:** DH10, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY đã trả/giao, giảm 100.000đ.

**Bước thực hiện:**

1. Hoàn riêng X.
2. mở báo cáo A/B.

**Kết quả mong đợi:** Hoàn 540.000đ; A giảm 27.000đ; B còn 28.800đ.

**Đối chiếu nghiệp vụ/UI:** Hoàn tiền hàng X tối đa 540.000đ, không phải 600.000đ. Giảm hoa hồng A 27.000đ; B giữ 28.800đ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH11 — Hoàn một trong nhiều đơn vị cùng dòng

- **Truy vết:** DH11, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Một dòng 3 đơn vị giá 101đ, tổng 303đ; giảm 10%=30đ.

**Bước thực hiện:**

1. Hoàn từng đơn vị qua ba yêu cầu.
2. thử yêu cầu thứ tư.

**Kết quả mong đợi:** Theo phân bổ đều mỗi đơn vị net 91đ: tổng hoàn 273đ; lần 4 bị từ chối.

**Đối chiếu nghiệp vụ/UI:** Phân bổ phần giảm theo đơn vị với quy tắc phần dư ổn định. Không để tổng nhiều lần hoàn vượt dòng gốc.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH12 — Hoàn làm tiền hàng còn lại thấp hơn ngưỡng

- **Truy vết:** DH12, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY sau giảm 900.000đ; ngưỡng gốc 1 triệu.

**Bước thực hiện:**

1. Hoàn X.
2. kiểm tra giá Y giữ lại.

**Kết quả mong đợi:** Hoàn 540.000đ; Y giữ net 360.000đ; không truy thu 40.000đ ưu đãi của Y.

**Đối chiếu nghiệp vụ/UI:** Mặc định không tính lại giá món giữ; hoàn theo snapshot đã phân bổ. Nếu muốn thu hồi ưu đãi theo ngưỡng phải thiết kế chính sách riêng trước chạy.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH13 — Hoa hồng đã chi rồi mới hoàn

- **Truy vết:** DH13, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** CT01 hoa hồng 45.000đ đã chi.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Hoàn toàn đơn.
2. tạo kỳ kế tiếp.
3. mở chứng từ gốc.

**Kết quả mong đợi:** Điều chỉnh -45.000đ liên kết khoản chi; không xóa khoản đã chi.

**Đối chiếu nghiệp vụ/UI:** Ghi điều chỉnh kỳ sau với liên kết đơn hoàn. Không xóa phiếu chi; nêu rõ khoản bị trừ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH14 — Một yêu cầu hoàn được gửi lại nhiều lần

- **Truy vết:** DH14, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** DH10 với mã hoàn R1.

**Bước thực hiện:**

1. Gửi R1 5 lần song song.
2. tra tiền và CTV.

**Kết quả mong đợi:** Chỉ hoàn 540.000đ và đảo 27.000đ một lần.

**Đối chiếu nghiệp vụ/UI:** Duy nhất theo mã yêu cầu; kiểm tra số lượng còn hoàn được. Không hoàn tiền/thu hồi hoa hồng lặp.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH15 — Đổi hàng sau giao

- **Truy vết:** DH15, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn đã giao, khách đổi món giá trị khác.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Tạo yêu cầu đổi.
2. xác nhận chênh lệch theo chính sách.

**Kết quả mong đợi:** Có chứng từ trước/sau và phân bổ rõ; không dùng chương trình mới tự sửa giá cũ; blocked nếu quy tắc chưa chốt.

**Đối chiếu nghiệp vụ/UI:** Ghi giao dịch đổi/hoàn và chênh lệch; không dùng ưu đãi mới để sửa giá cũ tùy tiện. Tính hoa hồng điều chỉnh theo hàng giữ/thay và chính sách đã chốt.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-DH16 — Tranh chấp tự mua/đơn giả sau giao

- **Truy vết:** DH16, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn nghi tự mua, đã giao chưa chi.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Mở tranh chấp.
2. thử chi.
3. admin kết luận có lý do.

**Kết quả mong đợi:** Khoản liên quan bị giữ theo policy; không ảnh hưởng CTV khác; lịch sử người xử lý đầy đủ.

**Đối chiếu nghiệp vụ/UI:** Tạm giữ phần hoa hồng cần xét duyệt; tiền khách theo quy trình riêng. Nhật ký kết luận, người xử lý và lý do.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm KV — Hợp đồng KiotViet

#### TC-KV01 — Đợt và mã đọc được nhưng thiếu điều kiện

- **Truy vết:** KV01, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mock/fixture đợt thiếu điều kiện hoặc schema mới.

**Bước thực hiện:**

1. Đồng bộ.
2. xem admin.
3. thử dùng checkout.

**Kết quả mong đợi:** Chưa xác nhận khả dụng; không coi thiếu trường là miễn điều kiện.

**Đối chiếu nghiệp vụ/UI:** Không mặc định là dùng tự do; xác minh trước áp dụng. Hiển thị chưa đủ thông tin.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV02 — Cache còn mã, POS vừa dùng xong

- **Truy vết:** KV02, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Cache voucher usable; nguồn KV đã used.

**Bước thực hiện:**

1. Khách áp dụng rồi xác nhận.

**Kết quả mong đợi:** Nguồn từ chối; không ghi thanh toán thành công; giải thích và báo lại số còn thu.

**Đối chiếu nghiệp vụ/UI:** Kiểm tra/tiêu thụ ở nguồn; chấp nhận nguồn từ chối. Không ghi nhận thành công chỉ vì cache báo còn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV03 — Website và POS dùng cùng mã đồng thời

- **Truy vết:** KV03, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Một voucher khả dụng ở gian hàng thử, hai kênh POS/web.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đồng thời xác nhận cùng mã trên hai kênh.

**Kết quả mong đợi:** Tối đa một tiêu thụ ở nguồn; nếu không chứng minh được thì chặn phát hành tích hợp chung kênh.

**Đối chiếu nghiệp vụ/UI:** Phụ thuộc bảo đảm chống dùng trùng của KiotViet; chưa kiểm chứng thì chưa mở. Khóa Aloha không bảo vệ được POS.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV04 — KiotViet nhận đơn nhưng trả lời timeout

- **Truy vết:** KV04, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Mock KV nhận request/ghi giao dịch rồi ngắt response.

**Bước thực hiện:**

1. Retry công việc.
2. tra theo liên kết.

**Kết quả mong đợi:** Một giao dịch nguồn; không dùng voucher lần hai; nếu chưa xác định thì chờ đối soát.

**Đối chiếu nghiệp vụ/UI:** Tra cứu bằng liên kết ổn định trước retry. Không tạo hóa đơn hoặc tiêu thụ voucher lần hai.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV05 — KiotViet trả tổng khác web

- **Truy vết:** KV05, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Web tổng 930.000đ, KV cố ý trả 940.000đ.

**Bước thực hiện:**

1. Đồng bộ và yêu cầu QR/COD.

**Kết quả mong đợi:** Báo lệch 10.000đ; không phát hành hướng dẫn thu sai; có dữ liệu đối soát.

**Đối chiếu nghiệp vụ/UI:** Chặn bước xác nhận số tiền thanh toán, đối soát mapping. Ghi tiền dự kiến/thực tế/chênh lệch.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV06 — Đồng bộ ngược đơn có giảm toàn đơn

- **Truy vết:** KV06, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn hàng 1 triệu, giảm đơn 100.000đ, ship 30.000đ.

**Bước thực hiện:**

1. Nhận đồng bộ KV hai lần.

**Kết quả mong đợi:** Tổng vẫn 930.000đ, không thành 1.030.000đ; không giảm lặp xuống 830.000đ.

**Đối chiếu nghiệp vụ/UI:** Đọc giảm đầy đủ, bảo toàn snapshot/đánh dấu thay đổi. Không cộng dòng và ship rồi bỏ giảm.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV07 — Nhân viên thêm giảm giá trên KiotViet

- **Truy vết:** KV07, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Đơn chưa trả rồi đơn đã trả; nhân viên thêm giảm 50.000đ ở KV.

**Bước thực hiện:**

1. Chạy riêng hai bộ và nhận đồng bộ.

**Kết quả mong đợi:** Chưa trả yêu cầu báo giá/xác nhận mới; đã trả vào điều chỉnh; không tự cộng giảm web lần nữa.

**Đối chiếu nghiệp vụ/UI:** Nhận diện thay đổi; xử lý theo trạng thái trả tiền. Không tự cộng chồng ưu đãi web lần nữa.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV08 — Mã voucher hết hạn giữa báo giá và xác nhận

- **Truy vết:** KV08, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Voucher hết hạn giữa quote và xác nhận.

**Bước thực hiện:**

1. Dừng đồng hồ tại hạn.
2. xác nhận.

**Kết quả mong đợi:** Không tiêu thụ hoặc ghi đã trả voucher; tổng mới phải được khách xác nhận.

**Đối chiếu nghiệp vụ/UI:** Không tiêu thụ; báo tổng mới để khách quyết định. Không âm thầm thu phần thiếu.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV09 — Đã dùng voucher rồi hủy hóa đơn

- **Truy vết:** KV09, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Voucher đã dùng; hóa đơn nguồn bị hủy.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Đọc trạng thái nguồn sau hủy.
2. đồng bộ lại.

**Kết quả mong đợi:** Chỉ phản ánh trạng thái thực; chưa có hợp đồng khôi phục thì không hứa mã dùng lại.

**Đối chiếu nghiệp vụ/UI:** Xác minh cơ chế hoàn mã của nguồn trước khi hứa khôi phục. Không tự sửa cache thành “chưa dùng”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV10 — Voucher lớn hơn tiền còn cần thanh toán

- **Truy vết:** KV10, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Tiền còn thu 100.000đ, voucher mệnh giá 200.000đ.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Thử áp dụng trong sandbox.

**Kết quả mong đợi:** Kết quả theo hợp đồng phần dư đã duyệt; không mặc định trả 100.000đ tiền mặt; blocked trước khi chốt.

**Đối chiếu nghiệp vụ/UI:** Chỉ hỗ trợ sau khi chốt quy tắc dùng dư/số dư ở nguồn. Không tự trả phần dư bằng tiền mặt.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV11 — Đơn vừa giảm 100.000đ vừa trả voucher 200.000đ

- **Truy vết:** KV11, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hàng 1 triệu, discount 100.000đ, voucher payment 200.000đ, ship 0, A 5%.

**Bước thực hiện:**

1. Xác nhận voucher.
2. thu phần còn lại.
3. đối soát.

**Kết quả mong đợi:** Giá trị đơn 900.000đ; voucher trả 200.000đ; còn thu 700.000đ; A 45.000đ.

**Đối chiếu nghiệp vụ/UI:** Hàng 1 triệu → giá trị sau giảm 900.000đ → còn trả 700.000đ, chưa tính ship. CTV 5% trên 900.000đ = 45.000đ nếu voucher là phương thức trả tiền.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV12 — Voucher được tặng để marketing thay vì bán

- **Truy vết:** KV12, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Voucher tặng 200.000đ, hàng 1 triệu, không discount.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Preview với chính sách hoa hồng được duyệt.

**Kết quả mong đợi:** Không tự đổi voucher thành discount; số hoa hồng phụ thuộc policy tài trợ đã duyệt, ghi blocked nếu chưa có.

**Đối chiếu nghiệp vụ/UI:** Cần chính sách tài trợ/hoa hồng riêng nếu shop muốn trừ chi phí đó. Không tự đồng nhất mọi voucher với giảm giá.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV13 — Hoàn đơn đã trả bằng tiền và voucher

- **Truy vết:** KV13, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** KV11 đã trả thêm tiền mặt/chuyển khoản 700.000đ.
- **Điểm chặn:** duyệt chính sách hoặc khả năng tích hợp tương ứng ở mục 14/16 trước khi chấm Pass; chưa rõ thì Blocked.

**Bước thực hiện:**

1. Hoàn toàn bộ/hoàn một phần trong hai bộ thử.

**Kết quả mong đợi:** Tổng giá trị hoàn không vượt đã trả; phân nguồn theo hợp đồng duyệt; không hoàn mặc định 900.000đ tiền mặt.

**Đối chiếu nghiệp vụ/UI:** Phân bổ hoàn theo nguồn và khả năng API đã xác minh. Không hoàn hết bằng tiền mặt tùy tiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV14 — Token hết hạn/mạng lỗi khi kiểm tra mã

- **Truy vết:** KV14, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Token nguồn hết hạn, bộ lỗi mạng và bộ refresh thành công.

**Bước thực hiện:**

1. Kiểm tra mã.
2. giả lập refresh/retry.

**Kết quả mong đợi:** Retry hữu hạn; không thành công giả; không lộ credential trong response/log.

**Đối chiếu nghiệp vụ/UI:** Retry xác thực phù hợp; trạng thái chờ, không thành công giả. Không lộ token hoặc lỗi kỹ thuật cho khách.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV15 — Ship vừa là dòng dịch vụ vừa là phí giao hàng

- **Truy vết:** KV15, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hàng net 900.000đ, ship 30.000đ xuất hiện ở hai biểu diễn nguồn.

**Bước thực hiện:**

1. Mapping gửi/nhận.
2. đối soát.

**Kết quả mong đợi:** Tổng 930.000đ, không 960.000đ.

**Đối chiếu nghiệp vụ/UI:** Mapping chỉ tính đúng một lần. Kiểm thử riêng đơn có/không ship.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-KV16 — Giảm dòng quantity > 1 khác ngữ nghĩa hai hệ thống

- **Truy vết:** KV16, mục 15. **Ưu tiên:** P0. **Lớp:** Tích hợp hợp đồng nguồn + đối soát. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Một sản phẩm qty 3, giá 100.000đ, tổng giảm mong muốn 30.000đ.

**Bước thực hiện:**

1. Gửi theo adapter đã kiểm chứng.
2. đọc lại tổng/chi tiết.

**Kết quả mong đợi:** Tiền dòng 270.000đ; không 210.000đ hoặc 290.000đ vì nhầm đơn vị.

**Đối chiếu nghiệp vụ/UI:** Kiểm chứng hợp đồng, chuyển đổi rõ đơn vị/toàn dòng. Không lấy tên discount làm bằng chứng công thức.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm AD — Quản trị

#### TC-AD01 — Admin sửa 10% thành 15% khi khách đang checkout

- **Truy vết:** AD01, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800 đã quote v1 10%, đơn khác đã chốt v1; v2=15% trần đủ.

**Bước thực hiện:**

1. Admin kích hoạt v2.
2. đặt bằng quote v1.
3. mở đơn cũ.

**Kết quả mong đợi:** Giỏ mới giảm 120.000đ/tổng 710.000đ; đơn cũ giảm 80.000đ/tổng 750.000đ.

**Đối chiếu nghiệp vụ/UI:** Giỏ chưa chốt báo giá lại; đơn chốt giữ snapshot. Khách xác nhận tổng thay đổi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD02 — Admin tạm dừng chương trình đang có lượt giữ

- **Truy vết:** AD02, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Một đơn giữ FIRST10 và một giỏ chưa chốt.

**Bước thực hiện:**

1. Dừng chương trình.
2. hoàn tất đơn giữ.
3. đặt giỏ mới.

**Kết quả mong đợi:** Đơn giữ vẫn được hưởng trong hạn; giỏ mới không giữ thêm.

**Đối chiếu nghiệp vụ/UI:** Ngăn lượt mới, giữ cam kết đơn cũ. Số đơn đang giữ và ảnh hưởng thao tác.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD03 — Hai admin lưu cùng chương trình

- **Truy vết:** AD03, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai admin mở revision 1.

**Bước thực hiện:**

1. Admin A lưu.
2. admin B lưu dữ liệu cũ.

**Kết quả mong đợi:** A thành revision 2; B nhận xung đột, không ghi đè hoặc mất dữ liệu nhập.

**Đối chiếu nghiệp vụ/UI:** Dùng revision, báo xung đột. So sánh thay đổi, không last-write-wins im lặng.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD04 — Giảm ngân sách thấp hơn đã dùng + đang giữ

- **Truy vết:** AD04, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Ngân sách đã dùng 100.000đ, giữ 80.000đ.

**Bước thực hiện:**

1. Thử đặt tổng ngân sách 179.999đ rồi 180.000đ.

**Kết quả mong đợi:** 179.999 bị từ chối; 180.000 được nếu chính sách cho bằng, còn khả dụng 0.

**Đối chiếu nghiệp vụ/UI:** Từ chối cấu hình không hợp lệ. Nêu ngân sách tối thiểu hiện tại.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD05 — Admin xóa chương trình đã phát sinh giao dịch

- **Truy vết:** AD05, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Chương trình có đơn và mã đã dùng.

**Bước thực hiện:**

1. Yêu cầu xóa qua UI/API.

**Kết quả mong đợi:** Lưu trữ hoặc từ chối hard delete; đơn cũ đọc được snapshot/lịch sử.

**Đối chiếu nghiệp vụ/UI:** Chuyển lưu trữ, giữ lịch sử. Không mất điều kiện cũ trên đơn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD06 — Nhân bản chương trình đang chạy

- **Truy vết:** AD06, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Chương trình active có mã và số lượt.

**Bước thực hiện:**

1. Nhân bản.
2. kiểm tra list và checkout.

**Kết quả mong đợi:** Bản mới draft, chưa giảm; không sao chép lượt đã dùng thành quyền hoạt động.

**Đối chiếu nghiệp vụ/UI:** Tạo bản nháp với mã mới. Không vô tình chạy hai chương trình.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD07 — Tác vụ lên lịch bị trễ

- **Truy vết:** AD07, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Chương trình [T0,T1), tác vụ lịch dừng.

**Bước thực hiện:**

1. Đặt ở T0 và T1 với đồng hồ server.

**Kết quả mong đợi:** T0 cho phép; T1 từ chối dù nhãn job chưa cập nhật.

**Đối chiếu nghiệp vụ/UI:** Backend vẫn kiểm tra thời gian mỗi lần tính. Trạng thái UI lấy từ thời gian thực.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD08 — Thiết bị khách sai giờ

- **Truy vết:** AD08, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Thiết bị lệch +24h và -24h.

**Bước thực hiện:**

1. Báo giá cùng giỏ tại cùng giờ server.

**Kết quả mong đợi:** Kết quả điều kiện thời gian giống nhau; hiển thị theo timezone cấu hình.

**Đối chiếu nghiệp vụ/UI:** Dùng giờ server. Giờ hiển thị thống nhất Việt Nam.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD09 — Preview admin làm nhiều lần

- **Truy vết:** AD09, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Counters ban đầu 0; preview G800 U_NEW.

**Bước thực hiện:**

1. Chạy preview 20 lần.
2. đọc DB/jobs.

**Kết quả mong đợi:** Counters vẫn 0; không đơn, công việc thu tiền hoặc ghi KV.

**Đối chiếu nghiệp vụ/UI:** Không tăng lượt hoặc gọi API tạo giao dịch. Kết quả có dấu “Xem thử”.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD10 — Nhân viên chỉ có quyền xem gọi API sửa

- **Truy vết:** AD10, mục 15. **Ưu tiên:** P0. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Tài khoản chỉ xem; có URL và ID chương trình.

**Bước thực hiện:**

1. Gửi trực tiếp create/update/activate/export không được cấp.

**Kết quả mong đợi:** Backend từ chối, dữ liệu không đổi; quyền export kiểm tra riêng.

**Đối chiếu nghiệp vụ/UI:** Backend từ chối. Kiểm thử quyền trực tiếp qua API.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD11 — Banner còn mã nhưng chương trình đã dừng

- **Truy vết:** AD11, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Banner trỏ chương trình active, sau đó pause.

**Bước thực hiện:**

1. Dừng.
2. nhận SSE hoặc refetch.
3. mở banner ở cache cũ.

**Kết quả mong đợi:** Không hứa dùng được; checkout server vẫn từ chối lượt mới.

**Đối chiếu nghiệp vụ/UI:** Banner dùng trạng thái chương trình hoặc tự ẩn. Không để mã hiển thị tách rời hiệu lực.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-AD12 — Hoàn đơn làm báo cáo doanh thu giảm

- **Truy vết:** AD12, mục 15. **Ưu tiên:** P1. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY hoàn riêng X.

**Bước thực hiện:**

1. Xem báo cáo kỳ gốc và kỳ hoàn, lọc chương trình.

**Kết quả mong đợi:** Doanh thu hàng sau giảm 900.000đ, hoàn 540.000đ, còn 360.000đ; lịch sử dùng không biến mất.

**Đối chiếu nghiệp vụ/UI:** Ghi riêng hoàn, không xóa lượt lịch sử. Định nghĩa rõ doanh thu sau giảm và sau hoàn.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm UX — Trải nghiệm

#### TC-UX01 — Giỏ thay đổi liên tục, phản hồi cũ về sau

- **Truy vết:** UX01, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Giỏ revision R1 rồi R2; API R1 chậm hơn.

**Bước thực hiện:**

1. Thay số lượng hai lần.
2. cho R2 về trước R1.

**Kết quả mong đợi:** Màn hình và request đặt dùng R2; R1 không ghi đè.

**Đối chiếu nghiệp vụ/UI:** Chỉ hiển thị báo giá của revision mới nhất. Không nhảy ngược tổng tiền.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX02 — Mất mạng khi áp dụng mã

- **Truy vết:** UX02, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Nhập FIX100, mạng bị ngắt trước response.

**Bước thực hiện:**

1. Áp dụng.
2. thử lại sau nối mạng.

**Kết quả mong đợi:** Giữ nội dung nhập; không hiện đã áp dụng khi chưa rõ; không submit báo giá cũ.

**Đối chiếu nghiệp vụ/UI:** Giữ đầu vào, báo lỗi, cho thử lại. Không báo đã áp dụng nếu chưa có kết quả.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX03 — Người dùng đóng/mở bảng chọn mã

- **Truy vết:** UX03, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** FIX100 đã xác nhận; trong panel chọn PRIVATE nhưng chưa xác nhận.

**Bước thực hiện:**

1. Đóng rồi mở lại panel.

**Kết quả mong đợi:** FIX100 vẫn là lựa chọn xác nhận; PRIVATE chưa bị dùng/giữ.

**Đối chiếu nghiệp vụ/UI:** Giữ lựa chọn đã xác nhận; thay đổi chưa xác nhận có thể hủy. Nút áp dụng/hủy rõ.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX04 — Mã không đủ ngưỡng

- **Truy vết:** UX04, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Giỏ nhóm E=800.000đ, ngoài E=400.000đ; ngưỡng E=1 triệu.

**Bước thực hiện:**

1. Mở mã.
2. xem lời nhắc mua thêm.

**Kết quả mong đợi:** Thiếu 200.000đ hàng E; không hiển thị đã đủ do tổng giỏ 1,2 triệu.

**Đối chiếu nghiệp vụ/UI:** Hiển thị lý do và phần tiền thiếu của hàng hợp lệ. Không tính cả món ngoài phạm vi vào gợi ý.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX05 — Mã riêng của khách khác có trong URL chia sẻ

- **Truy vết:** UX05, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OTHER mở link chứa PRIVATE của U_NEW.

**Bước thực hiện:**

1. Xem panel và network response.

**Kết quả mong đợi:** Không tên/email/số điện thoại chủ mã; chỉ thông báo không hợp lệ theo quyền.

**Đối chiếu nghiệp vụ/UI:** Không liệt kê thông tin cá nhân. Thông báo chung, có thể chọn mã công khai khác.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX06 — Khách dùng bàn phím/trình đọc màn hình

- **Truy vết:** UX06, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Bàn phím, trình đọc màn hình trong môi trường kiểm thử.

**Bước thực hiện:**

1. Tab mở thẻ.
2. chọn mã.
3. gây lỗi.
4. Escape đóng.
5. kiểm tra focus.

**Kết quả mong đợi:** Không kẹt focus; nhãn/lỗi/tiền mới được thông báo; focus trở về nơi mở.

**Đối chiếu nghiệp vụ/UI:** Focus đúng, nhãn rõ, đọc được tiền thay đổi. Không dùng màu đơn thuần để báo lỗi.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX07 — Mobile màn hình nhỏ, nhiều mã

- **Truy vết:** UX07, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Viewport 320/360/390px, 30 mã, bàn phím ảo bật.

**Bước thực hiện:**

1. Mở panel.
2. nhập mã.
3. cuộn.
4. xác nhận.

**Kết quả mong đợi:** Ô nhập/lỗi/nút tiếp cận được; không tràn trang; không chồng thanh đặt hàng.

**Đối chiếu nghiệp vụ/UI:** Bảng cuộn, nút xác nhận luôn tiếp cận được. Không che tổng tiền hoặc nội dung điều kiện.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-UX08 — Không có chương trình nào

- **Truy vết:** UX08, mục 15. **Ưu tiên:** P1. **Lớp:** E2E giao diện. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Không chương trình active.

**Bước thực hiện:**

1. Mở giỏ.
2. đặt đơn giá thường.

**Kết quả mong đợi:** Thông báo ngắn; không yêu cầu bắt buộc mã; tổng hàng+ship đúng.

**Đối chiếu nghiệp vụ/UI:** Hiển thị ngắn, cho thanh toán tiếp. Không tạo cảm giác bắt buộc có mã.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

### Nhóm VH — Vận hành

#### TC-VH01 — Tắt tính năng sau khi phát hiện lỗi

- **Truy vết:** VH01, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Một đơn giữ và một giỏ mới; cờ tính năng đang bật.

**Bước thực hiện:**

1. Tắt cờ.
2. thử hai luồng.

**Kết quả mong đợi:** Ngăn lượt mới; đơn cũ vẫn đối soát/tiêu thụ/hoàn đúng.

**Đối chiếu nghiệp vụ/UI:** Ngăn lượt mới, tiếp tục đối soát đơn cũ. Không xóa giữ lượt đang gắn thanh toán.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-VH02 — Tác vụ giải phóng chạy lại

- **Truy vết:** VH02, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 hết hạn có giữ 80.000đ.

**Bước thực hiện:**

1. Hai worker chạy giải phóng cùng lúc rồi chạy lại.

**Kết quả mong đợi:** Ngân sách hoàn 80.000đ đúng một lần; sổ không có hai hiệu lực giải phóng.

**Đối chiếu nghiệp vụ/UI:** Chuyển trạng thái có điều kiện, duy nhất. Không cộng ngân sách hai lần.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-VH03 — Log/báo cáo lỗi chứa mã riêng

- **Truy vết:** VH03, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Lỗi có request chứa private code/token.

**Bước thực hiện:**

1. Gây lỗi.
2. đọc log ứng dụng và export theo các quyền.

**Kết quả mong đợi:** Che credential/mã riêng theo chính sách; còn correlation ID phục vụ điều tra.

**Đối chiếu nghiệp vụ/UI:** Che dữ liệu nhạy cảm và giới hạn quyền xem. Giữ ID phục vụ điều tra thay cho toàn bộ mã.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

#### TC-VH04 — Số lượt tổng lệch với sổ giao dịch

- **Truy vết:** VH04, mục 15. **Ưu tiên:** P0. **Lớp:** API + tích hợp DB + E2E. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture counters lệch so với ledger một khoản 80.000đ.

**Bước thực hiện:**

1. Chạy báo cáo đối soát.
2. thực hiện sửa được cấp quyền.

**Kết quả mong đợi:** Phát hiện chênh lệch; sửa theo ledger có audit; không tăng hạn mức chương trình.

**Đối chiếu nghiệp vụ/UI:** Rà soát sổ giữ/tiêu thụ/giải phóng, sửa có nhật ký. Không tự tăng hạn mức để che sai lệch.

**Hậu kiểm:** kiểm tra các bất biến áp dụng tại mục 20.5; lưu bằng chứng theo mục 20.6. Không có thao tác thu/giữ trong case thì xác nhận counters không thay đổi ngoài dự kiến.

## 22. Test case bổ sung cho rủi ro kỹ thuật và luồng xuyên suốt

Các case dưới đây bổ sung các khoảng trống ngoài 142 tình huống mục 15. Chính sách và khả năng chưa duyệt vẫn áp dụng quy tắc Blocked; không được suy diễn kết quả tiền của bên thứ ba.

### TC-SEC01 — IDOR khách xem đơn/lượt của người khác

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U1/U2 có đơn riêng.

**Bước thực hiện:**

1. U1 thay orderId/redemptionId thành của U2 trên GET/POST.
2. thử tải chứng từ.

**Kết quả mong đợi:** Từ chối theo hợp đồng 403/404; không trả payload riêng và không đổi dữ liệu U2.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC02 — CTV đọc báo cáo CTV khác

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** A/B có hoa hồng riêng.

**Bước thực hiện:**

1. A sửa ctvId/query/export sang B.
2. mở link chi tiết của B.

**Kết quả mong đợi:** Chỉ dữ liệu A hoặc từ chối; không lọt dữ liệu B trong tổng/bảng/file.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC03 — Phiên hết hạn giữa lúc lưu

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin đã mở form, token sau đó hết hạn.

**Bước thực hiện:**

1. Sửa form.
2. gửi lưu.
3. đăng nhập lại.

**Kết quả mong đợi:** 401 theo hợp đồng; chưa lưu nhầm; giữ nháp UI an toàn để người dùng quyết định gửi lại; không tự kích hoạt.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC04 — CSRF trên thao tác quản trị

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Môi trường xác thực cookie thực tế, origin khác.

**Bước thực hiện:**

1. Gửi thao tác pause/create từ origin không được phép theo cơ chế cookie đang dùng.

**Kết quả mong đợi:** Bị chặn bởi bảo vệ hiện có/được thiết kế; không chỉ dựa vào ẩn nút hoặc CORS để bảo vệ mutation.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC05 — XSS trong tên/mô tả chương trình

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Chuỗi thử chứa thẻ script, thuộc tính onerror và HTML.

**Bước thực hiện:**

1. Lưu qua API.
2. xem shop/admin/CTV và export.

**Kết quả mong đợi:** Hiển thị như nội dung an toàn hoặc từ chối; không thực thi script, không lấy cookie.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC06 — NoSQL injection/ép kiểu

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Payload code chứa object $ne; percent là object; customerId mảng.

**Bước thực hiện:**

1. Gửi API preview/apply/create từng bộ.

**Kết quả mong đợi:** Schema từ chối kiểu sai; không biến thành query mở rộng; không có giữ/ghi ngoài ý muốn.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC07 — Sửa số tiền từ client

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800; thêm discount=999999,total=1,rate=100 vào request.

**Bước thực hiện:**

1. Gọi đặt đơn trực tiếp và qua trình duyệt.

**Kết quả mong đợi:** Giá/giảm/CTV tính từ nguồn server; không chấp nhận total=1 hoặc rate giả.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC08 — CSV formula injection

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Tên chương trình bắt đầu =,+,-,@ với biểu thức thử.

**Bước thực hiện:**

1. Xuất CSV.
2. mở bằng bảng tính môi trường cách ly.

**Kết quả mong đợi:** Nội dung người dùng không chạy như công thức; số tiền âm hợp lệ vẫn được xuất đúng kiểu.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC09 — Rò cache khi đổi tài khoản

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U1 có PRIVATE và báo cáo riêng.

**Bước thực hiện:**

1. U1 logout.
2. U2 login cùng trình duyệt.
3. back/reload.
4. kiểm tra query cache.

**Kết quả mong đợi:** Không thấy mã hoặc báo cáo U1; query theo định danh; request server kiểm tra quyền.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL01 — Giá trị phần trăm ngoài miền

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin form chương trình %.

**Bước thực hiện:**

1. Nhập -1,0,0.01,100,100.01 rồi gửi API tương ứng.

**Kết quả mong đợi:** Chỉ miền >0 và <=100 hợp lệ theo độ chính xác được hỗ trợ; không NaN/Infinity; lỗi từng trường.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL02 — VND/số lượng không nguyên hoặc quá lớn

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Form và API cấu hình.

**Bước thực hiện:**

1. Thử -1,0,1.5,chuỗi chữ,giá trị vượt Number.MAX_SAFE_INTEGER.

**Kết quả mong đợi:** Từ chối ngoài miền VND nguyên/giới hạn đã chốt; không tràn hay âm; biên tối đa hỗ trợ phải có hợp đồng trước test.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL03 — Ngày kết thúc bằng/trước bắt đầu

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Form nháp với T0.

**Bước thực hiện:**

1. Thử end=T0, end<T0, end>T0.

**Kết quả mong đợi:** Hai trường hợp đầu không kích hoạt; cuối cho qua khi điều kiện khác đủ.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL04 — Idempotency cùng khóa khác nội dung

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** K1 đã tạo cho G800.

**Bước thực hiện:**

1. Retry K1 với giỏ/khách/phương thức khác.

**Kết quả mong đợi:** Không âm thầm tái sử dụng kết quả cho nội dung khác; xung đột được báo; không thêm đơn hoặc sửa đơn gốc.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL05 — Điều kiện hàng vừa chọn vừa loại trừ

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** X thuộc nhóm E được chọn và danh sách loại trừ.

**Bước thực hiện:**

1. Preview rồi đặt chỉ X.
2. sau đó X+Y hợp lệ.

**Kết quả mong đợi:** Loại trừ thắng; X không góp ngưỡng/nhận giảm; kết quả đúng giải thích form.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL01 — Redis ngừng hoạt động lúc đặt

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Hai instance API, một lượt/ngân sách cuối.

**Bước thực hiện:**

1. Dừng Redis trong môi trường thử.
2. gửi 20 yêu cầu đặt đồng thời.

**Kết quả mong đợi:** Không vượt quyền/ngân sách; fallback MongoDB an toàn hoặc từ chối tạm; không mặc định cho qua.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL02 — Khóa Redis hết TTL giữa giao dịch

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Worker A đang xử lý, worker B chờ cùng khách.

**Bước thực hiện:**

1. Giữ A lâu hơn TTL.
2. B lấy khóa.
3. cho A tiếp tục.

**Kết quả mong đợi:** DB vẫn ngăn hai hiệu lực; A không xóa khóa owner B; không âm thầm commit khi mất quyền cần thiết.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL03 — MongoDB lỗi giữa commit/response

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture hỗ trợ lỗi kết nối/commit không rõ kết quả.

**Bước thực hiện:**

1. Gây lỗi.
2. retry cùng khóa.
3. chạy reconcile.

**Kết quả mong đợi:** Tra cứu kết quả bền vững; không khẳng định thất bại để cấp lại quyền nếu commit đã xảy ra.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL04 — Worker bị dừng sau gọi KV trước ghi trạng thái

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Nguồn thử đã nhận giao dịch.

**Bước thực hiện:**

1. Dừng worker đúng điểm.
2. restart.
3. retry.

**Kết quả mong đợi:** Tra giao dịch nguồn trước tạo lại; một giao dịch và một tiêu thụ; trạng thái local khớp sau đối soát.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL05 — SSE mất sự kiện hoặc gửi lặp

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin đổi chương trình khi shop/CTV mất stream.

**Bước thực hiện:**

1. Chặn stream.
2. đổi.
3. nối lại.
4. refocus.
5. gửi sự kiện trùng.

**Kết quả mong đợi:** Refetch khôi phục; sự kiện không cộng tiền/counters; đặt đơn luôn kiểm tra server.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL06 — Phân trang dữ liệu nguồn nhiều trang

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture 250 voucher, có trùng ở biên trang.

**Bước thực hiện:**

1. Đồng bộ đầy đủ rồi incremental.
2. ngắt giữa trang.

**Kết quả mong đợi:** Không thiếu hoặc tạo trùng ID; checkpoint an toàn; lần cập nhật chỉ hoàn tất khi đủ trang.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL07 — Schema nguồn thay đổi/status chưa biết

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Response KV thêm trường và status mới.

**Bước thực hiện:**

1. Đồng bộ.
2. xem admin.
3. thử dùng mã.

**Kết quả mong đợi:** Trường thêm không làm sập; status không biết không coi là usable; cảnh báo có thể đối soát.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL08 — Backup/restore và công việc còn dang dở

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Snapshot môi trường thử chứa đơn/lượt/job đang xử lý.

**Bước thực hiện:**

1. Khôi phục DB thử.
2. chạy reconcile và kiểm tra nguồn giao dịch.

**Kết quả mong đợi:** Không phát lại thu/hoàn thiếu kiểm soát; xác định chênh lệch sau snapshot trước tiếp tục; ghi thời gian phục hồi.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-PER01 — Tải đồng thời trên bộ tính báo giá

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Dữ liệu đại diện được duyệt: 50 dòng/giỏ, 100 chương trình, 50 client.

**Bước thực hiện:**

1. Chạy tải 10 phút.
2. thu p50/p95/error và theo dõi tiền.

**Kết quả mong đợi:** Không sai tiền hoặc ghi lượt khi quote; p95 mục tiêu thử <=1s cho xử lý quote không tính API ngoài, lỗi ngoài dự kiến <1%; duyệt lại mục tiêu theo hạ tầng.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-PER02 — Duyệt báo cáo lớn

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** 10.000 lượt thử và bộ lọc có index.

**Bước thực hiện:**

1. Mở trang, đổi lọc, next/back, export quyền hợp lệ.

**Kết quả mong đợi:** Phân trang server; không tải hết vào browser; tổng và trang khớp; đo latency/memory thay vì chỉ cảm nhận.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI01 — Tự giảm không cần bấm

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G800 FIRST10.

**Bước thực hiện:**

1. Không mở panel.
2. đi giỏ→xác nhận→đặt.

**Kết quả mong đợi:** Vẫn giảm 80.000đ; tổng 750.000đ; không bắt lưu/nhận mã.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI02 — Mã cá nhân tốt hơn nhưng chưa chọn

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Giỏ tự giảm 80.000đ, PRIVATE giảm 100.000đ.

**Bước thực hiện:**

1. Chỉ mở trang không chọn PRIVATE.
2. sau đó chủ động chọn.

**Kết quả mong đợi:** Trước chọn PRIVATE không bị giữ/dùng; sau chọn giảm 100.000đ nếu hợp lệ, tổng 730.000đ.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI03 — Responsive cả ba vai trò

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture shop/admin/CTV có tên dài, tiền lớn.

**Bước thực hiện:**

1. Kiểm tra 320/360/390/768/1024/1440px, zoom 200%, xoay ngang.

**Kết quả mong đợi:** Không tràn toàn trang, số tiền không cắt, nút không che; bảng chi tiết cuộn vùng có chỉ dẫn.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI04 — Xem trước là preview không phát hành

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin mẫu lần đầu chưa lưu.

**Bước thực hiện:**

1. Mở preview mobile/desktop.
2. đóng.
3. xem shop thật.

**Kết quả mong đợi:** Chỉ preview; không active, mã/lượt/job mới; trạng thái nháp rõ.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI05 — Nháp chưa lưu và điều hướng

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin đã sửa form hợp lệ.

**Bước thực hiện:**

1. Bấm rời trang rồi chọn ở lại.
2. lặp và bỏ thay đổi.

**Kết quả mong đợi:** Ở lại giữ dữ liệu; bỏ hủy thay đổi chưa lưu; không auto activate.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI06 — Lọc báo cáo và quay lại

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** CTV lọc kỳ, trạng thái; admin lọc chương trình.

**Bước thực hiện:**

1. Mở chi tiết rồi back.
2. refresh theo chính sách persist.

**Kết quả mong đợi:** Giữ bộ lọc đúng người; không reset gây hiểu sai tổng; xóa lọc trả đúng phạm vi mặc định.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E01 — Khách mới từ link đến CTV đủ điều kiện

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G1000 FIRST10 A 5%, ship 0.

**Bước thực hiện:**

1. Bấm link→checkout→đặt→trả 900.000đ→giao→qua thời gian đối soát.

**Kết quả mong đợi:** Một đơn/ưu đãi 100.000đ; một hoa hồng 45.000đ; chỉ đủ chi ở bước cuối; KV khớp.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E02 — Mua lại và đổi người giới thiệu

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_OLD sau E2E01; không ưu đãi; link B 8% hợp lệ.

**Bước thực hiện:**

1. Vào B→đặt G1000→giao thành công→đối soát.

**Kết quả mong đợi:** Không FIRST10; B 80.000đ; đơn cũ A 45.000đ không đổi.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E03 — Hoàn sau chi xuyên suốt

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** GXY đã chốt và chi A/B theo 15.6.

**Bước thực hiện:**

1. Hoàn X→đối soát KV→xem shop/admin/A/B→kỳ chi tiếp.

**Kết quả mong đợi:** Khách hoàn 540.000đ; A điều chỉnh -27.000đ; B không đổi 28.800đ; tổng báo cáo sau hoàn 360.000đ.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E04 — Thay cấu hình khi đang xác nhận

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Khách G800 quote FIRST10 v1; admin sửa v2=15%.

**Bước thực hiện:**

1. Khách gửi quote cũ→xác nhận quote mới→đặt→trả tiền.

**Kết quả mong đợi:** Giảm 120.000đ, tổng 710.000đ với ship 30.000đ; snapshot v2; không giữ v1 rồi cộng thêm v2.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E05 — Lỗi mạng và retry toàn luồng

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** G800, K1, nguồn KV thử.

**Bước thực hiện:**

1. Mất response sau lưu đơn/nguồn nhận→retry→thanh toán webhook lặp→restart.

**Kết quả mong đợi:** Một đơn, một nguồn, một khoản trả 750.000đ, một lượt used 80.000đ; không giữ mồ côi.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E06 — Lần đầu thành công dùng ưu đãi khác

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G1000, mã FIX150 được chọn, FIRST10 vẫn tồn tại.

**Bước thực hiện:**

1. Đặt giảm 150.000đ→trả 850.000đ→tạo giỏ G800 mới.

**Kết quả mong đợi:** Lần mua sau không đủ FIRST10 dù chưa từng dùng mã đó; quyền khách mới dựa lịch sử mua thành công.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-E2E07 — Khách tắt ưu đãi nhưng mua thành công

- **Truy vết:** mục 6–10, 15–16 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** U_NEW G800.

**Bước thực hiện:**

1. Chọn không dùng ưu đãi→trả 830.000đ→mua lại.

**Kết quả mong đợi:** Đơn đầu giảm 0; lần sau không được FIRST10; trạng thái không ưu đãi được tôn trọng.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-SEC10 — Webhook thanh toán không xác thực

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Payload giả giống PAY1, thiếu/sai xác thực theo tích hợp hiện có.

**Bước thực hiện:**

1. Gửi vào endpoint công khai.
2. thử payload sửa số tiền trên sự kiện hợp lệ.

**Kết quả mong đợi:** Không cập nhật paid/used/hoa hồng từ sự kiện không hợp lệ; có log không lộ secret.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-VAL06 — Giỏ rỗng, quantity âm/0/lẻ vượt quy tắc

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Gửi cart rỗng và từng bộ quantity sai trực tiếp API.

**Bước thực hiện:**

1. Quote rồi đặt từng payload.

**Kết quả mong đợi:** Từ chối theo schema hàng; không đơn, giữ lượt hay tổng âm; loại hàng cho số lượng lẻ phải có hợp đồng riêng.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL09 — Thu hồi quyền admin khi form đang mở

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Admin có quyền sửa mở form, sau đó bị thu hồi quyền.

**Bước thực hiện:**

1. Gửi lưu/kích hoạt bằng phiên cũ.

**Kết quả mong đợi:** Backend kiểm tra quyền còn hiệu lực theo cơ chế đã thiết kế, không chỉ UI; thay đổi bị từ chối và có audit.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-UI07 — CTV hiểu số tiền được chi

- **Truy vết:** mục 18 và bất biến mục 20.5. **Ưu tiên:** P1. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture 45.000đ tạm, 30.000đ đủ chi, 20.000đ đã chi, -5.000đ điều chỉnh.

**Bước thực hiện:**

1. Mở overview→chi tiết→thanh toán.
2. kiểm tra tổng từng nhóm.

**Kết quả mong đợi:** Các nhóm có định nghĩa, không cộng tất cả thành tiền có thể rút; khoản âm liên kết nguồn; số được yêu cầu đúng chính sách kỳ chi.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

### TC-REL10 — Backfill lịch sử và đơn cũ chưa có snapshot

- **Truy vết:** mục 8–9, 19 và bất biến mục 20.5. **Ưu tiên:** P0. **Trạng thái:** Not run.
- **Tiền điều kiện/dữ liệu:** Fixture đơn trước tính năng không discount snapshot.

**Bước thực hiện:**

1. Bật feature flag thử→đọc/sync/hoàn đơn cũ→rollback flag.

**Kết quả mong đợi:** Không tự áp chương trình mới cho đơn cũ; mapping mặc định có kiểm chứng; lịch sử không mất và không cấp lại lần đầu sai.

**Hậu kiểm/bằng chứng:** lưu theo mục 20.6; reset fixture và gỡ mọi điểm chèn lỗi. Ca không được phép ghi phải chứng minh DB/nguồn không đổi.

## 23. Bộ chạy, báo lỗi và điều kiện phát hành

### 23.1. Bộ chạy theo rủi ro

| Bộ | Test bắt buộc | Khi chạy |
|---|---|---|
| Smoke | KH01, KH03, GH08, CT01, TT01, TT06, AD09, UI01, SEC01 | Mỗi build đủ điều kiện thử |
| Tính tiền/hoàn/CTV | Toàn bộ GH, CT, DH; KV05, KV06, KV11, KV15, KV16 | Khi đổi giá, discount, mapping hoặc commission |
| Cạnh tranh/khôi phục | TT01–TT05, TT10–TT12, TT18, VH02, REL01–REL05 | Khi đổi DB, khóa, webhook, worker hoặc deployment nhiều instance |
| Quyền và dữ liệu | Toàn bộ SEC, AD10, MA09, UX05, REL09 | Mỗi đợt phát hành liên quan xác thực/API |
| Responsive và trải nghiệm | Toàn bộ UX, UI; ca người mới ở mục 18.10 | Khi đổi UI hoặc breakpoint |
| KiotViet thật | Toàn bộ KV trong phạm vi; REL04, REL06, REL07 | Trước mở tích hợp và khi nguồn thay hợp đồng |
| Hồi quy phát hành | Toàn bộ ca thuộc phạm vi phiên bản, gồm E2E01–E2E07 | Trước phát hành rộng |

Test tham chiếu trong bảng dùng cùng tiền tố TC-. Không chạy ca ngoài phạm vi vào nguồn thật khi chưa có quyền/môi trường. Bộ smoke qua không thay thế toàn bộ hồi quy tài chính.

### 23.2. Mẫu báo lỗi

- Defect ID, Test ID, Run ID, tiêu đề với trigger và hành vi sai.
- Build/commit, môi trường, policy version, tài khoản thử đã ẩn danh.
- Tiền điều kiện, dữ liệu, bước tái hiện tối thiểu.
- Expected / Actual riêng; ghi chênh lệch tiền cụ thể nếu có.
- Severity, Priority, tần suất tái hiện, phạm vi ảnh hưởng.
- Evidence và correlation ID, người phụ trách, trạng thái sửa/retest.
- Kết quả retest cùng test và các test hồi quy liên quan; không đóng lỗi chỉ vì đã merge code.

Ví dụ báo lỗi: “TC-KV06: đồng bộ đơn có giảm 100.000đ làm tổng tăng từ 930.000đ lên 1.030.000đ”. Gắn request nguồn, snapshot trước/sau và log; không chỉ ghi “voucher lỗi”.

### 23.3. Điều kiện kết thúc kiểm thử

1. Mọi yêu cầu trong phạm vi có ít nhất một test và kết quả chạy; 142 mã mục 15 không bị bỏ sót.
2. 100% P0/P1 trong phạm vi đạt; mọi bộ dữ liệu biên trong một case đều đạt trước đánh dấu Pass.
3. Không còn lỗi mở nghiêm trọng về sai tiền, thu/hoàn trùng, lộ dữ liệu, mất quyền và chi hoa hồng sai.
4. Blocked do chính sách/API phải giải quyết hoặc chính thức loại chức năng khỏi phiên bản và tắt đường dùng; không chuyển thành Pass.
5. Sai lệch đối soát ròng và giữ lượt mồ côi bằng 0 trong dữ liệu thử; ghi rõ thời hạn cho phép job bù hoàn tất theo cấu hình được duyệt.
6. Các yêu cầu responsive, khả năng tiếp cận và người dùng lần đầu có bằng chứng; vấn đề ít nghiêm trọng còn lại có người nhận rủi ro.
7. Typecheck/test/build phù hợp đã qua theo mục 19; số lượng Pass/Fail/Blocked/Not run/Out of scope báo cáo đầy đủ, không chỉ phần trăm trên các ca đã chạy.
8. Diễn tập tắt tính năng và xử lý đơn đang giữ đạt; có giám sát chênh lệch tiền, lỗi source, retry và số dư bất thường.
9. Chủ nghiệp vụ duyệt chính sách/UAT, người phụ trách kỹ thuật và QC xác nhận kết quả; đây là bước trước phát hành thật, không phải yêu cầu xin phép để viết tài liệu.

### 23.4. Hạng mục cần cụ thể hóa trước viết automation

- API path/schema và response code cuối cùng; tên collection/trường trạng thái thực tế.
- Thời hạn link CTV, đối soát/chi, giữ đơn review-first, chính sách self-buy và thiếu hàng do shop.
- Thuật toán làm tròn/phần dư, phạm vi thuế/phụ phí, tổng 0, hoàn theo nguồn voucher.
- Ngưỡng rate limit, SLO và tải mục tiêu dựa hạ tầng; PER01 là mục tiêu thử đề xuất, chưa phải cam kết production.
- Hợp đồng sandbox KiotViet, cách xác thực webhook và khả năng transaction MongoDB.
- Cơ chế quan sát/khôi phục: metric, audit, correlation ID và thời hạn job bù.

Trạng thái tài liệu: đã thiết kế test case, chưa viết test tự động, chưa thực thi, chưa chứng nhận chức năng đạt. Sau triển khai phải dùng kết quả thực tế để quyết định phát hành.

## 24. Voucher hỗ trợ phí ship theo khu vực

Bổ sung 29/09/2026. Trạng thái: chính sách và cách làm Giai đoạn 0 đã chốt ở mục 24.1 và 24.7, chưa viết code, test case Not run. Nhu cầu gốc: “hỗ trợ phí ship −30.000đ cho khách khu vực Hồ Chí Minh”. Mức 30.000đ và khu vực là giá trị cấu hình của chương trình mẫu, không gắn cố định vào code (mục 1).

### 24.1. Quyết định đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Khu vực Hồ Chí Minh | TP.HCM theo ranh giới **trước 01/07/2025**. Không gồm Bình Dương và Bà Rịa – Vũng Tàu cũ dù nay thuộc TP.HCM mới |
| Cách dùng | Tự áp dụng khi đủ điều kiện, khách không nhập mã |
| Kết hợp | Được kết hợp với một ưu đãi giảm tiền hàng và với chính sách miễn ship hiện có |
| Giới hạn | Có ngưỡng đơn tối thiểu, ngân sách tổng và giới hạn lượt dùng mỗi khách |
| Khách sỉ | Được áp dụng |
| Định nghĩa khu vực | “Vùng giao hàng” nội bộ gồm danh sách mã quận/huyện (và phường nếu cần), có phiên bản; không so tên tỉnh |
| Ngưỡng miễn ship | Tiền hàng sau mọi giảm tiền hàng, không cộng ship; tính ở server |
| Ngưỡng voucher ship | Giữ cách tính mục 3: sau giảm riêng sản phẩm, trước giảm toàn đơn, không cộng ship; tính ở server |
| Giới hạn chương trình | Giới hạn chính là tổng số lượt; ngân sách tiền là trần an toàn; cảnh báo khi dùng 80% |
| Ngân sách/lượt còn lẻ | Không giảm một phần |
| KiotViet | Chốt một cách ghi bằng thử trên gian hàng thử; đối soát hằng ngày |

### 24.2. Hiện trạng code (29/09/2026)

- Ưu đãi hiện chỉ giảm tiền hàng: `evaluator.ts` giới hạn mức giảm trong tiền hàng đủ điều kiện và phân bổ vào từng dòng (`lineDiscounts`); `orderCreateRoutes.ts` tính `total = subtotal − discount + shippingFee`.
- `PromotionDoc` không có trường khu vực/địa chỉ. `combineWithShip` được lưu nhưng không nơi nào đọc; form admin không hiển thị. `usageLimitPerCustomer` có trong kiểu dữ liệu nhưng form admin chưa cho nhập.
- Địa chỉ checkout có `province/district/ward` dạng chữ và `ghnProvinceId/ghnDistrictId/ghnWardCode`. Tên tỉnh không thống nhất giữa các nguồn: `vnLocations.ts` dùng “TP. Hồ Chí Minh”, `addressMerger.ts` dùng “Thành phố Hồ Chí Minh”, biến môi trường kho lấy hàng dùng “Hồ Chí Minh”.
- Cơ sở ngưỡng miễn ship không thống nhất: `quoteService.ts` xét trên tiền hàng **sau** giảm với `discountTotal` do client gửi; `orderCreateRoutes.ts` kiểm tra lại trên tiền hàng **trước** giảm. Client gửi `discountTotal = 0` có thể nhận miễn ship dù tiền hàng sau giảm không đạt ngưỡng. Phải sửa trước khi mở voucher ship vì hai chính sách được kết hợp.

### 24.3. Chính sách tính tiền

1. **Loại lợi ích mới:** chương trình có `benefitType` = `goods` (giảm tiền hàng, như hiện tại) hoặc `shipping` (giảm phí vận chuyển). Bản đầu voucher ship chỉ hỗ trợ số tiền cố định VND; giảm % phí ship để sau.
2. **Thứ tự tính:** giảm tiền hàng (mục 6) → báo giá ship theo địa chỉ → áp chính sách miễn ship → áp voucher ship trên phí còn lại.
3. **Số tiền giảm ship** = min(mệnh giá, phí ship sau miễn ship). Không âm, không chuyển phần dư sang tiền hàng.
4. **Tổng đơn** = tiền hàng − giảm hàng + (phí ship − giảm ship). Đúng bất biến mục 20.5.
5. **Khu vực:** chương trình trỏ tới một **vùng giao hàng** (mục 24.7.1). Thứ tự nhận diện: mã quận/huyện GHN (`ghnDistrictId`) → mã phường GHN → bảng bí danh tên quận/tỉnh đã chuẩn hóa không dấu (“tp ho chi minh”, “thanh pho ho chi minh”, “ho chi minh”, “hcm”, “sai gon”) kết hợp tên quận/huyện → nếu địa chỉ dạng mới hai cấp thì tra bảng phường mới → quận/huyện cũ. Không xác định được thì **không áp** và báo “Chưa xác định được khu vực — vui lòng chọn lại phường/xã”. Không so chuỗi tên tỉnh trực tiếp.
6. **Ngưỡng tối thiểu:** tính như mục 3 — tiền hàng đủ điều kiện sau giảm riêng sản phẩm, **trước** giảm toàn đơn; không cộng ship và thuế. Toán tử “trên/từ” admin chọn. Khác cơ sở ngưỡng miễn ship (sau mọi giảm, mục 24.7.2) theo quyết định 29/09/2026: mã giảm toàn đơn không làm khách mất hỗ trợ ship.
7. **Kết hợp:** tối đa một voucher ship mỗi đơn; nhiều voucher ship cùng hợp lệ thì chọn mức giảm lớn nhất, bằng nhau theo priority rồi ID. Voucher ship không nằm trong nhóm loại trừ của ưu đãi tiền hàng. Đơn đã miễn ship (phí 0đ) thì voucher ship không áp và **không giữ lượt/ngân sách**.
8. **Lượt và ngân sách:** giới hạn chính là **tổng số lượt** (bắt buộc với voucher ship). Ngân sách tiền là trần an toàn, mặc định = tổng lượt × mệnh giá, admin có thể hạ; trừ theo số tiền giảm ship thực tế, không theo mệnh giá. Giữ khi đặt, trừ khi đơn thành công, trả khi hủy/hết hạn (mục 7). Hết lượt, hoặc ngân sách còn nhỏ hơn số tiền giảm của đơn, thì **không áp** — không giảm một phần.
9. **Lượt mỗi khách:** định danh theo tài khoản/số điện thoại đã xác minh như mục 7; không dùng số điện thoại nhận hàng tự nhập. Bộ tính phải thực thi `usageLimitPerCustomer`, tính cả lượt đang giữ, bằng cập nhật nguyên tử (mục 24.7.3).
10. **Khách sỉ:** đối tượng mặc định “Tất cả” gồm khách sỉ. Đơn sỉ bán nguyên thùng thường có phí ship “chờ shop báo phí”, áp theo SV09.
11. **Phí ship chưa có** (chờ shop báo phí): chưa trừ tiền; hiển thị “Được hỗ trợ tối đa 30.000đ phí ship khi shop báo phí”; khi shop báo phí và khách xác nhận báo giá cuối thì tính và giữ lượt.
12. **CTV:** cơ sở hoa hồng không gồm phí ship (mục 15.1) nên voucher ship không làm đổi hoa hồng.
13. **Snapshot đơn:** phí ship gốc, cơ sở ngưỡng miễn ship và cơ sở ngưỡng voucher ship, miễn ship (có/không, lý do), chương trình ship + phiên bản, vùng đã nhận diện (`regionId`, `regionVersion`, nguồn nhận diện), số tiền giảm ship, phí ship khách trả.

### 24.4. Admin

- Form tạo chương trình thêm lựa chọn **Loại ưu đãi**: “Giảm tiền hàng” / “Hỗ trợ phí vận chuyển”. Chọn hỗ trợ phí ship thì: mệnh giá chỉ VND; hiện trường **Vùng áp dụng** (chọn vùng giao hàng đã định nghĩa, có sẵn vùng “TP.HCM (ranh giới trước 01/07/2025)”); ẩn trần giảm %. Bản đầu không cho admin tự sửa danh sách quận trong vùng; sửa vùng tạo phiên bản mới và có audit.
- Hiện đủ: ngưỡng tối thiểu (ghi rõ “chưa trừ mã giảm toàn đơn”), **tổng lượt** (bắt buộc), ngân sách tổng (tự điền tổng lượt × mệnh giá, cho hạ), **lượt mỗi khách**, đối tượng khách (mặc định Tất cả), thời gian, tự áp dụng.
- Danh sách chương trình hiển thị lượt đã dùng/đang giữ/còn lại và tiền đã giảm; cảnh báo khi đạt 80% lượt hoặc ngân sách; trạng thái “Hết lượt/ngân sách” khi chạm trần.
- Bản tóm tắt ví dụ: “Tự động giảm tối đa 30.000đ phí ship cho đơn giao tới TP.HCM (ranh giới trước 01/07/2025), tiền hàng từ 300.000đ (chưa trừ mã giảm toàn đơn); 100 lượt, mỗi khách 1 lần; kết hợp được với giảm tiền hàng và miễn ship”.
- Xem thử (mục 4.3) bắt buộc có địa chỉ giao và cách nhận hàng; trả về khu vực nhận diện, phí ship, miễn ship, số tiền giảm ship và lý do không áp.
- Mẫu gợi ý mới trong form: “Hỗ trợ ship HCM 30k” — tạo ở trạng thái nháp.

### 24.5. Checkout và đơn hàng

- Bảng tiền có dòng riêng: “Phí vận chuyển 35.000đ” và “Hỗ trợ phí ship (TP.HCM) −30.000đ”. Không gộp vào “Giảm giá ưu đãi”.
- Thông báo khi không áp: ngoài khu vực; chưa đạt ngưỡng (kèm số tiền còn thiếu theo đúng cơ sở của chương trình); đã dùng hết lượt; chương trình hết lượt/ngân sách; phí ship đang chờ shop báo; đơn nhận tại cửa hàng.
- Hai ngưỡng ship dùng hai cơ sở khác nhau nên câu chữ phải nêu rõ, và số tiền còn thiếu hiển thị riêng cho từng chương trình: “Miễn ship cho đơn từ X đ (sau giảm giá)”, “Hỗ trợ ship cho đơn từ Y đ (chưa trừ mã giảm toàn đơn)”.
- Báo giá ship trả thêm phần giảm ship do server tính; token báo giá ký kèm số tiền giảm và phiên bản chương trình. Khi tạo đơn, server tính lại từ token và địa chỉ, không nhận số tiền giảm từ client.
- Chi tiết đơn (khách và admin), email/thông báo và phiếu in hiển thị cùng dòng giảm ship.

### 24.6. Điểm tích hợp trong repo

| File | Việc dự kiến |
|---|---|
| `backend/shopPromotions/types.ts` | `benefitType`, `regionId`, tổng lượt bắt buộc với voucher ship, trường snapshot giảm ship |
| `backend/shopPromotions/evaluator.ts` | Hàm tính voucher ship nhận phí ship đã báo giá + khu vực; thực thi lượt/khách |
| `backend/shopPromotions/adminRoutes.ts` | Validate loại, mệnh giá VND, khu vực bắt buộc với voucher ship |
| `backend/shopPromotions/redemptionService.ts` | Giữ/trừ/trả lượt và ngân sách theo số tiền giảm ship |
| `backend/shopShipping/quoteService.ts`, `routes.ts`, `quoteToken.ts` | Dùng hàm cơ sở ngưỡng chung; tự tính giảm hàng thay vì nhận `discountTotal` từ client; trả và ký phần giảm ship |
| `backend/shopShipping/` (file mới cho vùng giao hàng) | Đọc vùng từ collection `config` (cache như `categorySizeConfig.ts`), nhận diện vùng từ địa chỉ |
| Script/job đối soát KiotViet (mới) | So 5 số tiền mỗi ngày, xuất danh sách lệch cho admin |
| `backend/shopOrders/orderCreateRoutes.ts` | Tính lại, lưu snapshot, `total` trừ giảm ship |
| Luồng đẩy đơn KiotViet | Ánh xạ phí ship sau giảm đúng một lần (KV15) — xác minh trước |
| `frontend/components/admin/promotions/PromotionFormModal.tsx` | Trường loại ưu đãi, khu vực, lượt/khách |
| `frontend/components/checkout/*` | Dòng “Hỗ trợ phí ship”, thông báo lý do |
| Dữ liệu địa chỉ (`frontend/lib/vnLocations.ts`, `ghnLocations.ts`) | Bí danh tên tỉnh/quận, bảng phường mới → quận/huyện cũ |

### 24.7. Giai đoạn 0 trước khi code

Chốt 29/09/2026 theo thông lệ phổ biến của các hệ thống thương mại điện tử lớn: dữ liệu địa chỉ riêng có phiên bản, tách từng khoản tiền, mọi phép tính tiền làm ở server, giới hạn theo lượt và đối soát định kỳ. Đây là thông lệ công khai, không phải quy trình nội bộ đã kiểm chứng của một công ty cụ thể. Mỗi việc có tiêu chí xong; chưa xong thì không bật cờ tính năng.

#### 24.7.1. Vùng giao hàng có phiên bản

- **Cách làm:** Aloha tự giữ định nghĩa vùng, không phụ thuộc cách hãng vận chuyển trả dữ liệu sau sáp nhập. Vùng = danh sách mã quận/huyện GHN (thêm mã phường khi cần), có `version` và ngày hiệu lực.
- **Việc cần làm:**
  1. Gọi API GHN thật: lấy mã tỉnh TP.HCM, mã các quận/huyện; ghi lại GHN đang trả ranh giới cũ hay mới.
  2. Tạo vùng “TP.HCM (ranh giới trước 01/07/2025)” gồm 22 đơn vị cấp huyện: Quận 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, Bình Tân, Bình Thạnh, Gò Vấp, Phú Nhuận, Tân Bình, Tân Phú, TP Thủ Đức, Bình Chánh, Cần Giờ, Củ Chi, Hóc Môn, Nhà Bè. Nếu GHN vẫn tách Quận 2, Quận 9 và Thủ Đức cũ thì đưa cả ba mã vào vùng.
  3. Nếu checkout hoặc GHN đã dùng địa chỉ hai cấp: thêm bảng phường mới → quận/huyện cũ theo nghị quyết sắp xếp đơn vị hành chính 2025. Phường mới gộp từ cả phần trong lẫn ngoài TP.HCM cũ thì không áp, không đoán.
  4. Lưu vùng trong collection `config` với cả `id` và `key` — collection này có unique index `key_1` không sparse, thiếu `key` sẽ lỗi E11000 như lần ghi `shipping_category_size`.
- **Xong khi:** địa chỉ mẫu của TC-SV01–SV03 cho đúng kết quả; đơn lưu `regionId` + `regionVersion`.

#### 24.7.2. Ngưỡng miễn ship: sau giảm, tính ở server

- **Quyết định:** cơ sở ngưỡng miễn ship = tiền hàng khách thực trả sau mọi giảm tiền hàng, không cộng ship và thuế. Voucher ship không dùng cơ sở này mà giữ cách tính mục 3 (mục 24.3 bước 6); cả hai đều do server tính. Đây cũng là cách phổ biến (ví dụ Amazon tính ngưỡng miễn phí vận chuyển sau khuyến mãi): khách phải thực trả đủ ngưỡng, tránh “mua đủ ngưỡng rồi dùng mã giảm xuống dưới”.
- **Việc cần làm:**
  1. Một hàm dùng chung tính cơ sở ngưỡng, gọi ở cả `quoteService.ts` và `orderCreateRoutes.ts`.
  2. Báo giá tự tính giảm hàng từ giỏ và chương trình đang áp (cùng bộ tính `evaluatePromotions`), bỏ `discountTotal` do client gửi. Token báo giá ký kèm cơ sở ngưỡng.
  3. Đổi câu chữ UI theo mục 24.5.
- **Ảnh hưởng:** báo giá hiện đã xét sau giảm, nên với khách dùng bình thường kết quả gần như không đổi; thay đổi chủ yếu chặn đường lách bằng `discountTotal = 0`.
- **Xong khi:** TC-SV16 Pass; request báo giá gửi `discountTotal` sai không làm đổi kết quả miễn ship.

#### 24.7.3. Lượt và ngân sách

- **Giới hạn chính:** tổng số lượt, bắt buộc với voucher ship. Ngân sách tiền là trần an toàn, mặc định = tổng lượt × mệnh giá.
- **Không giảm phần lẻ:** hết lượt, hoặc ngân sách còn nhỏ hơn số tiền giảm của đơn, thì không áp.
- **Lượt mỗi khách:** bộ đếm theo (chương trình, định danh khách = tài khoản + số điện thoại đã xác minh). Giữ lượt bằng một lệnh cập nhật có điều kiện `đã dùng + đang giữ < giới hạn` để hai đơn đồng thời không cùng lọt. Kiểm tra `evaluator.ts`/`redemptionService.ts` đã thực thi `usageLimitPerCustomer` chưa; chưa thì bổ sung.
- **Cảnh báo:** lượt hoặc ngân sách (tính cả đang giữ) đạt 80% thì báo admin một lần; chạm 100% thì chương trình tự ngừng áp đơn mới, hiển thị “Hết lượt/ngân sách”.
- **Để sau:** chống lạm dụng nâng cao (thiết bị, nhiều tài khoản cùng địa chỉ giao).
- **Xong khi:** TC-SV19, SV25, SV26, SV28 Pass.

#### 24.7.4. KiotViet và đối soát

- **Thử hợp đồng:** trên gian hàng thử, đẩy ba đơn: có ship; miễn ship; có giảm hàng + giảm ship. Ghi lại KiotViet lưu phí giao hàng và khoản giảm ở trường nào rồi chốt một cách ghi duy nhất. Nếu API không có trường giảm phí giao hàng: ghi phí giao hàng = phí khách trả sau giảm; phí gốc và khoản giảm lưu ở snapshot web và ghi chú đơn.
- **Đối soát hằng ngày:** so đơn web thành công với hóa đơn KiotViet theo 5 số — tiền hàng, giảm hàng, phí ship khách trả, giảm ship, tổng. Lệch từ 1đ trở lên vào danh sách cho admin xử lý; job không tự sửa dữ liệu.
- **Xong khi:** TC-SV24 và SV29 Pass trên môi trường thử.

#### 24.7.5. Chương trình mẫu và phát hành

- **Ngưỡng:** chủ shop xem giá trị đơn trung bình web 3 tháng gần nhất trên báo cáo, đặt ngưỡng cao hơn khoảng 10–30% để kéo khách mua thêm. Phía phát triển không truy vấn production để lấy số này.
- **Lượt/ngân sách:** chủ shop chọn theo mức chi chấp nhận được; fixture test dùng 100 lượt × 30.000đ = 3.000.000đ.
- **Phát hành:** cờ tính năng; chương trình tạo ở trạng thái nháp; nếu có từ hai tài khoản admin thì người tạo và người bật khác nhau; mọi thay đổi có audit; bật cho nhóm thử trước (mục 13).
- **Theo dõi:** lượt đã dùng/đang giữ, tiền đã giảm, số đơn không được áp theo từng lý do.

### 24.8. Tình huống vận hành

| Mã | Tình huống | Xử lý |
|---|---|---|
| SV01 | Tên tỉnh ghi nhiều kiểu (“TP. Hồ Chí Minh”, “Thành phố Hồ Chí Minh”, “Hồ Chí Minh”) | Nhận diện theo mã GHN rồi bí danh chuẩn hóa; cùng một kết quả |
| SV02 | Địa chỉ thuộc Bình Dương hoặc Bà Rịa – Vũng Tàu cũ, kể cả khi ghi “TP.HCM” dạng địa chỉ mới | Không áp — ngoài khu vực ranh giới cũ |
| SV03 | Địa chỉ cũ trong sổ có quận/huyện; địa chỉ mới chỉ có phường/xã | Cả hai dạng cho cùng kết quả khi thuộc TP.HCM cũ |
| SV04 | Khách đổi địa chỉ từ TP.HCM sang tỉnh khác trước khi đặt | Báo giá lại; bỏ voucher ship, nêu lý do |
| SV05 | Admin sửa địa chỉ đơn sau khi đặt | Kiểm tra lại điều kiện; có audit; không âm thầm giữ hoặc bỏ khoản giảm |
| SV06 | Phí ship thấp hơn mệnh giá (18.000đ) | Giảm 18.000đ; phí ship khách trả 0đ |
| SV07 | Đơn được miễn ship | Không áp voucher ship, không giữ lượt/ngân sách |
| SV08 | Nhận tại cửa hàng | Không áp |
| SV09 | Phí ship chờ shop báo | Chưa trừ; hiển thị “tối đa”; tính khi chốt báo giá cuối |
| SV10 | Phí hãng thực tế khác phí tạm tính | Giảm tính trên phí đã chốt với khách; chênh lệch theo chính sách phí ship |
| SV11 | Token báo giá hết hạn hoặc client sửa số tiền giảm | Server tính lại; từ chối số tiền do client gửi |
| SV12 | Đơn đặt trước giao nhiều lần | Giảm một lần cho mỗi đơn |
| SV13 | Ngưỡng biên 299.999/300.000đ; ship không cộng; giảm toàn đơn làm tiền hàng sau giảm dưới ngưỡng | Theo mục 24.3 bước 6: xét trước giảm toàn đơn nên vẫn áp |
| SV14 | Kết hợp với ưu đãi khách mới 10% | Áp cả hai, hai dòng riêng |
| SV15 | Hai voucher ship cùng hợp lệ | Chọn một, mức lớn nhất; bằng nhau theo priority rồi ID |
| SV16 | Giảm tiền hàng làm đơn rớt ngưỡng miễn ship | Mất miễn ship (cơ sở sau giảm, mục 24.7.2); báo giá và tạo đơn cùng kết quả; voucher ship được xét trên phí mới |
| SV17 | Hủy đơn hoặc chuyển khoản hết hạn | Trả lượt và ngân sách đúng một lần |
| SV18 | Giao thất bại hoặc hoàn hàng | Không hoàn khoản hỗ trợ ship thành tiền; phí ship hoàn theo chính sách riêng |
| SV19 | Hai khách tranh lượt/ngân sách cuối | Giữ nguyên tử; người sau nhận “hết ngân sách/lượt” và báo giá lại |
| SV20 | Chương trình hết hạn khi khách đang thanh toán | Giờ Việt Nam; đơn giữ lượt trước giờ kết thúc được giữ khoản giảm |
| SV21 | Khách sỉ | Được áp; đơn nguyên thùng theo SV09 |
| SV22 | Phí ship về 0đ nhờ voucher | Tổng vẫn gồm tiền hàng; đơn tổng 0đ theo mục 6 |
| SV23 | Hoa hồng CTV | Không đổi |
| SV24 | Đồng bộ KiotViet | Phí ship và giảm ship ghi nhận đúng một lần |
| SV25 | Khách đã dùng đủ lượt | Không áp; thông báo đã dùng; lượt đang giữ cũng được tính |
| SV26 | Ngân sách còn nhỏ hơn số tiền giảm của đơn | Không áp, không giảm một phần |
| SV27 | Khách chưa đăng nhập | Báo giá ship hiện yêu cầu đăng nhập; chỉ hiển thị lợi ích dạng “có thể được hỗ trợ” |
| SV28 | Lượt hoặc ngân sách chạm 80% và 100% | Báo admin một lần ở 80%; ở 100% ngừng áp đơn mới, trạng thái “Hết lượt/ngân sách” |
| SV29 | Số tiền web và KiotViet lệch | Đối soát ngày đưa đơn vào danh sách lệch; không tự sửa |

### 24.9. Test case

Fixture bổ sung (dùng cùng mục 20.4):

| Fixture | Giá trị |
|---|---|
| SHIP30_HCM | Tự áp dụng, giảm phí ship 30.000đ, vùng TP.HCM ranh giới trước 01/07/2025, tiền hàng từ 300.000đ (trước giảm toàn đơn), 100 lượt, ngân sách 3.000.000đ, 1 lượt/khách, đối tượng Tất cả |
| A_HCM | Giao tới Phường Tân Định, Quận 1, TP.HCM |
| A_BD | Giao tới Thuận An, Bình Dương cũ |
| A_HN | Giao tới Hà Nội |
| S35 / S18 | Phí ship báo giá 35.000đ / 18.000đ |

Hậu kiểm chung cho mọi TC-SV: bất biến mục 20.5; bằng chứng mục 20.6; counters lượt/ngân sách trước/sau khớp kỳ vọng; ca không giữ lượt thì counters không đổi.

#### TC-SV01 — Tên tỉnh nhiều kiểu

- **Truy vết:** SV01. **Ưu tiên:** P1. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; S35; tỉnh lần lượt “TP. Hồ Chí Minh”, “Thành phố Hồ Chí Minh”, “Hồ Chí Minh”, có/không `ghnProvinceId`.

**Kết quả mong đợi:** Cả bốn bộ nhận diện TP.HCM cũ, giảm 30.000đ, tổng 805.000đ.

#### TC-SV02 — Bình Dương cũ ghi dạng TP.HCM mới

- **Truy vết:** SV02. **Ưu tiên:** P0. **Lớp:** Logic/API. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; S35; A_BD ở dạng cũ và dạng địa chỉ mới thuộc TP.HCM.
- **Điểm chặn:** cần vùng giao hàng và bảng phường mới → quận/huyện cũ (mục 24.7.1); chưa có thì Blocked.

**Kết quả mong đợi:** Không áp ở cả hai dạng; lý do “ngoài khu vực”; tổng 835.000đ.

#### TC-SV03 — Địa chỉ ba cấp và hai cấp

- **Truy vết:** SV03. **Ưu tiên:** P1. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** A_HCM dạng tỉnh/quận/phường và dạng tỉnh/phường.

**Kết quả mong đợi:** Cùng nhận diện TP.HCM cũ và cùng mức giảm.

#### TC-SV04 — Đổi địa chỉ trước khi đặt

- **Truy vết:** SV04, GH14. **Ưu tiên:** P1. **Lớp:** API + UI. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; A_HCM → A_HN.

**Bước thực hiện:**

1. Báo giá với A_HCM.
2. Đổi sang A_HN, chờ báo giá mới.
3. Đặt đơn.

**Kết quả mong đợi:** Dòng hỗ trợ ship biến mất kèm lý do; đơn lưu không có giảm ship; không giữ lượt.

#### TC-SV05 — Admin sửa địa chỉ sau đặt

- **Truy vết:** SV05. **Ưu tiên:** P1. **Lớp:** API + DB. **Trạng thái:** Not run.
- **Dữ liệu:** Đơn đã đặt với A_HCM có giảm 30.000đ; admin đổi sang A_HN.

**Kết quả mong đợi:** Hệ thống yêu cầu báo giá/xác nhận lại; giảm ship được bỏ và lượt trả lại khi xác nhận; có audit người sửa.

#### TC-SV06 — Phí ship nhỏ hơn mệnh giá

- **Truy vết:** SV06. **Ưu tiên:** P0. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; A_HCM; S18.

**Kết quả mong đợi:** Giảm 18.000đ; ship khách trả 0đ; tổng 800.000đ; ngân sách trừ 18.000đ.

#### TC-SV07 — Đơn đã miễn ship

- **Truy vết:** SV07. **Ưu tiên:** P0. **Lớp:** Logic/API. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; A_HCM; giỏ đạt điều kiện miễn ship.

**Kết quả mong đợi:** Phí ship 0đ, không có dòng hỗ trợ ship; lượt và ngân sách không đổi.

#### TC-SV08 — Nhận tại cửa hàng

- **Truy vết:** SV08. **Ưu tiên:** P1. **Lớp:** API. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; nhận tại cửa hàng.

**Kết quả mong đợi:** Không áp; không giữ lượt.

#### TC-SV09 — Phí ship chờ shop báo

- **Truy vết:** SV09. **Ưu tiên:** P1. **Lớp:** API + UI. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; A_HCM; giỏ có hàng nguyên thùng (phí chờ báo).

**Bước thực hiện:**

1. Đặt đơn khi phí chưa có.
2. Shop báo phí 35.000đ; khách xác nhận báo giá cuối.

**Kết quả mong đợi:** Bước 1 hiển thị “tối đa 30.000đ”, chưa trừ, chưa giữ lượt. Bước 2 giảm 30.000đ và giữ lượt.

#### TC-SV10 — Phí hãng thực tế khác phí tạm tính

- **Truy vết:** SV10. **Ưu tiên:** P2. **Lớp:** DB. **Trạng thái:** Not run.
- **Dữ liệu:** Đơn chốt S35 giảm 30.000đ; hãng tính thực tế 42.000đ.

**Kết quả mong đợi:** Snapshot đơn giữ 35.000đ/−30.000đ; chênh lệch xử lý theo chính sách phí ship, không đổi khoản giảm.

#### TC-SV11 — Client sửa số tiền giảm ship

- **Truy vết:** SV11, TC-SEC07. **Ưu tiên:** P0. **Lớp:** API. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; A_HCM; request tạo đơn gửi giảm ship 35.000đ, hoặc token báo giá hết hạn.

**Kết quả mong đợi:** Server dùng số tự tính (30.000đ) hoặc yêu cầu báo giá lại; không lưu số client gửi.

#### TC-SV12 — Đơn đặt trước giao nhiều lần

- **Truy vết:** SV12. **Ưu tiên:** P2. **Lớp:** DB. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; đơn A_HCM có hàng đặt trước, giao hai lần.

**Kết quả mong đợi:** Giảm ship một lần cho đơn; lượt trừ một lần.

#### TC-SV13 — Biên ngưỡng

- **Truy vết:** SV13, GH03. **Ưu tiên:** P0. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM “từ 300.000đ”; A_HCM; S35; tiền hàng 299.999đ / 300.000đ; thêm bộ 300.000đ kèm ưu đãi toàn đơn giảm 20.000đ.

**Kết quả mong đợi:** 299.999đ không áp (báo thiếu 1đ); 300.000đ áp; bộ có giảm toàn đơn vẫn áp 30.000đ vì ngưỡng voucher ship tính trước giảm toàn đơn (tổng 280.000đ + 5.000đ = 285.000đ).

#### TC-SV14 — Kết hợp khách mới 10%

- **Truy vết:** SV14. **Ưu tiên:** P0. **Lớp:** Logic/API + UI. **Trạng thái:** Not run.
- **Dữ liệu:** U_NEW; FIRST10; SHIP30_HCM; G800; A_HCM; S35.

**Kết quả mong đợi:** Giảm hàng 80.000đ, giảm ship 30.000đ, tổng 725.000đ; hai dòng riêng; snapshot lưu hai chương trình.

#### TC-SV15 — Hai voucher ship cùng hợp lệ

- **Truy vết:** SV15. **Ưu tiên:** P1. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM và một voucher ship 20.000đ cùng khu vực; G800; A_HCM; S35.

**Kết quả mong đợi:** Chỉ áp 30.000đ; chạy lặp cho cùng kết quả; khi bằng nhau chọn theo priority rồi ID.

#### TC-SV16 — Giảm hàng làm rớt ngưỡng miễn ship

- **Truy vết:** SV16, GH13. **Ưu tiên:** P0. **Lớp:** Logic/API. **Trạng thái:** Not run.
- **Dữ liệu:** Tiền hàng vừa chạm ngưỡng miễn ship trước giảm; ưu đãi giảm toàn đơn làm tiền hàng sau giảm rớt dưới ngưỡng miễn ship; tiền hàng trước giảm toàn đơn vẫn từ 300.000đ; A_HCM; S35. Bộ thứ hai: cùng giỏ, request báo giá gửi `discountTotal = 0`.

**Kết quả mong đợi:** Không miễn ship; giảm ship 30.000đ trên phí 35.000đ; báo giá và tạo đơn cùng kết quả. Bộ thứ hai cho kết quả như bộ đầu vì server tự tính giảm hàng.

#### TC-SV17 — Hủy hoặc hết hạn

- **Truy vết:** SV17. **Ưu tiên:** P0. **Lớp:** DB. **Trạng thái:** Not run.
- **Dữ liệu:** Đơn giữ lượt SHIP30_HCM 30.000đ; hủy; gửi lại sự kiện hủy lần hai.

**Kết quả mong đợi:** Lượt và ngân sách trả đúng một lần.

#### TC-SV18 — Giao thất bại/hoàn hàng

- **Truy vết:** SV18. **Ưu tiên:** P1. **Lớp:** DB. **Trạng thái:** Not run.
- **Dữ liệu:** Đơn giảm ship 30.000đ đã thanh toán, giao thất bại và hoàn.

**Kết quả mong đợi:** Khoản hoàn không gồm 30.000đ hỗ trợ ship; phí ship hoàn theo chính sách riêng; lượt không cấp lại tự động.

#### TC-SV19 — Tranh ngân sách cuối

- **Truy vết:** SV19. **Ưu tiên:** P0. **Lớp:** Tích hợp DB, hai instance API. **Trạng thái:** Not run.
- **Dữ liệu:** Bộ 1: SHIP30_HCM còn 30.000đ ngân sách. Bộ 2: còn 1 lượt. U_NEW1 và U_NEW2 đặt đồng thời trong mỗi bộ.

**Kết quả mong đợi:** Mỗi bộ đúng một đơn được giảm; đơn còn lại báo hết lượt/ngân sách và báo giá lại; tổng giữ + đã dùng không vượt 100 lượt và 3.000.000đ.

#### TC-SV20 — Biên thời gian

- **Truy vết:** SV20. **Ưu tiên:** P1. **Lớp:** Logic. **Trạng thái:** Not run.
- **Dữ liệu:** Đồng hồ khóa ở T1 − 1 giây và T1 theo giờ Việt Nam; đơn giữ lượt trước T1 rồi thanh toán sau T1.

**Kết quả mong đợi:** Trước T1 áp; từ T1 không áp đơn mới; đơn đã giữ trước T1 giữ khoản giảm.

#### TC-SV21 — Khách sỉ

- **Truy vết:** SV21. **Ưu tiên:** P1. **Lớp:** API. **Trạng thái:** Not run.
- **Dữ liệu:** U_SI; SHIP30_HCM; giỏ giá sỉ đạt ngưỡng; A_HCM; S35; thêm bộ hàng nguyên thùng.

**Kết quả mong đợi:** Bộ thường giảm 30.000đ; bộ nguyên thùng theo TC-SV09.

#### TC-SV22 — Phí ship về 0đ

- **Truy vết:** SV22. **Ưu tiên:** P2. **Lớp:** Logic + UI. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM; G800; A_HCM; S18.

**Kết quả mong đợi:** Ship khách trả 0đ, tổng 800.000đ; QR/chuyển khoản dùng đúng tổng.

#### TC-SV23 — Hoa hồng CTV

- **Truy vết:** SV23. **Ưu tiên:** P0. **Lớp:** Logic/DB. **Trạng thái:** Not run.
- **Dữ liệu:** GXY qua link CTV A 5%; SHIP30_HCM; A_HCM; S35.

**Kết quả mong đợi:** Cơ sở hoa hồng như khi không có voucher ship; hoa hồng không đổi.

#### TC-SV24 — Đồng bộ KiotViet

- **Truy vết:** SV24, KV15. **Ưu tiên:** P0. **Lớp:** Hợp đồng KiotViet (sandbox). **Trạng thái:** Not run.
- **Điểm chặn:** ánh xạ phí giao hàng/giảm phí giao hàng chưa xác minh thì Blocked.
- **Dữ liệu:** Đơn G800 + FIRST10 + SHIP30_HCM, S35.

**Kết quả mong đợi:** KiotViet ghi tiền hàng 800.000đ, giảm 80.000đ, phí ship khách trả 5.000đ, tổng 725.000đ; không trừ hai lần; đọc ngược không làm mất khoản giảm.

#### TC-SV25 — Đã dùng hết lượt

- **Truy vết:** SV25. **Ưu tiên:** P0. **Lớp:** API/DB. **Trạng thái:** Not run.
- **Dữ liệu:** Khách đã có một đơn thành công dùng SHIP30_HCM; bộ thứ hai: đơn đầu đang giữ lượt chưa thanh toán.

**Kết quả mong đợi:** Đơn tiếp theo không áp ở cả hai bộ; thông báo đã dùng lượt.

#### TC-SV26 — Ngân sách còn lẻ

- **Truy vết:** SV26. **Ưu tiên:** P1. **Lớp:** Logic/DB. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM còn 20.000đ ngân sách và còn lượt; G800; A_HCM; S35. Bộ thứ hai: cùng ngân sách, S18.

**Kết quả mong đợi:** Bộ đầu không áp, ngân sách giữ nguyên 20.000đ, thông báo hết ngân sách. Bộ thứ hai áp 18.000đ vì số tiền giảm của đơn không vượt phần còn lại.

#### TC-SV27 — Khách chưa đăng nhập

- **Truy vết:** SV27. **Ưu tiên:** P2. **Lớp:** UI. **Trạng thái:** Not run.
- **Dữ liệu:** Khách vãng lai; giỏ G800; địa chỉ A_HCM.

**Kết quả mong đợi:** Không trừ tiền trước đăng nhập; chỉ hiển thị “có thể được hỗ trợ phí ship”; sau đăng nhập báo giá và áp bình thường.

#### TC-SV28 — Cảnh báo 80% và dừng ở 100%

- **Truy vết:** SV28. **Ưu tiên:** P1. **Lớp:** API/DB + UI admin. **Trạng thái:** Not run.
- **Dữ liệu:** SHIP30_HCM với 10 lượt; đặt lần lượt 8 đơn đủ điều kiện, rồi thêm 2 đơn, rồi đơn thứ 11. Bộ thứ hai: ngân sách hạ còn 240.000đ, lượt vẫn 100.

**Kết quả mong đợi:** Đơn thứ 8 (hoặc ngân sách dùng + giữ đạt 240.000đ × 80%) tạo đúng một cảnh báo admin; không lặp cảnh báo ở đơn sau. Khi chạm 100%, đơn mới không được áp, admin thấy trạng thái “Hết lượt/ngân sách”. Hủy một đơn đang giữ thì lượt trả lại và chương trình áp tiếp.

#### TC-SV29 — Đối soát web và KiotViet

- **Truy vết:** SV29, KV15. **Ưu tiên:** P1. **Lớp:** Tích hợp KiotViet (gian hàng thử). **Trạng thái:** Not run.
- **Điểm chặn:** cách ghi KiotViet chưa chốt (mục 24.7.4) thì Blocked.
- **Dữ liệu:** Ba đơn khớp; một đơn cố ý sửa phí giao hàng trên gian hàng thử lệch 5.000đ.

**Kết quả mong đợi:** Job đối soát báo đúng một đơn lệch, nêu số nào lệch và chênh bao nhiêu; ba đơn khớp không bị báo; job không sửa dữ liệu ở cả hai phía.

Bộ chạy đề xuất bổ sung vào mục 23.1: **Smoke voucher ship** gồm TC-SV02, SV06, SV07, SV11, SV13, SV14, SV16; **Tính tiền/cạnh tranh** gồm toàn bộ P0 của mục này, chạy khi đổi bộ tính ưu đãi, báo giá ship hoặc luồng tạo đơn; **Vận hành** gồm TC-SV28, SV29, chạy trước mỗi đợt bật chương trình mới.

