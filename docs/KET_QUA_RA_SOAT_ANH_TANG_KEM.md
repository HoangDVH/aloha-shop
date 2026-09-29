# Kết quả rà ảnh sản phẩm có tặng kèm

Ngày kiểm tra: 29/09/2026. Chỉ đọc dữ liệu; không sửa sản phẩm, chương trình ưu đãi hoặc code ứng dụng.

## Phạm vi và phương pháp

- Đọc 3090 bản ghi trong aloha_products theo cấu hình database local của dự án; không lọc riêng hàng đang hiển thị công khai. Không khẳng định dữ liệu giống production tại thời điểm kiểm tra.
- Thu thập ảnh từ anh và images: 5723 URL duy nhất, tải thành công 5723; OCR 5723 ảnh, 0 lỗi xử lý.
- Quét chữ bằng Windows OCR (ngôn ngữ en-US có sẵn), tìm các dấu hiệu tặng kèm/quà tặng và xem trực tiếp ảnh nghi vấn. Có mở rộng tìm kiếm do OCR đọc sai dấu và chữ.
- Xác nhận bằng mắt 8 ảnh liên quan 9 mã sản phẩm bên dưới. OCR có thể bỏ sót chữ nhỏ/cách điệu; không khẳng định ngoài danh sách này hoàn toàn không có ảnh tặng kèm. Không kiểm tra ảnh nhúng riêng trong HTML mô tả hoặc video.
- Kết quả xác nhận nội dung quảng cáo trên ảnh, chưa xác nhận chương trình còn hiệu lực, tồn kho quà, điều kiện áp dụng hoặc hệ thống tự thêm quà vào đơn.

## Ảnh đã xác nhận có tặng kèm

| Mã database | Tên sản phẩm | Nội dung tặng kèm trên ảnh | Vị trí | Bằng chứng | Lưu ý |
|---|---|---|---|---|---|
| LYTSCV | CÂY LAN Ý THỦY SINH CHẬU VUÔNG | 1 chai dinh dưỡng thủy sinh, trị giá 20k | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/08/alohanguyen/4ec01968a0534e70a9309b06df32ef8f.jpg) | Ảnh ghi mã LYTS; database gắn ảnh cho LYTSCV. |
| LYTST42 | CÂY LAN Ý THỦY SINH THÙNG 42 | 1 chai dung dịch (ảnh ghi “THỦY TINH”) | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/f48f16ca376c45b2a3d53d46994ebab7.jpg) | Tên database là thùng 42; ảnh chỉ thể hiện một chậu. Cần xác nhận loại dung dịch và số quà theo đơn vị bán. |
| PTTT | COMBO PHÁT TÀI THĂNG TIẾN | Túi giấy cao cấp | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/03/alohanguyen/351b1b88182146ce8d14883c3fad349a.jpg) | Mã trên ảnh TTPT, mã database PTTT. |
| MMMCX | MAY MẮN MIX CHẬU XẺ | 1 bảng đen nhỏ + 1 bướm trang trí | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/581899b6fb3c44269ffe51e77440cf06.jpg) | — |
| TPTTCT | THÀNH PHẨM THĂNG TIẾN CÁT TƯỜNG ( CẦN THĂNG ) | Túi giấy | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/d5e0ddc77a5c40b0b065fa54b37d882e.png) | Mã trên ảnh TTCT, mã database TPTTCT. |
| TTPTVC | CÂY TRÚC PHÁT TÀI THÀNH PHẨM | 1 típ phân tan chậm | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/03c22b477b5e4e66a60ae1b5086c76bd.jpg) | Một URL ảnh gắn cho cả TTPTVC và TPTTP; chưa kết luận hai mã là cùng đơn vị bán. |
| TPTTP | CÂY TRÚC PHÁT TÀI THÀNH PHẨM | 1 típ phân tan chậm | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/03c22b477b5e4e66a60ae1b5086c76bd.jpg) | Một URL ảnh gắn cho cả TTPTVC và TPTTP; chưa kết luận hai mã là cùng đơn vị bán. |
| TPLHDB | THÀNH PHẨM LƯỠI HỔ ĐỂ BÀN | 1 bảng đen nhỏ + 1 con giáp | ảnh 3 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/08/12/alohanguyen/56d8a7c0544343d19ed77df7364652e0.jpg) | Mã trên ảnh LHDB01, mã database TPLHDB. |
| TPKTB3 | THÀNH PHẨM KIM TIỀN B3 | Cây cắm bảng chúc mừng; decor theo yêu cầu khách hàng | Ảnh chính; ảnh 1 trong images | [Mở ảnh](https://cdn2-retail-images.kiotviet.vn/2026/07/08/alohanguyen/e639ea8b32e142cdb01cf4c939ff4f99.jpg) | Ảnh ghi mã KTB3 và chỉ giao tại TP.HCM; mã database TPKTB3. |

Các mã trên có isActive=true trong snapshot database. Đây không phải bằng chứng tất cả đang xuất hiện trên shop công khai vì còn điều kiện hiển thị khác.

## Có nội dung tặng kèm trong mô tả, chưa xác nhận trên ảnh

- BCCXAM, BCCC: mô tả ghi tặng kèm đĩa lót nhựa tiện dụng.
- HTKSCD10T64, TKSCD10, TTKSCD10T64: mô tả ghi tặng kèm đĩa lót tiện dụng.
- KNHP ghi tặng hướng dẫn và hỗ trợ tư vấn; không tính như quà vật phẩm trong danh sách ảnh.

## Điểm cần làm rõ trước khi cấu hình quà tặng

1. Xác nhận mã hàng quà, số lượng theo đơn vị mua, thời hạn và phạm vi áp dụng. Đặc biệt phân biệt sản phẩm lẻ/thùng ở LYTST42.
2. Nhiều ảnh dùng mã thiết kế khác mã database; dùng mã database để cấu hình, không suy SKU từ chữ trên ảnh.
3. TTPTVC/TPTTP dùng chung ảnh: tránh tự nhân đôi quà hoặc gộp hai mã khi chưa kiểm tra đơn vị bán.
4. Ảnh tặng kèm không chứng minh quà đã được tự thêm vào giỏ, trừ tồn kho hay gửi KiotViet; các hành vi này chưa được kiểm tra trong lượt rà ảnh.
5. Không xem các câu “quà tặng ý nghĩa”, “phù hợp làm quà” là khuyến mãi tặng thêm. Chữ “FILM FREE” trên ảnh giấy decal cũng không phải tặng miễn phí.

## Dữ liệu kiểm tra lưu trong workspace

- Manifest URL ảnh và mã liên quan: ../artifacts/gift-image-audit/manifest.json
- Kết quả đã xác nhận: ../artifacts/gift-image-audit/verified.json
- OCR theo lô: ../artifacts/gift-image-audit/ocr-0.jsonl đến ocr-7.jsonl
- Ảnh tải để kiểm tra: ../artifacts/gift-image-audit/images/

Báo cáo độc lập, không chỉnh sửa hai kế hoạch ưu đãi/phí ship.
