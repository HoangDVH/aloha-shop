# Kế hoạch phí vận chuyển tạm tính trên shop Aloha

Ngày lập: 28/09/2026. Trạng thái: đề xuất, chưa triển khai code.

Rà soát bổ sung ngày 29/09/2026: mục 14–18 quy định quan hệ ưu đãi, phí ship, hoa hồng CTV và đối soát KiotViet. Đây là yêu cầu triển khai/nghiệm thu, chưa phải xác nhận hệ thống chạy đúng trên production.

## 1. Mục tiêu và phạm vi

Khách nhìn thấy chi phí giao hàng dự kiến dù một số sản phẩm chưa có trọng lượng, trước khi gửi đơn cho shop xác nhận. Phí tạm không tự trở thành tiền phải thanh toán.

Phạm vi giao diện: giỏ hàng nếu đã có địa chỉ, trang xác nhận đơn, chi tiết đơn phía khách. **Không thêm trang, form hoặc chức năng quản lý phí ship bên admin.** Backend vẫn cần kiểm tra dữ liệu và tính phí; “chỉ làm trên shop” không có nghĩa để trình duyệt quyết định tiền.

Tận dụng bước shop gửi ảnh/báo giá và khách xác nhận hiện tại. Không thêm hãng vận chuyển, không dựng thuật toán đóng kiện tối ưu, không mở chức năng cân hàng hay quản lý mẫu cho admin trong đợt này.

## 2. Hiện trạng đã kiểm tra trong source

| Thành phần | Vai trò hiện tại / điểm cần lưu ý |
|---|---|
| backend/shopShipping/resolveWeight.ts | Ưu tiên trongLuong, chuỗi cân nặng trong mã/tên, biến môi trường mặc định, rồi mẫu kích thước. Đang suy đơn vị từ giá trị số; cần nhận diện nguồn/đơn vị để tránh sai |
| backend/shopShipping/sizePresets.ts | Có mẫu nhỏ 500g, vừa 3kg, to 12kg, đất/giá thể 20kg và kích thước tương ứng; chưa xác minh phù hợp hàng thực tế |
| backend/shopShipping/categorySizeMap.ts | Cơ sở gán nhóm vận chuyển từ danh mục |
| backend/shopShipping/quoteInput.ts | Dựng dữ liệu hàng và kiện cho báo giá; cần bảo đảm lấy metadata tin cậy từ server |
| backend/shopShipping/quoteService.ts | Gọi các adapter GHTK/GHN/SPX, có source api/estimate, chọn lựa chọn theo phí và chính sách miễn ship |
| backend/shopShipping/quoteToken.ts | Token ký có hạn, gắn giỏ/địa chỉ; hash hiện chỉ mã và số lượng, không thay thế kiểm tra giá/chính sách mới |
| frontend/components/checkout/CheckoutShippingSection.tsx | Có UI chọn hãng, tải/lỗi/địa chỉ thiếu, tổng cân ước tính và miễn ship |
| CheckoutSummaryAside.tsx / CheckoutStickyBar.tsx | Bảng tiền desktop/mobile cần thống nhất nhãn và tổng tạm |
| backend/shopOrders/checkoutFlags.ts | Có cờ yêu cầu quote và thanh toán; comment mặc định có chỗ khác giá trị hàm, phải kiểm tra đường chạy và env thật |

Đã kiểm tra source, chưa xác minh cấu hình production hoặc khả năng thanh toán của từng đường đi. Không bật cờ production trong phạm vi lập kế hoạch.

## 3. Nguyên tắc nghiệp vụ

1. Có căn cứ hợp lý mới trả con số; thiếu căn cứ trả “Shop sẽ báo trước thanh toán”.
2. Không dùng 0đ để biểu diễn chưa biết phí. 0đ chỉ khi nhận tại cửa hàng hoặc chính sách miễn ship hợp lệ.
3. API hãng trả giá dựa trên cân nặng đoán vẫn là phí tạm. Nguồn giá và chất lượng dữ liệu kiện là hai khái niệm riêng.
4. Mẫu cân nặng/kích thước quản lý bằng cấu hình backend hiện có, không tạo admin mới. Thay đổi mẫu qua quy trình cấu hình được kiểm soát.
5. Không tự mặc định mọi sản phẩm không nhận diện được là hàng nhỏ 500g để báo phí có vẻ chính xác.
6. Phí chính thức và phí khách phải trả chỉ chốt qua quy trình báo giá/xác nhận hiện hữu. Không sinh QR hoặc COD từ tổng tạm.
7. Khách đổi giỏ/địa chỉ/phương thức nhận phải tính lại. Đơn đã chốt giữ lịch sử phí cũ, mọi điều chỉnh đi qua xác nhận phù hợp.

## 4. Luồng từ đầu đến cuối

1. Khách chọn hàng và số lượng.
2. Chọn nhận tại cửa hàng: phí khách trả 0đ, không gọi báo giá giao hàng.
3. Chọn giao tận nơi: nhập đủ địa chỉ cần thiết cho hãng; thiếu thì nhắc bổ sung.
4. Backend đọc giá và metadata vận chuyển từ catalog, xác định nguồn cân nặng và kích thước.
5. Nếu có mẫu phù hợp, dựng kiện dự kiến và hỏi các hãng đủ điều kiện. Nếu không, chuyển chờ báo phí.
6. Shop hiển thị phí và tổng tạm tính hoặc tổng tiền hàng chưa gồm ship. Khách gửi yêu cầu đặt hàng/chờ xác nhận.
7. Shop xác nhận hàng/ảnh và phí bằng quy trình đang có. Không thêm màn hình quản trị mới trong kế hoạch này.
8. Khách thấy báo giá cuối, nếu khác báo giá trước thì thấy phần thay đổi; xác nhận trước thanh toán/cọc.
9. Thanh toán/thu hộ sử dụng giá trị cuối từ luồng hiện tại. Lưu phí dự kiến riêng để so sánh, không ghi đè chứng từ cũ.

**Điểm bắt buộc kiểm chứng trước triển khai:** luồng hiện hữu có thực sự lưu được phí cuối và lấy đúng giá trị đó cho QR/COD/cọc hay không. Nếu chưa có, bản đầu chỉ cho xem ước tính và gửi yêu cầu; tiếp tục xác nhận thủ công theo vận hành hiện tại, không mở thanh toán online từ phí tạm. Không ngầm mở rộng thành dự án admin để giải quyết điểm này.

## 5. Cách ước tính khi thiếu trọng lượng

### 5.1. Thứ tự dữ liệu đề xuất

| Mức | Nguồn | Cách sử dụng |
|---|---|---|
| 1 | Trọng lượng có đơn vị rõ, kích thước/quy cách sản phẩm tin cậy | Tính kiện dự kiến theo số lượng |
| 2 | Mẫu đã kiểm chứng cho nhóm/biến thể tương đồng | Dùng làm ước tính, lưu nguồn preset |
| 3 | Mã/tên chứa 500G, 2KG… | Chỉ là gợi ý nếu chưa xác minh đơn vị bán và bao bì; không đồng nhất cân nặng sản phẩm với kiện |
| 4 | Không nhận diện được hoặc dữ liệu mâu thuẫn | Chờ shop báo phí |

Giá trị mặc định chung từ env không được tự ghi đè nhóm hàng đã biết và trở thành dữ liệu thật. Khi triển khai cần điều chỉnh thứ tự fallback hiện có theo quy tắc trên.

Chuẩn nội bộ: gram và cm, có nguồn/đơn vị gốc. Không suy rằng mọi số dưới 50 là kg; ví dụ 30g và 30kg phải phân biệt được. Sản phẩm bán theo thùng/bộ phải dùng trọng lượng của đúng đơn vị bán, không nhân số chiếc trong thùng hai lần.

