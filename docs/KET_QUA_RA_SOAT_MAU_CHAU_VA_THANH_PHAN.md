# Rà soát ảnh màu chậu và hàng thành phần

Ngày kiểm tra: 01/10/2026.

## Kết quả chính

- Có **2 ảnh ghi bảng màu chậu**, gắn với **3 mã: LYTSCV, XRMT20, TXRMT20**.
- Đã xem lớn 11 ảnh trọng điểm, liên quan 17 mã; màu nhìn thấy được ghi trong bảng dưới.
- 20 sản phẩm có hàng thành phần trực tiếp trỏ tới các mã có ảnh nhiều màu đã xem lớn. Đây là quan hệ công thức, chưa chứng minh khách được chọn màu.
- Danh sách rà rộng: 358 ảnh đại diện, liên quan 413 mã có dấu hiệu nhiều màu/mẫu. 276 mã có thành phần trực tiếp liên quan ảnh nghi vấn hoặc nhóm cùng tên có thuộc tính màu khác nhau. Các số này có giao nhau, không cộng lại.

## Phạm vi và cách kiểm tra

- Đọc 3066 sản phẩm hiện tại trong database local aloha_shop_db.aloha_products, không lọc riêng sản phẩm công khai. 786 mã có hangThanhPhan.
- Thu thập 5732 URL duy nhất từ anh và images: tái sử dụng 5721 ảnh đã tải trong lần rà trước; tải thêm 11 ảnh mới, tất cả thành công. Không tải lại nội dung URL cũ.
- Xem 5.723 ảnh cũ qua 48 bảng ảnh thu nhỏ và 11 ảnh mới; loại 2 URL cũ không còn trong danh mục hiện tại khi xuất kết quả. Dùng OCR đã có của 5.723 ảnh cũ để hỗ trợ tìm chữ.
- Mở lớn 11 ảnh trọng điểm. Danh sách rộng được đánh dấu **dấu hiệu qua ảnh tổng quan**, không đánh đồng với biến thể màu đã xác nhận. Chữ nhỏ, màu gần nhau và các màu chỉ có trong ảnh riêng vẫn có thể bị bỏ sót.
- Đọc toàn bộ hangThanhPhan và attributes; xuất cả quan hệ trực tiếp và đường dẫn thành phần lồng nhau. Có 86 mã có thuộc tính màu, 11 nhóm cùng tên có nhiều giá trị màu. Nhóm theo tên chỉ là dấu hiệu liên quan, không phải bằng chứng SKU thay thế được cho nhau.
- Không kiểm tra ảnh trong HTML mô tả, video hoặc nguồn ngoài anh/images. Chưa đối chiếu production hoặc tồn kho từng màu.

## Ảnh đã mở lớn và xác nhận nội dung màu