### 5.2. Bao bì, kích thước và số lượng

- Nếu mẫu mô tả kiện đã đóng, không cộng thêm cùng bao bì lần nữa.
- Nếu trọng lượng là hàng chưa đóng, cộng bao bì theo mẫu đã kiểm chứng; thiếu mẫu bao bì thì không hứa độ chính xác cao.
- Không cộng hoặc lấy kích thước lớn nhất của các món rồi khẳng định tất cả vừa một kiện. Bộ gộp hiện tại chỉ là ước lượng, cần giới hạn áp dụng cho mẫu đóng chung đã kiểm chứng.
- Bản đầu chỉ báo số cho giỏ có quy tắc kiện đáng tin. Hàng lớn/dễ vỡ, nhiều kiện chưa xác định hoặc vượt giới hạn dịch vụ chuyển sang chờ báo phí.
- Khi đã có quy tắc nhiều kiện được kiểm chứng, tính theo từng kiện và tổng cước; không tự giả định hãng nào cũng nhận cùng loại cây/chậu.
- Hệ số quy đổi, giới hạn và phụ phí theo hãng/dịch vụ thực tế. Không hardcode một hệ số cho mọi hãng.

## 6. Báo giá API, dự phòng và miễn ship

Ưu tiên báo giá API cho kiện và địa chỉ hợp lệ. Chỉ hiển thị lựa chọn hãng/dịch vụ thực sự có cơ sở phục vụ; API lỗi không chứng minh hãng vẫn giao được tuyến đó.

Fallback bằng công thức nội bộ chỉ bật nếu shop đã kiểm chứng phạm vi và cấu hình. Không dùng các giá trị base/perKg hiện tại như bảng giá chính thức của hãng. Không đủ căn cứ dự phòng thì trả trạng thái chờ báo phí, có nút thử lại cho lỗi tạm thời.

Không xếp một giá đoán rẻ nhất lên trên rồi gắn nhãn “Rẻ nhất” như so sánh báo giá chính thức. Có thể ưu tiên nguồn API hợp lệ; mọi giá dự kiến vẫn ghi “Tạm tính”. Thời gian giao là dự kiến, không cam kết từ một công thức mặc định.

Miễn ship: kiểm tra lại điều kiện hiện có, ngưỡng, hàng và phạm vi. Phí khách trả 0 không đồng nghĩa hãng không thu tiền. Nếu giỏ chưa xác định được cách vận chuyển, không tự hứa miễn ship chỉ vì đạt giá trị đơn. Phần ưu đãi ở KE_HOACH_UU_DAI_VOUCHER.md vẫn quản lý giảm tiền hàng riêng; ship không làm tăng cơ sở hoa hồng CTV.

## 7. UI/UX phía shop

### 7.1. Các trạng thái

| Trạng thái | Nội dung khách thấy | Có thể gửi đơn? |
|---|---|---|
| Thiếu địa chỉ | “Chọn địa chỉ để xem phí vận chuyển tạm tính” | Chỉ sau khi đủ thông tin bắt buộc của đơn |
| Đang tính | “Đang tính phí vận chuyển…” | Chờ tính hoặc chủ động chọn chờ shop báo phí nếu quy trình hỗ trợ |
| Có ước tính | “Phí vận chuyển tạm tính: …đ” | Có, ở luồng chờ xác nhận |
| Chưa ước tính được | “Shop sẽ báo phí trước thanh toán” | Có nếu là yêu cầu chờ xác nhận và địa chỉ hợp lệ |
| Lỗi dịch vụ | “Chưa lấy được phí vận chuyển. Thử lại hoặc chờ Aloha báo phí” | Chỉ qua luồng chờ xác nhận; không chuyển lỗi thành miễn phí |
| Nhận tại cửa hàng | “Nhận tại cửa hàng — 0đ” | Theo quy trình hiện tại |
| Đã chốt | “Phí vận chuyển: …đ”, thời điểm và tổng đã xác nhận | Thanh toán theo luồng hiện hữu |

### 7.2. Ví dụ minh họa

Có phí tạm:

| Khoản | Số tiền |
|---|---:|
| Tiền hàng sau ưu đãi | 900.000đ |
| Phí vận chuyển tạm tính | 45.000đ |
| Tổng tạm tính | 945.000đ |

Ghi chú: “Aloha sẽ xác nhận phí vận chuyển cùng hình ảnh đơn hàng trước khi bạn thanh toán.”

Chưa biết phí: dòng ship là “Chờ xác nhận”; dòng tổng ghi **“Tiền hàng chưa gồm phí vận chuyển: 900.000đ”**, không ghi “Tổng thanh toán 900.000đ”. Các con số chỉ là ví dụ.

### 7.3. Tái sử dụng và responsive

- Giữ CheckoutShippingSection, ShippingCarrierOption, CheckoutSummaryAside và CheckoutStickyBar; không tạo thẻ vận chuyển trùng.
- Giỏ chưa có địa chỉ chỉ nhắc tính ở bước xác nhận; không tự mở rộng quản lý địa chỉ trong đợt này.
- Chi tiết đơn cho thấy mức dự kiến đã lưu và mức cuối khi luồng hiện tại cung cấp; khác nhau thì nêu phần chênh lệch.
- Desktop/mobile dùng cùng một dữ liệu báo giá và nhãn. Số cân ước tính là thông tin phụ; khách không cần hiểu kỹ thuật tính kiện.
- Kiểm tra 320/360/390/768/1024/1440px, bàn phím, zoom 200%; không che tổng/nút đặt hàng. Thông báo lỗi bằng chữ, không chỉ màu.
- Chỉ phản hồi báo giá của giỏ/địa chỉ mới nhất được hiển thị; tránh giá cũ về trễ ghi đè giá mới.

## 8. Hợp đồng dữ liệu đề xuất

Tên trường dự kiến, cần thích nghi model hiện tại khi triển khai:

| Dữ liệu | Ý nghĩa |
|---|---|
| shippingEstimateStatus | missing_address / loading phía UI / estimated / needs_confirmation / unavailable |
| estimatedShippingFee | Số nguyên VND hoặc null khi chưa biết; 0 không dùng để thay null |
| pricingSource | carrier_api / internal_estimate / shop_policy |
| packageDataSource | measured / verified_preset / inferred / unknown; xét cả cân và kích thước |
| estimateReason | Mã lý do để UI giải thích, không lộ lỗi/token nguồn |
| estimatedAt, expiresAt | Tuổi báo giá; quá hạn phải xem lại |
| package/config revision | Nhận diện thay đổi mẫu/quy cách/chính sách |
| quoteToken | Chữ ký kiểm tra báo giá, không phải chứng nhận cước cuối |
| confirmedShippingFee | Chỉ lấy từ nguồn xác nhận hiện hữu đã được kiểm chứng |

Snapshot dự kiến lưu riêng khỏi phí cuối đang dùng để thanh toán. Token phải ràng buộc giỏ, địa chỉ, phương thức nhận, hãng/dịch vụ và chính sách liên quan; backend kiểm tra lại giá/ngưỡng miễn ship, revision và TTL khi tạo đơn. Client không được tự gửi cân nặng thấp, phí 0 hoặc trạng thái confirmed để được thu thiếu.

Đơn cũ không có trường mới tiếp tục hiển thị theo dữ liệu đã chốt, không tự đổi phí thành tạm hoặc tính lại bằng mẫu mới.

## 9. Công nghệ và điểm sửa dự kiến

Giữ Next.js/React/TypeScript, Tailwind/token Aloha; tiện ích formatVnd và fetch/state hiện tại. Dùng React Query nếu phù hợp provider của luồng đang có; không tạo cache song song không cần thiết. Backend Express, validation Zod theo mẫu dự án, MongoDB cho snapshot. Không thêm package chỉ để tính ước lượng.