| Mã sản phẩm | Nội dung màu nhìn thấy | Bằng chứng | Ghi chú |
|---|---|---|---|
| LYTSCV | Đen, trắng, đỏ | [Ảnh 101](https://cdn2-retail-images.kiotviet.vn/2026/07/08/alohanguyen/4ec01968a0534e70a9309b06df32ef8f.jpg) | Ảnh ghi “Bản màu chậu”; mã in trên ảnh LYTS, mã dữ liệu LYTSCV. Thành phần CNTSV còn có xanh lá. |
| XRMT20, TXRMT20 | Cam, hồng, xanh lá, vàng | [Ảnh 4217](https://cdn2-retail-images.kiotviet.vn/2026/07/03/alohanguyen/f9d17536f2c4475f84f61e2dc5de459e.png) | Ảnh ghi “BẢNG MÀU CHẬU”; dùng chung cho XRMT20 và TXRMT20. |
| LHTT | Xám đậm/đen, trắng, hồng, cam nhạt | [Ảnh 139](https://cdn2-retail-images.kiotviet.vn/2026/07/06/alohanguyen/0b3bd5e421e14f969a73c06f813b4bc3.jpg) | Ảnh LHTT có 4 chậu khác màu. Chậu thành phần XT chỉ thấy trắng và xanh trong ảnh riêng. |
| DDNH | Trắng, hồng, xanh dương nhạt | [Ảnh 159](https://cdn2-retail-images.kiotviet.vn/2026/07/07/alohanguyen/a33336d6b9c140abadb6b3066b7b8fce.png) | DDNH dùng CXRBX; ảnh riêng CXRBX chỉ thể hiện trắng. Cần đối chiếu màu thực tế. |
| BLMTBL, TBLMTBL | Trắng, vàng, xanh dương nhạt; mép ảnh có hồng | [Ảnh 334](https://cdn2-retail-images.kiotviet.vn/2026/04/03/alohanguyen/0a4e3caad5054f3bbb9728a8ba451ca2.jpeg) | BLMTBL/TBLMTBL dùng chung ảnh; ảnh riêng chậu BL2 chỉ thấy trắng. |
| CNTSV, TCNTSV | Đỏ, xám đậm/đen, xanh lá đậm, trắng | [Ảnh 3452](https://cdn2-retail-images.kiotviet.vn/2025/11/05/alohanguyen/91fb9293e92c407d92891695e89fdb21.png) | Ảnh CNTSV/TCNTSV có 4 màu. CNTSV không có thuộc tính màu, chỉ có thuộc tính mẫu. |
| HTKSCD10T64, TKSCD10, TTKSCD10T64 | Xanh lá nhạt, vàng kem, xanh dương nhạt, trắng | [Ảnh 3753](https://cdn2-retail-images.kiotviet.vn/2025/03/13/alohanguyen/382c22c9b0fd4b76b4a45fe53f459afa.jpg) | Dòng TKSCD10 và các mã hộp/thùng dùng chung ảnh nhiều màu. |
| CVCDT64, TCVCDT64 | Xanh dương, vàng kem, xanh lá, trắng | [Ảnh 3927](https://cdn2-retail-images.kiotviet.vn/2025/03/27/alohanguyen/05587f9794964a45b957dd375e952138.jpeg) | CVCDT64 và TCVCDT64 dùng chung ảnh; có trong công thức nhiều combo. |
| GC | Xanh dương, hồng, trắng | [Ảnh 2821](https://cdn-images.kiotviet.vn/alohanguyen/3af10cba94534a1d8f9cfcb74d242c4d.tmp) | Chậu GC trong công thức TPVLBA. Ảnh combo TPVLBA lại thể hiện trắng/vàng; cần đối chiếu. |
| XT | Trắng, xanh dương nhạt | [Ảnh 3978](https://cdn-images.kiotviet.vn/alohanguyen/5014aba16d484ed1ba45f2522acdba87.jpeg) | Chậu XT có trong công thức LHTT và các thành phẩm khác. |
| NX | Đỏ, vàng, cam, xanh dương, xanh lá, hồng, tím | [Ảnh 4969](https://cdn-images.kiotviet.vn/alohanguyen/9adcf8ecc47e4426a986d9e9ef128b8a.jpg) | Nấm xốp NX là hàng thành phần trang trí; công thức không chọn màu nấm. |

## Sản phẩm dùng hàng thành phần đã có ảnh nhiều màu rõ ràng

Các quan hệ dưới đây lấy trực tiếp từ công thức hiện tại. Tên màu là màu trong ảnh của thành phần, chưa phải lựa chọn bán hàng đã cấu hình.

| Mã thành phần | Tên | Mã sản phẩm sử dụng trực tiếp |
|---|---|---|
| CNTSV | CHẬU NHỰA THỦY SINH VUÔNG | LYTSCV, TCNTSV |
| XT | CHẬU XÉO TRƠN ( CAO11cm X DÀI12cm X RỘNG10cm ) | LHTT, TPKNAK, XDC, KNLD |
| NX | NẤM XỐP TRANG TRÍ CÂY CẢNH | LHTT, OVHBMTC, TPTTYT, CBPTTT |
| CVCDT64 | CHẬU VUÔNG CÓ ĐĨA CAO 10CM NGANG 10CM(THÙNG 64) | CBHNTL, TCVCDT64, CBKTDP, TPKNDP |
| GC | CHẬU GIỎ CUA ( CAO12cm X RỘNG11cm ) | TPVLBA |
| TKSCD10 | CHẬU TRỤ KẺ SỌC CÓ ĐĨA NHIỀU MÀU (CAO 10CM NGANG 10CM ) | CBLHCG, HTKSCD10T64, TTKSCD10T64, CBKNMM |
| BLMTBL | COMBO TRẦU BÀ ĐỂ BÀN | TBLMTBL |
| XRMT20 | COMBO XƯƠNG RỒNG MIX (THÙNG 20) | TXRMT20 |

## Những điểm cần chốt trước khi thêm lựa chọn màu

1. **LYTSCV → CNTSV:** ảnh thành phẩm ghi đen/trắng/đỏ, ảnh thành phần có thêm xanh lá. CNTSV chỉ có thuộc tính MẪU, chưa có MÀU.
2. **LHTT → XT:** ảnh thành phẩm có xám đậm/trắng/hồng/cam nhạt, ảnh XT hiện thấy trắng/xanh dương. Hai bộ ảnh chưa đồng nhất màu.
3. **DDNH → CXRBX:** ảnh thành phẩm có trắng/hồng/xanh dương; ảnh CXRBX hiện chỉ trắng.
4. **BLMTBL → BL2:** ảnh thành phẩm có nhiều màu, ảnh BL2 riêng chỉ trắng.
5. **TPVLBA → GC:** ảnh thành phẩm có trắng/vàng, ảnh chậu GC có xanh/hồng/trắng.
6. **XRMT20/TXRMT20:** dùng chung bảng 4 màu; XRMT20 không có công thức thành phần, TXRMT20 chứa 20 XRMT20. Chưa tìm thấy mã chậu riêng qua công thức này.
7. **NX và các phụ kiện:** nhiều màu xuất hiện trên ảnh nhưng công thức chỉ lưu mã và số lượng. Cần xác định màu được chọn, giao ngẫu nhiên hay phối theo mẫu.

## Tệp kết quả

- [Excel có bộ lọc: ảnh, thành phần, thuộc tính màu và đường dẫn lồng nhau](../artifacts/color-image-audit/RA_SOAT_MAU_CHAU_VA_THANH_PHAN.xlsx).
- [Thư viện ảnh có tìm kiếm theo mã/tên/thành phần](../artifacts/color-image-audit/index.html).
- [Dữ liệu chi tiết JSON](../artifacts/color-image-audit/results.json).
- [Danh mục ảnh hiện tại](../artifacts/color-image-audit/manifest-current.json).

Chỉ tạo báo cáo và dữ liệu rà soát trong workspace; không chỉnh sửa sản phẩm, công thức hoặc giao diện shop.