| Khu vực | Việc cần làm |
|---|---|
| resolveWeight, sizePresets, categorySizeMap | Theo dõi nguồn và độ đầy đủ; giới hạn fallback; giữ đơn vị rõ |
| quoteInput, quoteService, carrierTypes | Phân biệt dữ liệu kiện ước tính và nguồn giá; trả chờ xác nhận khi thiếu căn cứ |
| quoteToken | Bổ sung ngữ nghĩa/revision nếu cần; kiểm tra token cũ và tương thích |
| frontend/lib/shipping và trạng thái checkout | Kiểu dữ liệu phí nullable, lý do, xử lý response cũ |
| Giỏ/xác nhận/chi tiết đơn shop | Hiển thị các trạng thái mục 7, dùng lại UI |
| orderCreateRoutes và đường xác nhận/QR/COD | Lưu estimate riêng; kiểm tra không thu theo giá chưa chốt |

Không sửa UI admin; không chạm VPS, cấu hình production hay triển khai trong lượt lập kế hoạch.

## 10. Trình tự triển khai

1. Khảo sát đường chạy thật: cờ frontend/backend, quote có được gọi không, review-first/cọc/QR/COD đang lấy tổng ở đâu; kiểm tra điểm xác nhận phí hiện có.
2. Xác minh mẫu cho nhóm bán chạy và giới hạn sử dụng. Nếu chưa có dữ liệu mẫu thì triển khai nhánh chờ báo phí trước, không bịa cân nặng.
3. Chuẩn hóa trạng thái/nguồn dữ liệu, thêm snapshot estimate và hợp đồng quote mà không thay phí cuối của đơn cũ.
4. Nối UI shop và xử lý đổi giỏ/địa chỉ/hết hạn. Giữ nguyên giao diện admin.
5. Kiểm thử phép tính, request giả, trạng thái thanh toán và responsive; thử API bằng môi trường được phép.
6. Bật thử có kiểm soát; so estimate với phí cuối của các đơn thử rồi hiệu chỉnh mẫu qua cấu hình. Tắt tính năng chỉ ẩn/ngừng ước tính mới, không làm mất dữ liệu đơn cũ.

## 11. Checklist kiểm thử nghiệm thu

Mỗi ca lưu dữ liệu trước/sau, response, ảnh UI và ID đơn nếu tạo. Hiện tất cả Chưa chạy.

| Mã | Dữ liệu và thao tác | Kết quả mong đợi |
|---|---|---|
| SH01 | Hàng có cân/đơn vị/kích thước hợp lệ, địa chỉ đúng; báo giá | Payload đúng gram/cm; hiển thị phí tạm, không tự chốt |
| SH02 | Thiếu cân, có preset đã kiểm chứng; thêm hàng | Dùng preset, nguồn rõ, không ghi thành số đo thật |
| SH03 | Thiếu cả cân và mẫu phù hợp | Ship chờ xác nhận, không 0đ; không gọi hãng bằng cân 500g tùy tiện |
| SH04 | Cân 30g và 30kg ở hai sản phẩm | Chuẩn thành 30 và 30.000 gram, không suy theo cùng giá trị 30 |
| SH05 | Bán theo thùng, tăng từ 1 lên 2 thùng | Cân theo thùng, không nhân số chiếc hai lần |
| SH06 | Mẫu bao gồm bao bì rồi báo giá | Không cộng bao bì lần nữa |
| SH07 | Cây lớn/hàng dễ vỡ/multi-package chưa có quy tắc | Chờ shop báo phí, không ép vào một kiện nhỏ |
| SH08 | Hãng lỗi, fallback đã cấu hình phù hợp | Hiển thị estimate nội bộ có nhãn, không gọi là giá chính thức |
| SH09 | Hãng lỗi, không fallback phù hợp | Thử lại/chờ xác nhận; gửi đơn chỉ ở luồng review-first |
| SH10 | Đổi địa chỉ A→B, response A về muộn | Chỉ báo giá B được sử dụng |
| SH11 | Đổi số lượng sau quote, gửi token cũ | Tính lại hoặc từ chối token cũ; không nhận estimate của giỏ khác |
| SH12 | Token hết hạn hoặc cấu hình mẫu thay đổi | Yêu cầu quote mới, không silently dùng giá cũ |
| SH13 | Client sửa cân/phí/source/confirmed | Server bỏ dữ liệu không tin cậy hoặc từ chối; không thu thiếu |
| SH14 | Đổi giao tận nơi→nhận cửa hàng→giao tận nơi | Nhận cửa hàng 0đ; giao lại phải lấy estimate phù hợp |
| SH15 | Có chính sách miễn ship hợp lệ, sau đó giỏ mất điều kiện | 0đ đúng chính sách rồi cập nhật lại; không giữ miễn ship sai |
| SH16 | Đơn có hàng sau giảm 900.000đ, estimate 45.000đ | Tổng tạm 945.000đ đồng nhất desktop/mobile/chi tiết đơn |
| SH17 | Cùng đơn SH16 nhưng chưa biết ship | Hiện tiền hàng chưa gồm ship 900.000đ; không ghi tổng cuối |
| SH18 | Luồng hiện tại xác nhận ship cuối 52.000đ | Khách thấy chênh +7.000đ và tổng 952.000đ, xác nhận trước thu |
| SH19 | Chỉ có estimate, gọi trực tiếp đường tạo QR/COD | Không tạo số tiền phải thu dựa trên estimate chưa chốt |
| SH20 | Cọc khi ship chưa chốt | Chỉ dùng chính sách cọc đã có và được xác nhận; không tự lấy tổng tạm làm căn cứ mới |
| SH21 | Đơn đã chốt/đã trả rồi mẫu ship đổi | Tiền chốt không bị thay; phí dự kiến cũ còn truy vết |
| SH22 | Đơn cũ không có metadata estimate | Hiển thị phí đã lưu đúng, không tự tính lại |
| SH23 | Bật tính năng trên mobile nhỏ, mạng chậm | Không tràn/che nút; loading/lỗi đúng; không submit giá cũ |
| SH24 | Khách qua CTV, estimate tăng/giảm | Hoa hồng chỉ tính cơ sở tiền hàng theo chính sách, không cộng ship |
| SH25 | Hai lần bấm gửi đơn/retry | Cùng cơ chế idempotency hiện có, không tạo hai đơn/thu hai lần |
| SH26 | Tắt tính năng khi có đơn chờ và đơn đã chốt | Không mất snapshot, không làm đổi tiền đã xác nhận |

Điều kiện nghiệm thu: không biến phí chưa biết thành 0đ; không thu theo estimate chưa được chấp thuận; không sửa admin; không hồi quy đơn/QR/COD/cọc; typecheck và test theo công cụ có sẵn đạt. Kiểm thử API/mock không thay xác nhận khả năng hãng nhận loại hàng thực tế.

## 12. Các điểm cần chốt trước chạy thật

- Nhóm mẫu nào đã được cân/đo kiểm chứng? Mặc định chung hiện tại chưa phải bằng chứng.
- Chính sách đơn vị cân từ từng nguồn dữ liệu và quy cách bán thùng/bộ.
- Có cho fallback nội bộ không, áp dụng vùng/loại hàng nào? Nếu chưa chốt thì chờ báo phí.
- Điểm hiện hữu lưu/duyệt phí cuối nằm ở đâu? Nếu không đủ, bản đầu chỉ là xem estimate và gửi yêu cầu.
- Phí cọc dựa trên tiền hàng hay tổng nào: giữ quy trình đã duyệt, không tự suy từ estimate.
- Mức chênh do shop ước tính sai sau khi đã thu: đề xuất shop chịu, khách thay đổi yêu cầu phải xác nhận lại.

## 13. Tham khảo từ lần nghiên cứu trước

- [Shopify — Shipping rates](https://help.shopify.com/manual/shipping/rates-and-methods/manual-rates): có mô hình phí cố định và phí hãng tính.
- [Tiki — Đo kích thước và khối lượng](https://hocvien.tiki.vn/faq/huong-dan-cap-nhat-thong-tin-kich-thuoc-va-khoi-luong-san-pham/): dữ liệu vận chuyển cần cân/đo phù hợp quy cách đóng gói.
- [Shopee — Chính sách vận chuyển](https://help.shopee.vn/portal/4/article/77250): kiểm tra giới hạn kiện và cách xác định khối lượng tính cước.

Các nguồn đã tham khảo trong trao đổi trước; không coi mức mẫu trong code là quy định của hãng. Khi thực thi cần đối chiếu hợp đồng dịch vụ thực tế. Tài liệu này độc lập với kế hoạch ưu đãi; áp dụng chung nguyên tắc snapshot, tổng tiền và xác nhận khách trong KE_HOACH_UU_DAI_VOUCHER.md.

## 14. Kết luận rà soát và khoảng trống hiện tại

Kế hoạch có nền tảng phù hợp: phân biệt phí tạm/phí chốt, server quyết định tiền, khách xác nhận trước thu, không tự coi phí chưa biết là miễn phí. Tuy nhiên, chưa đủ điều kiện kết luận “đạt chuẩn vận hành công ty” hoặc bảo đảm đồng bộ đúng. Cần hoàn thành các hợp đồng tiền, đối soát và ca kiểm thử dưới đây. Không có một tiêu chuẩn duy nhất áp dụng cho mọi công ty.

Source được đọc lại ngày 29/09/2026, đã thay đổi so với lần khảo sát đầu:

| Điểm kiểm tra | Bằng chứng source | Đánh giá |
|---|---|---|
| Tạo đơn có ưu đãi | orderCreateRoutes.ts gọi evaluatePromotions, ghi lineDiscounts vào dòng, tính subtotal - discount + shippingFee | Đã có phép tính; không đồng nghĩa các đường sửa/chốt/hoàn đều đúng |
| Phân bổ | shopPromotions/evaluator.ts phân bổ theo dòng và xử lý phần dư; map theo mã sản phẩm | Cần kiểm tra nhiều dòng cùng mã, biến thể, số lượng > 1; tổng phân bổ phải đúng |
| Hoa hồng | commission.ts tính max(0, price × qty - discount) | Phù hợp nếu discount là giảm toàn dòng và đã gồm đủ ưu đãi tiền hàng |
| Gửi KiotViet | kvPush.ts chuyển trực tiếp discount của dòng sang API | Chưa chứng minh đơn vị giảm của hai hệ thống giống nhau khi quantity > 1 |
| Phí ship đơn đặt hàng KV | Có thể gửi cả dòng dịch vụ ship và orderDelivery.price; thiếu mã dịch vụ thì chỉ có thông tin giao hàng | Cần xác minh trường nào ảnh hưởng tổng khách trả, tránh cộng hai lần hoặc mất phí |
| Phí ship hóa đơn KV | Có nhánh dòng dịch vụ, phụ phí hoặc invoiceDelivery | Mỗi nhánh cần kiểm thử riêng; ghi chú chứa phí không chứng minh tổng đã cộng phí |
| Đồng bộ ngược | kvOrderMoneySync.ts tính tổng dòng sau discount + shippingFee; đọc orderDelivery và nhận diện dòng ship | Chưa thấy xử lý giảm cấp đơn trong phép tính này; có nguy cơ lệch khi KV sửa giảm toàn đơn. Nhận diện ship phải ổn định bằng ID/mã, không dựa riêng tên |
| Tiền đã thu | Một số đường truyền totalPayment từ tổng đơn; nhánh hóa đơn chờ chuyển khoản đặt 0 | Phải kiểm toán từng caller COD/cọc/CK; tổng đơn không mặc nhiên là tiền đã thu |
| Quote không bắt buộc | orderCreateRoutes.ts có nhánh đặt shippingFee = 0 | Khi triển khai kế hoạch phải phân biệt pending với miễn ship; chưa xác minh cờ production |

Không sửa code trong lượt rà soát này. Không tạo đơn thật, không gọi API ghi KiotViet, chưa chạy E2E.

## 15. Hợp đồng tính tiền xuyên suốt shop và CTV

### 15.1. Tách các khoản tiền

Đề xuất áp dụng cho giá bán đã thống nhất cách bao gồm thuế. Nếu gian hàng có thuế/phụ phí riêng, phải lập mapping riêng và kiểm thử trước khi bật; không tự bỏ thuế hoặc cộng lại thuế đã nằm trong giá.

- G: tổng tiền hàng trước ưu đãi, không gồm ship.
- D: tổng ưu đãi tiền hàng được phép áp dụng, gồm giảm sản phẩm và giảm cấp đơn, không đếm trùng.
- N = G - D: tiền hàng sau ưu đãi, không âm.
- F: phí vận chuyển trước hỗ trợ theo báo giá khách đã chấp thuận; không nhất thiết bằng chi phí hãng cuối cùng.
- H: hỗ trợ/ưu đãi vận chuyển thực dùng, giới hạn 0 ≤ H ≤ F.
- S = F - H: phí vận chuyển khách trả.
- T = N + S: tổng giá trị đơn khách phải trả trước khi trừ khoản đã thanh toán.
- P: các khoản thanh toán/cọc hợp lệ đã đối soát và phân bổ vào đơn.
- R = max(0, T - P): còn phải thu; tiền trả thừa ghi riêng, không tăng doanh thu/hoa hồng.

Ưu đãi 10% tiền hàng không tự giảm phí ship 10%. Mã giảm ship chỉ giảm F; phần vượt F không chuyển sang giảm tiền hàng hay trả tiền mặt. Chi phí hãng thu thực tế lưu riêng để shop đối soát lợi nhuận.

Khi ship chưa xác nhận, F/H/S/T chỉ là dự kiến hoặc chưa xác định. Giữ nhãn tạm; không tạo nghĩa vụ QR/COD từ T tạm. Trường hợp cọc áp dụng đúng chính sách đã duyệt ở mục 4 và 12.

Voucher KiotViet thuộc phương tiện thanh toán phải nằm ở P khi đã xác nhận sử dụng thành công; không ghi thêm vào D. Voucher giảm giá của shop nằm ở D hoặc H tùy loại. Không giảm hai lần vì cùng được gọi là “voucher”.

### 15.2. Ngưỡng và kết hợp ưu đãi

- Bản đầu giữ tối đa một ưu đãi cấp đơn theo kế hoạch ưu đãi; chọn lợi ích thực tế sau trần giảm, không tự cộng hai lần 10%.
- Ưu đãi tiền hàng và chính sách ship chỉ kết hợp khi chính sách cho phép.
- Ngưỡng ưu đãi tiền hàng: đề xuất sau giảm riêng sản phẩm, trước giảm cấp đơn, không gồm ship.
- Ngưỡng miễn/hỗ trợ ship: đề xuất dùng N (tiền hàng sau tất cả ưu đãi tiền hàng), không gồm ship. Đây là lựa chọn kinh doanh cần chốt, không phải quy định chung của các sàn.
- Nếu chính sách hiện hữu dùng ngưỡng trước giảm, phải giữ đúng phiên bản đã công bố hoặc chuyển đổi có kiểm soát; không âm thầm đổi đơn đã chốt.
- UI phải ghi rõ “từ” hay “trên”, cơ sở xét ngưỡng và trần hỗ trợ. Ví dụ ngưỡng miễn ship từ 2 triệu sau ưu đãi: G=2.100.000đ, D=210.000đ, N=1.890.000đ thì chưa đạt.
- Tính tuần tự tiền hàng → ưu đãi hàng → điều kiện ship → hỗ trợ ship → tổng đơn. Không lặp xét ngưỡng bằng tổng đã cộng/trừ ship.

### 15.3. Cơ sở hoa hồng CTV

Hoa hồng = tổng của (giá trị từng dòng sau tất cả giảm tiền hàng được phân bổ × tỷ lệ CTV của dòng), chỉ trên dòng có quyền giới thiệu hợp lệ. Snapshot quyền CTV, tỷ lệ và phiên bản chính sách tại thời điểm chốt.

**Loại ship ra khỏi cơ sở hoa hồng; không trừ chi phí ship thêm lần nữa khỏi tiền hàng.** Theo chính sách đề xuất, shop chịu chi phí hỗ trợ ship; không tự khấu trừ phần shop chịu vào thu nhập CTV. Nếu muốn CTV chia sẻ chi phí, đó là chính sách khác cần công bố trước và không áp dụng hồi tố.

Không dùng một tỷ lệ chung nhân tổng khách chuyển nếu giỏ có nhiều CTV, nhiều tỷ lệ hoặc hàng không hưởng hoa hồng. Cọc, phiếu thanh toán, trả thừa và phí dịch vụ không tự tăng/giảm cơ sở tiền hàng. Hoa hồng tạm tính không đồng nghĩa được rút; chỉ đủ điều kiện theo trạng thái giao/thu tiền và thời gian giữ trong kế hoạch CTV.

Ví dụ chưa có thuế/phụ phí riêng, mọi dòng hưởng CTV 5%:

| Khoản | Giá trị |
|---|---:|
| G: tiền hàng | 2.500.000đ |
| D: ưu đãi hàng 10% | 250.000đ |
| N: hàng sau giảm | 2.250.000đ |
| F: phí ship trước hỗ trợ | 50.000đ |
| H: hỗ trợ ship | 20.000đ |
| S: khách trả ship | 30.000đ |
| T: tổng đơn | 2.280.000đ |
| P: đã cọc và đối soát | 100.000đ |
| R: còn thu | 2.180.000đ |
| Hoa hồng dự kiến 5% × N | 112.500đ |

Miễn ship toàn bộ thì T=2.250.000đ, hoa hồng vẫn 112.500đ. Không tính 5% của 2.280.000đ; cũng không tính 5% của 2.250.000đ trừ thêm 50.000đ hoặc 20.000đ.

Phân bổ giảm theo giá trị dòng đủ điều kiện, số nguyên VND, quy tắc phần dư ổn định; tổng phân bổ bằng D. Hoàn một phần dựa trên snapshot dòng, không dùng ưu đãi hôm nay. Khóa định danh dòng rõ ràng để hai dòng cùng mã không ghi đè phần giảm của nhau.

## 16. Hợp đồng đồng bộ KiotViet và đối soát

[Tài liệu Public API KiotViet](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ket-noi-api/public-api/) phân biệt total (khách cần trả) và totalPayment (khách đã trả), đồng thời có giảm cấp đơn, giảm sản phẩm và dữ liệu giao hàng. Đã đối chiếu ngày 29/09/2026. Tên trường không đủ để suy ra cách cộng phí vào chứng từ; phải kiểm chứng response và chứng từ thực tế trong môi trường được phép.

Yêu cầu triển khai:

1. Dùng snapshot đã xác nhận để dựng payload. Đơn tạm gửi sang hệ thống khác, nếu luồng hiện hữu yêu cầu, phải giữ trạng thái chờ và không ghi nhận đã thu/chốt phí.
2. Chọn đúng một cách biểu diễn ưu đãi: giảm cấp đơn HOẶC giảm phân bổ xuống dòng. Nếu gửi giảm cấp đơn thì phân bổ nội bộ vẫn phục vụ CTV/hoàn, không gửi thêm cùng phần giảm xuống dòng KV.
3. Xác minh discount là theo đơn vị hay toàn dòng cho cả chiều gửi/nhận. Bắt buộc thử quantity=1, 2, 3 và phần giảm không chia hết cho số lượng. Không lấy số toàn dòng truyền thẳng nếu API hiểu theo đơn vị.
4. Số tiền ship cộng vào tổng chứng từ chỉ là S, đúng một lần. Nếu trường giao vận mang nghĩa chi phí hãng thì ánh xạ chi phí riêng; không dùng trường đó như tiền khách trả khi chưa xác minh. Không giả lập sản phẩm ship vào doanh thu tính hoa hồng.
5. Thiếu cấu hình biểu diễn ship hợp lệ thì ghi trạng thái cần xử lý, không báo đồng bộ thành công chỉ vì API trả ID. Phí ghi trong mô tả không thay thế khoản tiền trên chứng từ.
6. totalPayment/payments phản ánh tiền đã thực nhận hoặc phương tiện thanh toán đã xác nhận theo hợp đồng API. Đơn COD chưa thu không ghi đã trả đủ; cọc 100.000đ không ghi đã thu toàn bộ T.
7. Sau khi gửi, đọc lại đơn/hóa đơn, chuẩn hóa và đối chiếu N, S, T, tiền đã thu, còn thu, dòng hàng và phần giảm. Phải phân biệt phí hãng/thu hộ với phí khách trả. Mặc định yêu cầu khớp từng đồng; khác do quy tắc thuế/làm tròn phải được giải thích và kiểm thử, không bỏ qua bằng ngưỡng tùy tiện.
8. API nhận đơn nhưng response timeout: tra theo mã tham chiếu ổn định trước retry. Không tạo đơn, hóa đơn, khoản thu, lượt ưu đãi hoặc hoa hồng trùng.
9. Đồng bộ ngược phải hiểu cả giảm dòng và giảm cấp đơn, không phân bổ lại hai lần. Chỉ nhận phiên bản mới hợp lệ; webhook cũ/trùng không ghi đè snapshot mới hoặc làm mất ưu đãi.
10. Đơn chưa chốt có thay đổi tiền: báo giá lại và khách xác nhận. Đơn đã thanh toán: dùng điều chỉnh/hoàn/bù có lịch sử; không tự ghi đè tiền rồi thu thêm hay giảm hoa hồng đã trả.

Điều kiện hoàn thành: cùng fixture cho kết quả khớp ở checkout → đơn shop → QR/COD/cọc → chứng từ KV đọc lại → đồng bộ ngược → cơ sở hoa hồng. API HTTP 200 hoặc có mã KV chưa đủ nghiệm thu.

## 17. Các ca kiểm thử liên kết shop – CTV – KiotViet

Tất cả ca dưới đây **Chưa chạy**. Fixture mặc định là ví dụ mục 15.3, quyền CTV hợp lệ, tỷ lệ 5%, không thuế/phụ phí riêng. Kiểm tra cả giao diện khách, trang đơn hiện hữu, trang chuyển đổi/hoa hồng CTV và đơn/hóa đơn KV. Ghi expected/actual, ID, phiên bản snapshot, payload/response đã che dữ liệu nhạy cảm. Không thêm UI quản lý ship admin trong phạm vi này.

| Mã | Thao tác / tình huống cụ thể | Kết quả mong đợi |
|---|---|---|
| LK01 | Đặt đơn fixture có giảm hàng và giảm ship | N=2.250.000; S=30.000; T=2.280.000; HH=112.500; các nơi khớp |
| LK02 | Tắt giảm ship của fixture trước chốt | S=50.000; T=2.300.000; HH vẫn 112.500 |
| LK03 | Hỗ trợ ship 70.000 khi F=50.000 | H thực dùng=50.000; S=0; T=2.250.000; không chuyển dư 20.000 sang hàng |
| LK04 | Chỉ dùng ưu đãi tiền hàng 10% | Không tự giảm F 10%; kết quả như LK02 |
| LK05 | Khách mới đồng thời đạt ưu đãi đơn lớn | Áp dụng đúng một ưu đãi cấp đơn tốt nhất theo chính sách bản đầu, không giảm 20% tự động |
| LK06 | Ngưỡng ship từ 2 triệu sau giảm; hàng 2,1 triệu giảm 10% | N=1.890.000, không miễn ship; đúng tại biên 1.999.999/2.000.000/2.000.001 |
| LK07 | Chỉ mới có estimate ship 50.000, bấm thanh toán/gọi API trực tiếp | Chặn thu theo estimate; CTV thấy dự kiến; KV không ghi nhận đã thu |
| LK08 | Chốt F từ 50.000 lên 60.000, hỗ trợ cố định 20.000 | S=40.000; T=2.290.000; HH=112.500; khách xác nhận chênh trước thu |
| LK09 | Chuyển nhận cửa hàng trước chốt | S=0, hỗ trợ ship thực dùng=0; T=N, HH không đổi |
| LK10 | Một dòng giá 500.000, qty=2, giảm toàn dòng 100.000, S=30.000 | N=900.000, T=930.000, HH=45.000; KV và chiều về đúng, không giảm 200.000 |
| LK11 | Ba sản phẩm chia khoản giảm 100.001đ; gửi/đọc lại KV | Tổng phân bổ đúng 100.001; không rơi phần dư hoặc trừ hai lần |
| LK12 | Hai dòng cùng mã có nguồn giới thiệu/thuộc tính khác theo model cho phép | Gộp có chủ đích hoặc định danh riêng; không ghi đè discount/CTV; tổng đúng |
| LK13 | X=600.000 CTV A5%, Y=400.000 CTV B8%; giảm100.000; ship30.000 | Phân bổ60.000/40.000; HH A27.000/B28.800; T930.000 |
| LK14 | LK13 nhưng Y không có CTV hợp lệ | Giảm vẫn phân bổ Y40.000; chỉ A hưởng27.000; không chuyển quyền Y sang A |
| LK15 | Fixture thanh toán bằng phiếu giá trị200.000 đã xác nhận, chưa trả tiền khác | T=2.280.000; còn thu2.080.000; HH112.500; không ghi thêm D200.000 |
| LK16 | Fixture cọc100.000 rồi COD phần còn lại | Ghi đã thu100.000, COD2.180.000; không thu lại tiền cọc; không ghi paid toàn đơn sớm |
| LK17 | Fixture COD chưa thu, sau đó giao thất bại kết thúc | Tiền đã thu0; không chi HH; phí đi/hoàn xử lý riêng theo chính sách |
| LK18 | Fixture khách chuyển thừa10.000 | Khoản dư ghi riêng để xử lý; T và HH không tăng |
| LK19 | Thiếu mã sản phẩm ship KV; thử từng nhánh phụ phí/giao vận hỗ trợ | Chỉ đạt nếu total đọc lại gồm đúng S một lần; không đạt thì đánh dấu cần xử lý |
| LK20 | Gửi đồng thời dòng ship và thông tin giao vận | Xác minh tổng không cộng ship hai lần, HH không chứa dòng dịch vụ |
| LK21 | KV sửa giảm toàn đơn trên đơn chưa chốt | Đọc đủ giảm cấp đơn, phân bổ đúng; báo giá lại; không xóa ưu đãi hoặc trừ kép |
| LK22 | Webhook cũ/trùng hoặc timeout sau API tạo đơn | Không lùi phiên bản, tạo trùng chứng từ/thu tiền/hoa hồng; có đối soát |
| LK23 | Hoàn X trong LK13 sau thành công; giả sử chính sách giữ phí ship | Hoàn tiền hàng X540.000; thu hồi HH A27.000; B28.800 giữ; ship hoàn theo chính sách riêng |
| LK24 | Hoàn riêng phí ship30.000 của LK13 | Không đổi HH hàng; hoàn ship không vượt số khách đã trả; chứng từ điều chỉnh khớp |
| LK25 | Hủy đơn trước giao nhưng đã cọc | Giải phóng/điều chỉnh ưu đãi đúng trạng thái; hoàn cọc theo chính sách; không chi HH |
| LK26 | Đơn đã thu, hãng báo chi phí cao hơn dự kiến | Giữ tiền khách đã chấp thuận; shop chịu chênh theo chính sách đề xuất; không tự trừ HH |
| LK27 | Đổi địa chỉ/giỏ/mã ưu đãi; quote cũ trả về trễ | Tính lại đúng snapshot mới; không giữ hỗ trợ ship cũ; khách xác nhận lại |
| LK28 | Sửa request D/H/S/CTV/rate từ trình duyệt | Server tính theo dữ liệu tin cậy, không cho tăng ưu đãi/HH hoặc giảm phí giả |
| LK29 | Ưu đãi làm tiền hàng về0, ship30.000 | HH=0; T=30.000; không giảm ship bằng phần giảm hàng dư |
| LK30 | Cấu hình thuế hoặc phụ phí riêng chưa có mapping kiểm thử | Không cho coi tích hợp đã nghiệm thu; bổ sung expected từng khoản trước bật |
| LK31 | Desktop/mobile/chi tiết đơn hiển thị fixture | Đều tách tiền hàng, giảm hàng, ship, hỗ trợ ship, tổng, đã trả, còn thu; HH chỉ hiện trong quyền CTV phù hợp |
| LK32 | CTV khác truy cập đơn của A; đơn không có referral; referral hết hạn | Không lộ dữ liệu/HH của A, không phát sinh quyền mới sai; snapshot quyền đã chốt không tự hết hiệu lực |

## 18. Điều kiện đưa vào sử dụng

- Chốt chính sách ngưỡng hỗ trợ ship, quyền kết hợp ưu đãi, thuế/phụ phí nếu có và bên chịu chi phí vận chuyển/hoàn. Mức tiền trong tài liệu là fixture, không phải cấu hình đã duyệt.
- Hoàn thành kiểm toán các đường tạo/chốt/sửa/thu/hoàn đơn, caller KiotViet và chiều đồng bộ về; không chỉ kiểm tra checkout.
- LK01–LK32, SH01–SH26 và KVUI01–KVUI10 ở mục 19 có bằng chứng chạy đạt, hoặc ghi rõ không áp dụng kèm lý do và giới hạn tính năng. Không bỏ qua ca tiền trọng yếu để bật thanh toán.
- Đọc lại chứng từ KiotViet trên môi trường được phép; đối chiếu cả total và tiền đã thu. Kiểm thử mock không thay thế kiểm chứng ngữ nghĩa API.
- Lỗi tiền hoặc đồng bộ phải truy vết được qua mã đơn và trạng thái hiện hữu; chưa đối soát thì không chi hoa hồng tự động.
- Giữ phạm vi UI shop. Tận dụng màn hình đơn và CTV hiện có để thể hiện số tiền/trạng thái cần thiết; không dựng trang quản lý phí ship admin. Nếu luồng hiện hữu không lưu được phí chốt, dùng phạm vi xem estimate/gửi yêu cầu như mục 4, không tự mở thanh toán.

Kết luận: tài liệu sau bổ sung là kế hoạch để triển khai và kiểm thử, không phải chứng nhận code hiện tại đã đáp ứng. Chỉ xác nhận số tiền và hoa hồng chạy đúng sau khi các đường liên kết có kết quả kiểm thử và đối soát thực tế.

## 19. Đưa tiền vào đúng “Giảm giá phiếu đặt” và “THU PHÍ SHIP” trên KiotViet

### 19.1. Mục tiêu và mức độ xác minh

Bổ sung theo ảnh đơn đặt hàng người dùng cung cấp: ưu đãi cấp đơn trên shop phải xuất hiện ở “Giảm giá phiếu đặt”; phí vận chuyển khách trả phải xuất hiện ở “THU PHÍ SHIP”. Tổng đúng và vị trí hiển thị đúng là hai điều kiện nghiệm thu riêng.

- Đã xác minh trong tài liệu Public API, mục 2.5.3: tạo đơn đặt hàng có trường `discount` cấp đơn. Đây là hướng ánh xạ cho giảm giá phiếu đặt; vẫn cần đọc lại chứng từ để nghiệm thu giao diện thực tế.
- “THU PHÍ SHIP” có vẻ là tên một khoản Thu khác được cấu hình trong gian hàng. Ảnh chưa chứng minh loại khoản thu, ID, kiểu tiền/phần trăm hoặc cách API nhận khoản thu này.
- Chưa xác minh trường ghi khoản thu đó trên API đơn đặt hàng. Không tự suy ra tên trường từ API hóa đơn. Source có `invoiceOrderSurcharges` ở nhánh hóa đơn không chứng minh API đặt hàng hỗ trợ cùng cấu trúc.
- Tham chiếu: [Public API KiotViet — mục 2.5 Đặt hàng và 2.10 Thu khác](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ket-noi-api/public-api/). Việc có API danh mục Thu khác không tự chứng minh có thể gắn khoản thu vào đơn đặt hàng qua API công khai.

Phần này cụ thể hóa lựa chọn ở mục 16 cho đơn đặt hàng mới. Không tự chuyển cách biểu diễn tiền trên chứng từ cũ đã chốt.

### 19.2. Quy tắc ánh xạ đề xuất

| Dữ liệu shop | Đích KiotViet | Quy tắc |
|---|---|---|
| Giảm cấp đơn đã chốt | `discount` cấp đơn / Giảm giá phiếu đặt | Gửi số tiền VND thực tế sau trần giảm; không yêu cầu KV chạy lại chương trình ưu đãi |
| Giảm riêng sản phẩm nếu có | Giảm trên sản phẩm | Chỉ chứa khoản giảm riêng đó, không chứa lại phần giảm cấp đơn đã phân bổ nội bộ |
| Phân bổ giảm cấp đơn theo dòng | Snapshot nội bộ shop | Phục vụ CTV/hoàn; không gửi lại như giảm dòng để tránh giảm hai lần |
| S = phí ship sau hỗ trợ | Khoản THU PHÍ SHIP đã xác định ID và hợp đồng API | Chỉ ghi số khách trả, không ghi chi phí hãng trước hỗ trợ |
| Chi phí hãng / phần shop hỗ trợ | Dữ liệu đối soát riêng | Không tự cộng thêm vào tổng khách trả hoặc trừ vào cơ sở hoa hồng |
| Tiền khách thực trả/cọc hợp lệ | Trường thanh toán phù hợp API | Không gán toàn bộ tổng đơn thành tiền đã trả khi COD chưa thu hoặc mới cọc |

Khi đã dùng khoản THU PHÍ SHIP để cộng S vào tổng, không thêm dòng sản phẩm dịch vụ ship để cộng cùng khoản lần nữa. Nếu vẫn cần dữ liệu giao vận, xác minh riêng ngữ nghĩa của `orderDelivery.price` để tránh cộng trùng hoặc nhầm chi phí hãng với phí khách trả.

Phí chưa chốt không được gửi thành khoản thu cuối. S=0 do miễn ship/nhận cửa hàng cần xác minh API cho phép bỏ khoản thu hay gửi 0; kết quả chứng từ phải không phát sinh phí.

### 19.3. Công việc cần làm khi triển khai

1. Đọc cấu hình khoản Thu khác và một đơn hiện hữu có THU PHÍ SHIP để xác định ID, trạng thái, phạm vi, cách tính và ý nghĩa của khoản thu. Không tạo khoản thu trùng chỉ vì tìm kiếm tên không thấy.
2. Xác minh khả năng thêm/cập nhật khoản thu trên API đặt hàng bằng tài liệu hoặc xác nhận của KiotViet; thử trên môi trường được phép. Không sử dụng endpoint nội bộ chưa được hỗ trợ như hợp đồng tích hợp chính thức.
3. Khi đã xác minh, lưu ánh xạ ID trong cấu hình backend theo gian hàng; không cần tạo trang quản lý phí ship admin. Không dùng tên hiển thị làm khóa duy nhất và không áp dụng ID của gian hàng khác.
4. Điều chỉnh `kvPush.ts` ở nhánh đặt hàng để gửi giảm cấp đơn, tách giảm thật của sản phẩm khỏi phần phân bổ; bổ sung khoản ship theo hợp đồng API đã xác minh.
5. Điều chỉnh `kvOrderMoneySync.ts` để đọc giảm cấp đơn và khoản ship tương ứng, giữ phân bổ CTV đúng. Đọc lại không làm mất giảm giá hoặc phân bổ thêm lần nữa.
6. Kiểm tra nhánh chuyển đặt hàng sang hóa đơn: ưu đãi, ship, tiền cọc chỉ chuyển đúng một lần; không mặc định cấu trúc hai API giống nhau.
7. Đối soát cả response, chi tiết đơn KV và shop trước khi ghi trạng thái đồng bộ hoàn tất. Lưu phiên bản cách ánh xạ để đơn cũ vẫn được đọc đúng.

Nếu API công khai không hỗ trợ ghi đúng khoản THU PHÍ SHIP, ghi rõ giới hạn và giữ bước xử lý khoản thu qua vận hành hiện hữu. Không báo đã hoàn thành yêu cầu này bằng cách giấu phí trong ghi chú hoặc tự chuyển thành sản phẩm ship. Phương án thay thế cần được thống nhất trước triển khai; chưa xác minh thì phần tích hợp này chưa đủ điều kiện nghiệm thu.

### 19.4. Ví dụ đối chiếu với ảnh

Fixture: tiền hàng 235.000đ; ưu đãi cấp đơn 10%=23.500đ; phí ship trước hỗ trợ 50.000đ; hỗ trợ 20.000đ; không thuế/phụ phí riêng.

| Mục hiển thị trên đơn KV | Kết quả mong đợi |
|---|---:|
| Tổng tiền hàng | 235.000đ |
| Giảm giá phiếu đặt | 23.500đ |
| THU PHÍ SHIP | 30.000đ |
| Tổng cộng | 241.500đ |

Nếu chưa thu tiền, tiền đã trả=0 và còn thu=241.500đ. Nếu cọc đã đối soát 50.000đ, còn thu=191.500đ. CTV 5% trên toàn bộ hàng đủ điều kiện hưởng 211.500 × 5%=10.575đ; ship và tiền cọc không đổi cơ sở này.

### 19.5. Test case bổ sung — chưa chạy

Mỗi ca cần lưu ảnh hai dòng trên KV, payload/response đã che dữ liệu nhạy cảm, kết quả đọc ngược và cơ sở hoa hồng. Dùng fixture mục 19.4 trừ khi nêu khác.

| Mã | Thao tác | Kết quả mong đợi |
|---|---|---|
| KVUI01 | Gửi đơn fixture và đọc lại | Giảm giá phiếu đặt23.500, THU PHÍ SHIP30.000, tổng241.500; HH10.575 |
| KVUI02 | Gửi giảm cấp đơn có phân bổ nội bộ | KV chỉ giảm23.500 một lần; phần phân bổ không bị gửi lại thành giảm dòng |
| KVUI03 | Hàng235.000, giảm riêng sản phẩm5.000, giảm cấp đơn23.000, ship30.000 | Tiền hàng sau mọi giảm207.000, tổng237.000; giảm phiếu23.000; HH5%=10.350 |
| KVUI04 | Áp dụng hỗ trợ ship50.000 trên phí50.000 | THU PHÍ SHIP0 hoặc không thu theo API; tổng211.500; HH10.575 |
| KVUI05 | Khoản thu bị tắt, ID sai hoặc khác gian hàng | Báo cần xử lý cấu hình; không báo đồng bộ hoàn tất, không tạo khoản thu/dòng hàng thay thế âm thầm |
| KVUI06 | Gửi khoản thu ship kèm thông tin giao vận | Tổng vẫn241.500; không cộng thêm30.000 lần hai |
| KVUI07 | Thử COD chưa thu và cọc50.000 | Tiền đã trả lần lượt0/50.000; còn thu241.500/191.500; không ghi trả đủ |
| KVUI08 | Đọc ngược rồi xử lý lại webhook cùng đơn | Giữ tổng241.500, HH10.575, không mất giảm cấp đơn hoặc nhân đôi phân bổ |
| KVUI09 | Chuyển đặt hàng sang hóa đơn sau cọc | Tổng/giảm/ship giữ đúng; tiền cọc ghi nhận một lần; không tạo thêm khoản thu ship |
| KVUI10 | Đọc đơn cũ dùng dòng ship và đơn mới dùng khoản thu; retry sau timeout | Mỗi phiên bản đọc đúng; không đổi chứng từ cũ, không tạo đơn hoặc khoản thu trùng |

Phạm vi lượt bổ sung: chỉ tài liệu; chưa xác minh live ID khoản THU PHÍ SHIP, chưa sửa code, chưa tạo/cập nhật đơn KiotViet.

## 20. Ví dụ nghiệm thu bắt buộc — đạt mới được xác nhận hoàn thành

Theo yêu cầu người dùng, ví dụ dưới đây là điều kiện hoàn thành chức năng. Không xác nhận hoàn thành chỉ vì code xong, typecheck đạt, API trả thành công hoặc KiotViet trả mã đơn. Phải chứng minh từng khoản tiền và vị trí hiển thị đúng trên cả shop và đơn đặt hàng KiotViet, sau đó đồng bộ về vẫn đúng.

### 20.1. Dữ liệu và kết quả bắt buộc

Tạo đơn kiểm thử trong môi trường được phép: một sản phẩm giá 235.000đ, số lượng 1; ưu đãi cấp đơn 10%, không chạm trần; phí ship đã được khách xác nhận 50.000đ; hỗ trợ ship 20.000đ. Không có giảm riêng sản phẩm, thuế/phụ phí riêng hoặc phiếu thanh toán. Toàn bộ sản phẩm thuộc CTV hợp lệ, tỷ lệ 5%.

| Khoản đối chiếu | Shop phải hiển thị/lưu | Đơn đặt hàng KiotViet phải hiển thị |
|---|---:|---|
| Tiền hàng trước giảm | 235.000đ | Tổng tiền hàng: 235.000đ |
| Ưu đãi cấp đơn | Giảm 23.500đ | Giảm giá phiếu đặt: 23.500đ |
| Ship trước hỗ trợ | 50.000đ | Không cộng thêm khoản này vào tổng khi đã thu ship sau hỗ trợ |
| Hỗ trợ ship | Giảm ship 20.000đ | Không gộp 20.000đ vào Giảm giá phiếu đặt; lưu đối soát riêng theo mục 19 |
| Ship khách trả | 30.000đ | THU PHÍ SHIP: 30.000đ |
| Tổng giá trị đơn | **241.500đ** | **Tổng cộng: 241.500đ** |

Tiền hàng sau ưu đãi = 235.000 - 23.500 = 211.500đ. Tổng đơn = 211.500 + 30.000 = 241.500đ. Không thêm sản phẩm dịch vụ ship để thay thế dòng THU PHÍ SHIP trong tiêu chí này.

### 20.2. Ba trạng thái thanh toán phải kiểm chứng

Chạy từng trạng thái bằng đơn thử độc lập hoặc các bước thanh toán hợp lệ có đối soát; không giả lập tiền đã thu trên đơn thật.

| Trạng thái | Tổng đơn Shop/KV | Tiền đã trả Shop/KV | Còn phải thu Shop/KV |
|---|---:|---:|---:|
| Chưa thanh toán / COD chưa thu | 241.500đ | 0đ | 241.500đ |
| Đã cọc và đối soát 50.000đ | 241.500đ | 50.000đ | 191.500đ |
| Đã thanh toán đủ và đối soát | 241.500đ | 241.500đ | 0đ |

Tiền còn thu dùng để tạo yêu cầu thanh toán/COD phù hợp trạng thái. Không thu lại tiền cọc; không dùng tổng đơn làm tiền đã trả khi chưa thu.

### 20.3. CTV và chiều đồng bộ ngược

- Cơ sở hoa hồng là 211.500đ; hoa hồng dự kiến = 211.500 × 5% = **10.575đ** ở cả ba trạng thái thanh toán. Quyền được chi vẫn theo điều kiện giao hàng/thu tiền/thời gian giữ; không tự cho rút vì đã có số dự kiến.
- Đọc lại đơn từ KV rồi chạy đồng bộ về: shop vẫn giữ tổng241.500đ, giảm hàng23.500đ, ship khách trả30.000đ và hoa hồng10.575đ; tiền đã trả/còn thu khớp từng trạng thái.
- Xử lý lại cùng webhook hoặc retry không tạo thêm đơn, khoản thu, phần giảm hoặc hoa hồng. Không ghi đè mất hỗ trợ ship đã lưu trong snapshot shop khi KV chỉ trả phí khách trả.
- Kiểm tra thêm số lượng > 1 theo LK10, làm tròn theo LK11, chuyển sang hóa đơn theo KVUI09 và các ca ở mục 18–19. Đạt ví dụ đơn giản này không thay thế những ca tiền trọng yếu còn lại.

### 20.4. Bằng chứng và quy tắc kết luận

Hồ sơ nghiệm thu phải có: mã đơn shop và KV tương ứng; snapshot tiền đã chốt; ảnh checkout/chi tiết đơn shop; ảnh đơn KV nhìn rõ Tổng tiền hàng, Giảm giá phiếu đặt, THU PHÍ SHIP, Tổng cộng và thanh toán; payload/response đã che thông tin nhạy cảm; kết quả đồng bộ ngược; bản ghi hoa hồng và kết quả thử retry.

**Chỉ đánh dấu hoàn thành khi tất cả kết quả bắt buộc trên đạt và các ca áp dụng ở mục 18–19 đã qua nghiệm thu.** Sai dù 1đ phải được xử lý và kiểm thử lại; fixture này không có ngoại lệ thuế hay làm tròn.

Nếu chưa xác minh API ghi THU PHÍ SHIP, tiền chỉ nằm trong ghi chú/dòng hàng khác, chưa đọc lại chứng từ hoặc chỉ chạy mock thì trạng thái là **chưa hoàn thành yêu cầu đồng bộ theo ảnh**. Việc nhập tay qua vận hành hiện hữu là phương án tạm, không được tính là hoàn thành tự động hóa. Không tự bỏ điều kiện này khi báo cáo kết quả.

Trạng thái hiện tại: **Chưa chạy nghiệm thu. Chưa xác nhận hoàn thành chức năng.** Mục này chỉ bổ sung yêu cầu vào kế hoạch, chưa sửa code hay ghi dữ liệu KiotViet.
