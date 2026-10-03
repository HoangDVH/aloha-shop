# Test case QA/QC — Chiến dịch ưu đãi ngày lễ (tất cả: Chưa chạy)

Đi kèm kế hoạch "Chiến dịch voucher ngày lễ". Mỗi ca có mã riêng, dữ liệu, thao tác và kết quả bắt buộc. Một ca chỉ được đánh "Đạt" khi có bằng chứng (log, ảnh chụp, số liệu DB trước và sau).

Cột **Loại**: U = unit, I = integration (service thật + Mongo/Redis thử), E = E2E trên trình duyệt, M = kiểm tra tay. Cột **Mức**: P0 = chặn phát hành, P1 = phải đạt trước khi bật cho khách thật, P2 = cần đạt trước khi đóng giai đoạn.

## 0. Môi trường và dữ liệu chuẩn (fixture)

- **Môi trường:**
  - DB Mongo thử riêng qua `TEST_MONGO_URI`, tên DB bắt đầu bằng `aloha_shop_test_`. Code test phải **throw ngay** nếu tên DB là `aloha_shop_db` hoặc `aloha_thumua`.
  - Redis thử riêng, hoặc không đặt `REDIS_URL` để kiểm tra nhánh fallback.
  - KiotViet: mock HTTP, chặn mọi request ra ngoài. Riêng ca GF10 cần anh/chị duyệt trước khi tạo đơn `[TEST-WEB]` thật.
  - Chạy tự động bằng `npm test` (`tsx --test tests/*.test.ts`), thêm script này vào `package.json`.
  - Test tranh chấp phải chạy trên Mongo thật; collection giả trong bộ nhớ không chứng minh được tính nguyên tử.
- **Giờ:** đồng hồ giả lập (inject `now()`), múi Asia/Ho_Chi_Minh. Không phụ thuộc giờ máy chạy test.
- **Sản phẩm:**
  - `SP_A`: giá thường 200.000đ, giá vốn 90.000đ, tồn 50.
  - `SP_B`: giá thường 500.000đ, tồn 20.
  - `SP_C`: giá thường 80.000đ, tồn 3.
  - `QUA_G` (hộp quà): giá 0đ khi làm quà, tồn 5.
- **Chiến dịch `DAI_LE`:** 01/10 00:00 đến 03/10 23:59.
  - Khung `S09` 09:00–11:59, `S12` 12:00–15:59, `S20` 20:00–23:59; sản phẩm không chọn khung thì bán cả ngày (`ALLDAY`).
  - Flash: `SP_A` giá 124.000đ (-38%), quota 10, tối đa 2 cái / khách; `SP_C` giá 50.000đ, quota 5.
  - Quà: mua `SP_B` tặng 1 `QUA_G`, quota quà 3.
- **Voucher:**
  - `V30K`: giảm 30.000đ cho đơn từ 350.000đ; `claimRequired`; 3 lượt phát; mỗi khách 1 lượt.
  - `VSHIP`: hỗ trợ ship 30.000đ nội thành HCM, tự áp dụng.
  - `VSHIP_LUU`: hỗ trợ ship 20.000đ nội thành HCM cho đơn từ 200.000đ, `claimRequired`.
  - `V50K_RIENG`: giảm 50.000đ cho đơn từ 400.000đ, tắt "Dùng chung với hỗ trợ ship" (`combineWithShip = false`).
  - `VNEW`: giảm 10%, tối đa 100.000đ, chỉ khách mới (`new_web`), `claimRequired`.
  - `VSI`: chỉ khách sỉ; không được đưa vào chiến dịch (chiến dịch chỉ dành cho khách lẻ).
- **Tài khoản:**
  - `KH_MOI`: chưa từng mua.
  - `KH_CU`: đã có đơn thành công.
  - `KH_SI`: khách sỉ đang hoạt động.
  - `KH_SI_CHO`: đã đăng ký sỉ, đang chờ duyệt (role `si`, `siStatus = cho_duyet`).
  - `KH_CTV`: cộng tác viên đang hoạt động (role `ctv`).
  - `KHACH`: chưa đăng nhập.
  - `KH_TEST`: `isTestBuyer`.
  - `ADMIN_NV`: nhân viên. `ADMIN_QL`: quản lý (`requireManager`).

## 1. Bước 0 — tách file, không đổi hành vi (RF)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| RF01 | Chạy toàn bộ `tests/*.test.ts` hiện có trước và sau khi tách `orderCreateRoutes.ts` | Cùng số ca đạt; không ca nào chuyển sang lỗi | U/I | P0 |
| RF02 | Tạo đơn mẫu (chuyển khoản, COD, có voucher, có ship voucher) trước và sau khi tách | Response, bản ghi đơn, redemption, stock hold và payload KV giống hệt nhau (so sánh JSON, bỏ qua `_id` và thời gian) | I | P0 |
| RF03 | Gửi lại cùng `idempotencyKey` sau khi tách | Trả về cùng đơn; cùng key khác nội dung thì 409 `idempotency_conflict` như cũ | I | P0 |
| RF04 | Đẩy KV lỗi (mock 500) sau khi tách | Rollback giống cũ: nhả tồn, nhả lượt voucher, trạng thái đơn đúng | I | P0 |
| RF05 | Mở form voucher sau khi tách `PromotionFormModal` thành các Section: tạo, sửa, nhân bản cả 3 loại (giảm hàng / ship / mã) | Dữ liệu lưu giống hệt trước khi tách; mọi khối xổ ra đóng / mở được | E | P0 |
| RF06 | Trang admin "Ưu đãi & Voucher" sau khi tách: lọc, phân trang, xem chi tiết mã KiotViet, báo cáo | Số liệu và thao tác giống trước khi tách | E | P0 |
| RF07 | Modal voucher ở checkout dùng `VoucherTicket` tách ra | Giao diện vé, trạng thái đủ / không đủ điều kiện, chọn / bỏ mã giống cũ trên 360px và 1280px | E | P1 |
| RF08 | `HomeLowStockSale` dùng `useCountdown` tách ra, khi không có chiến dịch | Đếm ngược tới cuối ngày như cũ; không rò `setInterval` khi rời trang | U/E | P1 |
| RF09 | Chạy `scripts/check-max-lines.cjs` | Không file nào trong phạm vi quét vượt 800 dòng; thêm tạm 1 file 801 dòng thì script báo lỗi, exit code khác 0 | U | P0 |
| RF10 | `npm run typecheck` (API + web) | Đạt, không lỗi mới | U | P0 |

## 2. Dữ liệu chiến dịch, áp dụng, lịch (CP)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| CP01 | Lưu bản nháp hợp lệ theo fixture | Lưu được; `published` không đổi; trang khách không thấy gì | I | P0 |
| CP02 | Lưu bản nháp sai schema (thiếu `endDate`, slot `start` > `end`, quota âm, màu sai định dạng, link `javascript:`) | 400 kèm danh sách lỗi theo trường; không ghi DB | U/I | P0 |
| CP03 | Áp dụng bản nháp | `published` = bản nháp, `revision` + 1, xoá cache `current`, phát SSE `campaign` | I | P0 |
| CP04 | Hai admin cùng sửa, người sau gửi `revision` cũ | 409; bản của người trước còn nguyên | I | P0 |
| CP05 | Hẹn giờ áp dụng 20:00, đồng hồ giả chạy qua 20:00 | Worker áp dụng đúng 1 lần (kể cả khi 2 tiến trình cùng chạy) | I | P0 |
| CP06 | `GET /api/shop/campaigns/current` trước giờ bắt đầu, trong, và sau giờ kết thúc | Trước: không có chiến dịch (hoặc chỉ `upcoming` nếu bật); trong: đúng dữ liệu; sau: không có | I | P0 |
| CP07 | Hai chiến dịch trùng thời gian | Chặn áp dụng chiến dịch thứ hai, báo trùng; không có 2 chiến dịch cùng chạy | I | P1 |
| CP08 | Tạm dừng khẩn cấp khi đang chạy | Trong 5 giây: API `current` trả trạng thái dừng, giá flash không còn áp ở quote / tạo đơn (dù trang còn ISR cũ) | I/E | P0 |
| CP09 | Bấm "Huỷ thay đổi" trên bản nháp đang sửa | Bản nháp quay về đúng bản đang chạy; trang khách không đổi; audit ghi người thao tác | I | P1 |
| CP10 | Preview token hết hạn hoặc bị sửa | 401; không lộ bản nháp | I | P0 |
| CP11 | Preview với `campaignPreviewAt` = 20:05 | Hiện khung S20 "Đang diễn ra"; không đổi giá thật khi mua | E | P1 |
| CP12 | `audience: test_only` | `KH_TEST` thấy chiến dịch và mua được giá flash; `KH_MOI` không thấy và không được giá flash | I/E | P0 |
| CP13 | Redis tắt | `current` vẫn trả đúng từ Mongo + cache RAM; không lỗi 500 | I | P1 |
| CP14 | Chọn mẫu "Đại lễ 2/9" | Điền sẵn chữ, màu, bố cục như 3 ảnh; vẫn là bản nháp, chưa áp dụng | E | P2 |

## 3. Trang chủ, cụm banner, các khối hiển thị (UI)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| UI01 | Khách lần đầu, desktop 1280px, chiến dịch đang chạy | Màn hình đầu tiên (không cuộn) thấy thanh thông báo, cụm banner (chính + 2 phụ) và ô lối tắt | E | P0 |
| UI02 | Như UI01 trên mobile 360px và 414px | Thấy thanh thông báo, banner chính, 2 banner phụ; không tràn ngang, không chữ bị cắt | E | P0 |
| UI03 | Admin chưa có slide nào | Banner chính dùng 4 ảnh mặc định `BRAND_BANNERS` | E | P1 |
| UI04 | Admin tải 3 slide mới | Hiện đúng 3 slide của admin theo thứ tự; không còn ảnh gán cứng | E | P0 |
| UI05 | Chiến dịch có 2 slide chiến dịch + 3 slide thường | 2 slide chiến dịch đứng đầu; hết chiến dịch thì tự biến mất, không cần sửa tay | E | P0 |
| UI29 | Admin thêm 1 banner chính ở bước 4, bật chiến dịch; trang chủ đang có 3 slide thường | Không cần chỉnh vị trí: banner chiến dịch là slide 1, carousel bắt đầu từ slide này khi tải trang trên desktop và mobile; 3 slide thường giữ thứ tự cũ phía sau; màn admin ghi "Slide đầu tiên trên trang chủ" | E | P0 |
| UI30 | Tạm dừng chiến dịch rồi bật lại; xem Giao diện → Banner trang chủ | Tạm dừng: slide chiến dịch biến mất trong ≤ 40 giây, slide thường về vị trí 1. Bật lại: slide chiến dịch về lại vị trí 1. Trang Giao diện hiện slide chiến dịch ghim dòng đầu, chỉ xem, có nút "Sửa trong chiến dịch" | E | P1 |
| UI06 | Slide có `startAt` / `endAt` | Chỉ hiện trong khoảng giờ đó (giờ server) | I/E | P1 |
| UI07 | Banner phụ chế độ `template: voucher` với `V30K` | Chữ lấy từ voucher thật ("Voucher 30K", "Còn 3 lượt"); admin đổi voucher thì chữ đổi theo | E | P1 |
| UI08 | Banner phụ `template: flash` | Đếm ngược tới khung giờ kế tiếp; qua giờ tự chuyển sang khung sau | E | P1 |
| UI09 | Hết chiến dịch, không có banner phụ mặc định | Banner chính giãn full chiều ngang, không còn ô trống | E | P1 |
| UI10 | Mobile tải trang | Chỉ tải ảnh `imageMobile` (kiểm tra tab Network), không tải ảnh desktop | E | P1 |
| UI11 | Ảnh tải chậm (throttle 3G) | Khung giữ đúng tỉ lệ, trang không nhảy (CLS < 0,1) | E | P1 |
| UI12 | Thanh thông báo: bấm tắt, tải lại trang | Không hiện lại; admin đổi nội dung (revision mới) thì hiện lại | E | P1 |
| UI13 | Dòng thông báo dài trên mobile 360px | Một dòng, cắt gọn bằng dấu "…" hoặc chạy chữ, không tràn, đếm ngược vẫn thấy | E | P2 |
| UI14 | Nút "Voucher 50K đơn đầu" với `KH_CU` | Không hiện (`audience: new_web`); với khách chưa đăng nhập và `KH_MOI` thì hiện | I/E | P1 |
| UI15 | Chữ nút dùng `{value}`, admin đổi `VNEW` từ 50K sang 30K | Nút hiện "30K", không còn chữ cũ | E | P1 |
| UI16 | Bấm từng ô lối tắt (Flash, Kho voucher, Quà tặng…) | Cuộn / chuyển tới đúng mục (`/uu-dai#flash`, `#voucher`…); chữ và icon đúng như admin nhập | E | P2 |
| UI17 | Khu Quà khách mới: `KH_MOI` so với `KH_CU` | `KH_MOI` thấy `variant=newUser`; `KH_CU` thấy `variant=compact` | E | P1 |
| UI18 | Có Flash Stage | `HomeLowStockSale` không hiện trùng; hết chiến dịch thì hiện lại như cũ | E | P1 |
| UI19 | `/uu-dai` khi chiến dịch chạy | Hero như ảnh 1, thanh mục dính, bấm mục thì cuộn đúng chỗ, mục đang xem được tô màu | E | P1 |
| UI20 | `/uu-dai` khi không có chiến dịch | Hiện "Chưa có chiến dịch / Sắp diễn ra" + voucher đang có; không 404, không lỗi | E | P1 |
| UI21 | Chia sẻ `/uu-dai` qua Zalo / Facebook | Có ảnh OG, tiêu đề, mô tả của chiến dịch | M | P2 |
| UI22 | Hộp chào mừng: `KH_MOI` lần đầu, mobile | Bảng trượt lên sau 4 giây hoặc khi cuộn 30%; không hiện ở `/gio-hang`, `/thanh-toan`, `/dang-nhap`, `/tai-khoan` | E | P1 |
| UI23 | Hộp chào mừng: bấm "Để sau", mở lại trong 3 ngày | Không hiện lại; qua 3 ngày (đồng hồ giả) thì hiện lại | E | P1 |
| UI24 | Hộp chào mừng với `KH_CU` | Không hiện | E | P1 |
| UI25 | Máy bật `prefers-reduced-motion` | Tắt pháo giấy, vệt sáng, số lật; chức năng vẫn đủ | E | P2 |
| UI26 | Bàn phím: Tab qua banner, vé voucher, tab khung giờ, hộp chào mừng | Thứ tự hợp lý, thấy viền focus, Esc đóng hộp, carousel có nút dừng | E | P1 |
| UI27 | Trình đọc màn hình với đếm ngược | Không đọc từng giây; đọc theo phút | M | P2 |
| UI28 | Trình duyệt Chrome, Safari iOS, Samsung Internet, Zalo in-app | Bố cục và chức năng lưu mã / mua đều chạy | M | P1 |

## 4. Ví voucher (WL)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| WL01 | `KH_MOI` lưu `V30K` | Ví có 1 bản ghi `saved`; `claimedCount` = 1; nút thành "Đã lưu" | I/E | P0 |
| WL02 | `KH_MOI` lưu `V30K` lần 2 | Không tạo bản ghi thứ 2; báo "Bạn đã lưu voucher này"; bộ đếm không tăng | I | P0 |
| WL03 | 10 tài khoản cùng lưu `V30K` (3 lượt) cùng lúc | Đúng 3 thành công, 7 nhận "Đã hết lượt"; `claimedCount` = 3; ví có đúng 3 bản ghi | I | P0 |
| WL04 | 1 tài khoản gửi 20 request lưu cùng lúc | Đúng 1 bản ghi; `claimedCount` tăng đúng 1 | I | P0 |
| WL05 | Chèn lỗi ghi ví sau khi đã tăng `claimedCount` | Bước bù trả lại bộ đếm; đối soát cho `claimedCount` = số bản ghi ví | I | P0 |
| WL06 | Khách chưa đăng nhập bấm "Lưu mã" | Mở bảng đăng nhập ngay trên trang; đăng nhập xong tự lưu và hiện "Đã lưu"; không cần bấm lại | E | P0 |
| WL07 | "Thu thập tất cả" với `KH_CU` (không đủ điều kiện `VNEW`) | Lưu các mã đủ điều kiện, báo "Đã lưu 2/3, 1 mã không đủ điều kiện"; không lưu `VNEW` | I/E | P0 |
| WL08 | "Thu thập tất cả" bấm 2 lần liên tiếp / gửi lại cùng `Idempotency-Key` | Kết quả như 1 lần | I | P1 |
| WL09 | Voucher `claimRequired` chưa lưu, vào checkout | Không tự áp; lý do "Bạn chưa lưu voucher này"; có nút "Lưu" ngay trong modal | I/E | P0 |
| WL10 | Đã lưu `V30K`, đơn 400.000đ | Tự áp giảm 30.000đ; tạo đơn thì ví chuyển `held` | I | P0 |
| WL11 | Đơn ở WL10 thanh toán xong | Ví chuyển `used`; không dùng lại được cho đơn khác | I | P0 |
| WL12 | Đơn ở WL10 bị huỷ trước khi thanh toán | Ví trở về `saved` (voucher còn hạn); dùng được cho đơn mới | I | P0 |
| WL13 | Như WL12 nhưng voucher đã hết hạn lúc huỷ | Ví không về `saved`; hiện "Đã hết hạn" | I | P1 |
| WL14 | Đơn hết hạn thanh toán do worker xử lý | Như WL12, trả về đúng 1 lần kể cả khi worker và khách cùng huỷ | I | P0 |
| WL15 | `V30K` đã lưu, qua `endDate` của voucher (giờ VN) | Không áp ở checkout; ví hiện "Hết hạn"; vé biến khỏi kho voucher | U/I | P1 |
| WL16 | Chưa tới `claimStartDate` | Vé hiện "Sắp mở lưu" + đếm ngược; gọi API claim thì bị từ chối | I/E | P1 |
| WL17 | Admin tạm dừng `V30K` sau khi khách đã lưu | Ví hiện "Voucher đã ngừng"; checkout không áp; không mất bản ghi ví | I | P1 |
| WL18 | Admin sửa giá trị giảm của voucher đã có người lưu | Bị khoá (không cho sửa trường quan trọng) hoặc buộc tạo voucher mới | I/E | P0 |
| WL19 | Tab "Voucher của tôi" | Chia Còn dùng / Đã dùng / Hết hạn; số lượng khớp DB | E | P1 |
| WL20 | `KH_SI` xem kho voucher chiến dịch | Mọi vé hiện nhưng nút khoá "Dành cho khách lẻ"; `VSI` không nằm trong kho chiến dịch | E | P1 |
| WL21 | Lưu ở tab A, tab B đang mở | Tab B cập nhật "Đã lưu" khi quay lại tab (refetch khi focus) | E | P2 |
| WL22 | Cờ `SHOP_VOUCHER_WALLET_ENABLED=0` | Voucher `claimRequired` hoạt động như voucher thường; không lỗi giao diện | I | P0 |
| WL23 | `POST /promotions/quote` gửi giá client giả 1.000đ | Server bỏ giá client, dùng giá catalog; tiền giảm tính theo giá thật | I | P0 |
| WL24 | `KH_CU` đã lưu `V30K`; giỏ `SP_A` ×2 giá flash (248.000đ) + `SP_C` giá flash (50.000đ) + 1 sản phẩm thường 80.000đ = 378.000đ; phí ship 35.000đ, nội thành HCM | Áp đồng thời `V30K` (-30.000đ) và `VSHIP` (-30.000đ); điều kiện "Đơn từ 350K" xét trên 378.000đ (sau flash, trước voucher); checkout ghi riêng 3 dòng giảm | I/E | P0 |
| WL25 | Như WL24 nhưng phí ship 18.000đ | Voucher ship giảm đúng 18.000đ, phần dư bỏ; không trừ sang tiền hàng | U/I | P0 |
| WL26 | Đơn đã được miễn ship / nhận tại cửa hàng / địa chỉ ngoài HCM | Không áp voucher ship, hiện lý do tương ứng; voucher hàng vẫn áp bình thường | I | P0 |
| WL27 | `VSHIP_LUU`: chưa lưu / đã lưu, đơn 250.000đ, phí ship 30.000đ | Chưa lưu: không áp, lý do "Bạn chưa lưu voucher này". Đã lưu: áp -20.000đ; tạo đơn thì ví `held`, thanh toán thì `used` | I | P0 |
| WL28 | `KH_CU` có `V50K_RIENG` và `V30K`, đơn 420.000đ, phí ship 30.000đ | So 2 phương án: `V50K_RIENG` một mình (50.000đ) với `V30K` + `VSHIP` (60.000đ), chọn phương án 60.000đ; khách tự chọn `V50K_RIENG` thì voucher ship bị bỏ kèm lý do "Voucher này không dùng chung với hỗ trợ ship" | U/I | P0 |
| WL29 | Đơn ở WL24 bị huỷ trước thanh toán; đơn khác đã giao, hoàn 1 trong 3 dòng | Huỷ: cả `V30K` và `VSHIP` trả lượt (ví về `saved` nếu còn hạn). Hoàn một phần: chỉ chia tiền `V30K` theo tỉ lệ dòng; tiền hỗ trợ ship không hoàn | I | P0 |

## 5. Flash sale giá thật (FS)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| FS01 | 09:30, `KH_MOI` mua 1 `SP_A` | Giỏ, checkout, đơn và KV đều là 124.000đ; giá gạch 200.000đ; `held` +1 | I/E | P0 |
| FS02 | 08:59:59 và 12:00:00 (ngoài khung S09) | Giá thường 200.000đ; nút "Sắp mở 09:00" bị khoá | U/I | P0 |
| FS03 | Biên giờ: 11:59:59 được giá flash; 12:00:00 thì không (nếu S12 không có `SP_A`) | Đúng từng giây theo giờ server VN | U | P0 |
| FS04 | Máy chủ chạy TZ=UTC | Khung giờ vẫn đúng giờ VN (không lệch 7 tiếng) | U | P0 |
| FS05 | Đồng hồ máy khách lệch +10 phút | Đếm ngược theo `serverNow`; khách không mua được sớm hơn giờ server | E | P1 |
| FS06 | Mua 3 `SP_A` (giới hạn 2 / khách) | 2 cái giá 124.000đ + 1 cái giá 200.000đ, hiện rõ 2 dòng; không từ chối cả đơn | I | P0 |
| FS07 | Quota còn 1, mua 2 | 1 giá flash + 1 giá thường; báo trước ở quote | I | P0 |
| FS08 | 50 khách cùng mua 1 `SP_A` lúc 09:00:00 (quota 10) | Đúng 10 đơn giá flash; `sold + held` ≤ 10 mọi lúc; 40 đơn còn lại nhận giá thường hoặc "Đã hết suất" | I | P0 |
| FS09 | 1 khách mở 5 tab cùng đặt 2 `SP_A` | Tổng giá flash của khách ≤ 2 | I | P0 |
| FS10 | Quote lúc 11:58, tạo đơn lúc 12:00:05 | 409 `price_changed` + "Khung giờ vàng đã kết thúc"; hiện giá mới để khách xác nhận; không tự tăng tiền | I/E | P0 |
| FS11 | Huỷ đơn flash trước khi thanh toán | `held` -1; suất quay lại cho người khác | I | P0 |
| FS12 | Đơn chuyển khoản không trả trong thời gian giữ (15 phút) | Worker nhả `held` đúng 1 lần; đơn hết hạn | I | P0 |
| FS13 | Thanh toán tới sau khi đã nhả suất | Còn suất thì chiếm lại; hết suất thì đơn vào danh sách xử lý tay (không bán vượt quota, không mất tiền khách) | I | P0 |
| FS14 | Thanh toán thành công | `held` → `sold`; thanh "Đã bán" tăng | I | P0 |
| FS15 | COD giao thành công / giao thất bại | Thành công: `sold`; thất bại: nhả suất | I | P1 |
| FS16 | Đẩy KV lỗi khi tạo đơn flash | Nhả `held`, nhả tồn, nhả voucher; không giữ treo | I | P0 |
| FS17 | `KH_SI` xem và mua `SP_A` | Thấy card ưu đãi nhưng nút "Mua Ngay Giờ Vàng" khoá "Dành cho khách lẻ"; thêm giỏ / đặt hàng dùng giá sỉ, không áp giá flash, không trừ suất | I/E | P0 |
| FS18 | Giá thường `SP_A` trên KiotViet giảm còn 110.000đ (thấp hơn giá flash) | Khách trả `min(flash, thường)` = 110.000đ; không hiện "giảm giá" sai; admin nhận cảnh báo | I | P0 |
| FS19 | `SP_A` bị ẩn web hoặc hết tồn giữa chiến dịch | Thẻ flash hiện "Đã hết" hoặc ẩn; không tạo được đơn | I/E | P1 |
| FS20 | Admin tạm dừng riêng `SP_A` | Trong 5 giây không còn giá flash ở quote / tạo đơn; các sản phẩm khác không ảnh hưởng | I | P0 |
| FS21 | Voucher `V30K` trên giỏ có `SP_A` giá flash | Voucher tính trên giá đã flash; tổng 3 tầng đúng; `excludeFlash` bật thì voucher không áp cho dòng flash | U/I | P0 |
| FS22 | Checkout hiện "Giảm Flash Sale / Voucher shop / Hỗ trợ ship" | Mỗi dòng khớp tiền trong đơn đã lưu, cộng lại đúng tổng | E | P1 |
| FS23 | Hoa hồng CTV trên đơn flash | Tính trên tiền hàng thực trả sau flash và voucher, đúng công thức hiện hành | I | P0 |
| FS24 | SSE `flash` khi có người mua | Thanh "Đã bán" ở máy khác cập nhật ≤ 5 giây; SSE rớt thì fallback 40 giây vẫn cập nhật | E | P1 |
| FS25 | Sản phẩm không chọn khung giờ (bán cả ngày) và bật `dealHot` | Hiện ở Deal hot với đúng giá sale và số lượng của dòng đó; "Còn N suất" khớp bộ đếm | I/E | P1 |
| FS26 | Đã bán dưới 10% số lượng | Hiện "Vừa mở bán" thay cho thanh gần như trống | E | P2 |
| FS27 | Giỏ lưu từ hôm trước còn giá flash cũ | `refreshCartPricesFromCatalog` cập nhật giá mới và báo khách trước khi thanh toán | E | P1 |
| FS28 | Cờ `SHOP_FLASH_SALE_ENABLED=0` khi đang có đơn `held` | Không áp giá flash cho đơn mới; đơn cũ vẫn thanh toán / huỷ / nhả suất đúng | I | P0 |

## 6. Quà tặng 0đ (GF)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| GF01 | Mua 1 `SP_B` | Đơn có dòng `QUA_G` x1 giá 0đ, `isGift`, `giftFor: SP_B`, ghi chú "Quà tặng …" | I | P0 |
| GF02 | Mua 2 `SP_B` | `QUA_G` x2 (theo số lượng mua); không vượt quota quà | I | P0 |
| GF03 | Quota quà còn 1, mua 2 `SP_B` | Chỉ tặng 1; quote báo trước "Chỉ còn 1 quà" | I | P1 |
| GF04 | Tồn `QUA_G` = 0 | Đơn vẫn tạo được, không kèm quà; quote đã báo "Quà tặng đã hết" | I/E | P0 |
| GF05 | Client tự gửi dòng `QUA_G` giá 0đ | Server bỏ dòng do client gửi; chỉ server được tạo dòng quà | I | P0 |
| GF06 | Dòng quà và tiền hàng khi tính voucher / ship / CTV | Không cộng vào tiền hàng; ngưỡng "Đơn từ 350K" không tính quà | U/I | P0 |
| GF07 | Giữ tồn quà | Tạo đơn: giữ `QUA_G`; huỷ: nhả; thanh toán: trừ tồn | I | P0 |
| GF08 | Payload KV đơn hàng và hoá đơn | Dòng quà `price: 0`, có `note`; nhánh hoá đơn cũng có `note` | U | P0 |
| GF09 | Hiển thị | Giỏ, checkout, chi tiết đơn, email đều có dòng "Quà tặng" 0đ và icon hộp quà | E | P1 |
| GF10 | Đơn `[TEST-WEB]` thật trên KiotViet (**cần anh/chị duyệt trước**) | KV nhận dòng 0đ, trừ tồn quà; huỷ đơn thử thành công | M | P0 |
| GF11 | Hoàn hàng một phần có quà | Theo chính sách: thu lại quà hoặc trừ giá trị quà; số tiền hoàn đúng | I/M | P1 |

## 7. Admin trình dựng chiến dịch (AD)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| AD01 | `ADMIN_NV` sửa chữ hero | Được | I/E | P0 |
| AD02 | `ADMIN_NV` sửa giá flash / quota / quà / bấm áp dụng | 403; giao diện khoá các trường đó | I/E | P0 |
| AD03 | Khách hoặc CTV gọi API admin chiến dịch | 401/403; không lộ dữ liệu | I | P0 |
| AD04 | Nhập giá sale ≥ giá thường | Chặn lưu, báo lỗi ngay ở dòng đó | U/E | P0 |
| AD05 | Nhập giá sale 9.000đ (dưới giá vốn 90.000đ) | Cảnh báo; phải xác nhận lần 2 + nhập lý do; audit lưu lý do | I/E | P0 |
| AD06 | Giảm > 50% | Cảnh báo quy định khuyến mại; vẫn lưu được sau khi xác nhận | E | P1 |
| AD07 | Quota > tồn khả dụng | Cảnh báo ở bước kiểm tra trước khi áp dụng | I/E | P1 |
| AD08 | 2 khung giờ chồng nhau | Chặn áp dụng | U | P0 |
| AD09 | Chọn voucher đã hết hạn hoặc không active cho kho voucher | Chặn áp dụng, báo tên voucher | I | P1 |
| AD10 | Kéo thả thứ tự banner chiến dịch, ô lối tắt, voucher, sản phẩm flash | Thứ tự lưu đúng; preview đổi theo | E | P1 |
| AD11 | Tải ảnh banner sai tỉ lệ | Mở công cụ cắt với tỉ lệ khoá đúng ô; ảnh lưu dạng webp | E | P1 |
| AD12 | Tải file không phải ảnh / > 4MB / SVG chứa script | Từ chối | I | P0 |
| AD13 | Preview Desktop / Mobile | Khớp giao diện khách thấy (so ảnh chụp) | E | P1 |
| AD14 | `IconPicker` chọn icon | Lưu tên icon; trang khách hiện đúng icon | E | P2 |
| AD15 | Nhập danh sách flash từ Excel (có dòng mã sai, giá trống) | Nhập dòng hợp lệ, liệt kê dòng lỗi; không nhập nửa vời | I/E | P2 |
| AD16 | Xuất báo cáo Excel | Số suất bán theo khung giờ, lượt lưu / dùng voucher, số quà, tỉ lệ bấm khớp DB | I | P1 |
| AD17 | Phiên đăng nhập admin hết hạn khi đang sửa | Không mất bản đang sửa (giữ tạm ở máy); đăng nhập lại thì lưu tiếp | E | P2 |
| AD18 | Form voucher (hàng và ship): khối "Cách nhận" (`ClaimSection`) + công tắc "Dùng chung với hỗ trợ ship" | Lưu đúng `claimRequired`, tổng lượt phát, ngày mở lưu, `combineWithShip`; mỗi khách lưu 1 lần; hạn dùng = hạn voucher | E | P0 |
| AD19 | Mọi thao tác áp dụng / tạm dừng / sửa giá | Có dòng audit: ai, lúc nào, trước / sau | I | P0 |

## 8. Worker nền và đối soát (WK)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| WK01 | 2 tiến trình worker cùng chạy | Chỉ 1 giữ khoá Redis và xử lý; Redis tắt thì dùng khoá Mongo, không xử lý đôi | I | P0 |
| WK02 | 150 đơn quá hạn thanh toán | Xử lý đủ 150 theo lô; mỗi đơn nhả suất / voucher / tồn đúng 1 lần | I | P0 |
| WK03 | Dừng tiến trình giữa lúc nhả suất (sau bước 1 trên 3) | Khởi động lại thì tiếp tục theo `operationId`; không nhả đôi, không sót | I | P0 |
| WK04 | Làm lệch bộ đếm cố ý (`held` +2) | Đối soát phát hiện lệch 2, báo trên admin; chạy sửa → lệch = 0; chạy sửa lần 2 không đổi gì | I | P0 |
| WK05 | Làm nóng cache 1 phút trước 20:00 | Lúc 20:00 lần gọi `current` đầu tiên lấy từ cache | I | P2 |
| WK06 | Worker lỗi Mongo tạm thời | Ghi log, lần chạy sau thử lại; không crash tiến trình API | I | P1 |
| WK07 | Cờ tắt worker | Không chạy; log ghi rõ đang tắt. **Không bật flash trên production khi worker tắt** (kiểm tra bằng chốt khởi động) | I | P0 |

## 9. Chống lạm dụng và an toàn (SG, SEC)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| SG01 | Vượt ngưỡng lưu mã (ví dụ 30 lần / phút / tài khoản) | 429 + `Retry-After`; thông báo có thời gian thử lại | I | P0 |
| SG02 | Giả `X-Forwarded-For` để né giới hạn | Không đổi khoá giới hạn khi không có `TRUST_PROXY` | I | P0 |
| SG03 | 2 tài khoản cùng SĐT nhận hàng mua flash `SP_A` | Tổng theo SĐT ≤ 2 khi bật giới hạn theo SĐT | I | P1 |
| SG04 | Tài khoản tạo < 24 giờ mua suất giảm sâu (khi bật tuỳ chọn) | Bị chặn kèm lý do rõ | I | P2 |
| SG05 | Ngân sách flash của chiến dịch hết | Tự dừng giá flash; đơn đang `held` vẫn xử lý bình thường | I | P0 |
| SG06 | Bot gọi `flash-stock` 100 lần / giây | Trả từ cache; bị giới hạn tần suất; API chính không chậm | I | P1 |
| SEC01 | Nội dung admin nhập có `<script>` / `onerror=` (hero, thông báo, `**nổi bật**`) | Hiển thị như chữ thường, không chạy script | U/E | P0 |
| SEC02 | Link `href` dạng `javascript:` / `data:` / domain lạ | Bị chặn khi lưu; chỉ cho link nội bộ hoặc `https` | U | P0 |
| SEC03 | Khách gọi `claim` cho voucher không công khai / không có trong chiến dịch | 404; không lộ thông tin voucher | I | P0 |
| SEC04 | Khách xem ví của người khác (đổi id) | Chỉ trả ví của chính mình theo phiên đăng nhập | I | P0 |
| SEC05 | `track` chứa dữ liệu cá nhân | Không lưu IP / SĐT / email; chỉ bộ đếm | U | P1 |
| SEC06 | Client gửi `priceKind: "flash"` / `salePrice` trong body tạo đơn | Server bỏ qua, tự tính | I | P0 |

## 10. Hiệu năng, tải và phát hành (PF, RL)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| PF01 | Trang chủ trên mobile giả lập 4G | LCP ≤ 2,5 giây, CLS < 0,1 (Lighthouse) | E | P1 |
| PF02 | 200 người cùng tải trang chủ lúc mở khung giờ (staging) | Không lỗi 5xx; p95 `current` ≤ 300ms | I | P1 |
| PF03 | 100 request tạo đơn flash cùng lúc (staging) | Không bán vượt quota; p95 tạo đơn ≤ 2 giây; không đơn trùng | I | P0 |
| PF04 | Kết nối SSE: 500 client | Server không rò listener (số listener về 0 khi client đóng) | I | P1 |
| PF05 | Bundle trang chủ | Không kéo cả bộ lucide; JS thêm cho chiến dịch ≤ 60KB gzip | U | P2 |
| RL01 | Bật từng cờ `SHOP_CAMPAIGN_ENABLED` → `SHOP_VOUCHER_WALLET_ENABLED` → `SHOP_FLASH_SALE_ENABLED` | Mỗi cờ bật / tắt độc lập; tắt không làm mất dữ liệu ví, bộ đếm, đơn | I | P0 |
| RL02 | Chạy `audience: test_only` trên production 1 ngày | Chỉ `KH_TEST` thấy; đối soát bộ đếm = 0 lệch | M | P0 |
| RL03 | Deploy (pm2 restart) giữa lúc có đơn `held` | Sau restart không mất suất / voucher; worker tiếp tục | I | P0 |
| RL04 | Khoá deploy trong giờ cao điểm chiến dịch | Có ghi trong runbook; người trực biết cách tạm dừng khẩn cấp | M | P1 |
| RL05 | Rollback code về bản trước khi có đơn flash đang `held` | Đơn cũ vẫn huỷ / thanh toán được; không lỗi schema | I | P0 |

## 11. Giai đoạn chiến dịch, giỏ hàng, mobile và admin tổng quan (TS, CT, MB, DB)

### 11.1. Giai đoạn chiến dịch và hiển thị giá (TS)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| TS01 | 28/09 (T-3), xem thẻ và PDP `SP_A` | Hiện nhãn "Giá Đại lễ 124K"; giá bán, giỏ và đơn tạo lúc này vẫn 200.000đ | I/E | P0 |
| TS02 | Chưa đăng nhập bấm "Nhắc tôi" `SP_A`, sau đó đăng nhập | Sản phẩm vào giỏ máy; sau đăng nhập `cartSync` gộp đúng, không nhân đôi số lượng | I/E | P1 |
| TS03 | Cùng 1 khách bấm "Nhắc tôi" 5 lần cho `SP_A` | Lượt nhắc trong `campaign_stats` tăng đúng 1 | I | P1 |
| TS04 | Có `SP_A` trong giỏ, đồng hồ sang 01/10 00:00 khi đang mở trang | Không cần tải lại, trong ≤ 40 giây giỏ hiện 124.000đ và thông báo "1 sản phẩm trong giỏ đã vào giá sale" | E | P1 |
| TS05 | 03/10 18:00 (6 giờ cuối) | Thanh thông báo chuyển đỏ, chữ "Giờ chót"; kho voucher xếp vé còn ít lượt lên đầu | U/E | P2 |
| TS06 | 04/10 00:00:01 | Server trả giá 200.000đ; thẻ hiện "Đã kết thúc"; `/uu-dai` hiện chiến dịch sắp tới + voucher thường, không 404 | I/E | P0 |
| TS07 | Chỉnh đồng hồ máy khách nhanh thêm 1 ngày | Giai đoạn và đếm ngược vẫn theo `serverNow`; không mở giá sale sớm | E | P1 |
| TS08 | 29/09 lưu `V30K` (mở lưu sớm), rồi áp ở checkout ngay hôm đó | Lưu được; checkout không áp, ghi "Dùng từ 01/10" | I | P0 |
| TS09 | Nhãn giảm: `SP_C` 80.000đ → 50.000đ; hàng 500.000đ → 350.000đ; hàng 499.000đ giảm 30% | Lần lượt "-38%", "Giảm 150K", "-30%" | U | P1 |
| TS10 | PDP `SP_A` trong khung flash; sản phẩm không giảm | "Tiết kiệm 76.000đ"; sản phẩm không giảm thì ẩn dòng này | U | P1 |
| TS11 | Bằng chứng xã hội: 4 đơn trong 1 giờ; sau đó thêm 1 đơn thật + 1 đơn `KH_TEST` + 1 đơn đã huỷ | 4 đơn: ẩn. Sau đó hiện "5 người đã mua trong 1 giờ qua"; không tính đơn test và đơn huỷ | I | P1 |
| TS12 | Dải cam kết: chiến dịch có `hero.tags` / để trống | Có thì hiện tags; trống thì hiện mặc định của shop; nội dung hiển thị như chữ thường | E | P2 |
| TS13 | Dòng freeship ở PDP: `VSHIP` đang chạy / tắt `VSHIP` | Hiện đúng mức và điều kiện của `VSHIP`; tắt thì ẩn dòng | I | P1 |
| TS14 | Trong khung `S09`: `SP_A` (có flash) và `SP_B` (không trong chiến dịch) cùng một lưới | Chỉ `SP_A` có `campaignPromo` và card ưu đãi; `SP_B` có `campaignPromo = null`, card giống hệt trước khi có chiến dịch (so ảnh chụp và DOM/class) | I/E | P0 |
| TS15 | `SP_A` ở trang chủ, danh mục, tìm kiếm, sản phẩm liên quan, `/uu-dai`, PDP | Cả 6 nơi hiện cùng card ưu đãi, cùng giá và cùng nhãn | E | P1 |
| TS16 | Sản phẩm có `webBadge` "Giảm giá" nhưng không nằm trong chiến dịch | Vẫn chỉ hiện nhãn tay "GIẢM GIÁ" như cũ; không có "-x%", thanh "Đã bán", đếm ngược | I/E | P0 |
| TS17 | Hết khung `S09` / tạm dừng chiến dịch / tắt dòng flash `SP_A` | `campaignPromo` về `null`; card `SP_A` về dạng thường trong ≤ 40 giây, không cần tải lại | I/E | P0 |
| TS18 | Admin thêm `SP_C` vào flash khung đang chạy | Card `SP_C` chuyển sang dạng ưu đãi trong ≤ 40 giây ở mọi trang đang mở | E | P1 |
| TS19 | Lưới trộn card ưu đãi và card thường (desktop 5 cột, mobile 2 cột) | Chiều cao hàng đều, không lệch lưới; card thường không có khoảng trống thừa | E | P2 |

### 11.2. Giỏ hàng và checkout (CT)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| CT01 | `KH_CU` đã lưu `V30K`, giỏ 305.000đ | Thanh tiến độ "Mua thêm 45.000đ để dùng voucher giảm 30K"; chưa lưu thì gợi ý lưu mã | U/E | P1 |
| CT02 | Giỏ lên 355.000đ | Thanh đầy, "Đã đủ điều kiện"; `V30K` tự áp | I/E | P0 |
| CT03 | `KH_MOI` lưu cả `V30K` và `VNEW`, giỏ 400.000đ | Tự áp `VNEW` (40.000đ > 30.000đ); kết quả trùng với quote server | I | P0 |
| CT04 | Khách tự đổi sang `V30K` | Tự áp không ghi đè lựa chọn của khách, trừ khi mã khách chọn hết hiệu lực do giỏ thay đổi | E | P1 |
| CT05 | Ô nhập mã | Mặc định thu vào link "Nhập mã khác"; bấm thì mở và focus; mã sai báo lỗi rõ | E | P2 |
| CT06 | Gợi ý thêm sản phẩm ở giỏ | Đúng 2 sản phẩm còn hàng, rẻ, cùng nhóm, chưa có trong giỏ; không có sản phẩm hợp lệ thì ẩn khối | I | P1 |
| CT07 | Bấm thêm nhanh gợi ý, server trả lỗi hết hàng | Giỏ cập nhật ngay, sau đó hoàn lại và báo lỗi | E | P1 |
| CT08 | Checkout có flash + `V30K` + `VSHIP` | "Bạn đã tiết kiệm" = tổng 3 tầng, khớp chênh lệch tổng tiền server; chi tiết đơn hiện cùng số | I/E | P0 |
| CT09 | Client sửa giá `SP_A` trong localStorage giỏ | Thanh tiến độ và tự áp mã tính theo giá server, không theo giá client | I | P0 |

### 11.3. Trải nghiệm mobile (MB)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| MB01 | Thanh tab mobile trong / ngoài chiến dịch | 5 mục, "Ưu đãi" ở giữa, dẫn `/uu-dai`; chấm đỏ chỉ khi chiến dịch đang chạy; vẫn ẩn ở PDP, giỏ, checkout như cũ | E | P1 |
| MB02 | iPhone có tai thỏ và Android nhỏ (360px) | Vùng bấm ≥ 44px; chừa khoảng an toàn đáy; tab bar không đè thanh mua dính hay hộp chào mừng | M | P1 |
| MB03 | PDP `SP_A` trong khung flash, cuộn xuống | Thanh mua dính chỉ hiện khi nút mua chính khuất; có giá flash, đếm ngược, "Còn x suất" | E | P1 |
| MB04 | Bảng trượt (chọn voucher, hộp chào mừng) | Có nút X, vuốt xuống để đóng, giữ focus bên trong; desktop đóng bằng Esc | E | P2 |
| MB05 | Mạng chậm (3G giả lập) | Khung xương chờ đúng bố cục; không nhảy bố cục khi dữ liệu về (CLS < 0,1) | E | P2 |
| MB06 | Bấm "Lưu mã" khi voucher vừa hết lượt | Nút đổi "Đã lưu" ngay, sau đó hoàn lại "Hết lượt" và báo lỗi | E | P1 |

### 11.4. Admin danh sách, chiến dịch đang chạy và kiểm tra trước khi bật (DB)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| DB01 | Tab Chiến dịch ở `/admin/uu-dai`: bộ lọc "Đang chạy & sắp chạy" / "Tất cả" | Trạng thái bằng chữ ("Đang chạy · còn 2 ngày", "Sắp chạy · 01/10 00:00") tính theo giờ server; danh sách khớp DB | I/E | P1 |
| DB02 | Bấm "Tạm dừng" trên dòng chiến dịch / nút "Tạm dừng khẩn cấp" trên điện thoại | Hộp xác nhận nói rõ hậu quả; chỉ quản lý làm được; trang khách bỏ chiến dịch trong ≤ 40 giây; có audit | I/E | P0 |
| DB03 | Nhân bản chiến dịch | Tạo bản nháp mới với id mới, xoá ngày, bộ đếm = 0; voucher chỉ tham chiếu, không nhân bản | I | P1 |
| DB04 | Thẻ số liệu | Doanh thu không tính đơn huỷ / đơn test; mũi tên so hôm qua đúng; hôm qua = 0 thì hiện "—", không hiện Infinity / NaN | U/I | P1 |
| DB05 | Biểu đồ doanh thu theo giờ | Gộp theo giờ Asia/Ho_Chi_Minh; đánh dấu đúng khung `S09` / `S12` / `S20` | U | P2 |
| DB06 | Ô "Cần xử lý": số suất > tồn, voucher còn < 10% lượt, lệch bộ đếm, giá dưới giá vốn | Mỗi trường hợp hiện một câu việc cụ thể kèm nút đi thẳng tới chỗ sửa; xử lý xong thì mất; không có việc thì ghi "Mọi thứ ổn" | I/E | P1 |
| DB07 | Giai đoạn khởi động, xem số lượt "Nhắc tôi" theo sản phẩm | Khớp `campaign_stats` | I | P2 |
| DB08 | Màn "Kiểm tra & bật" có lỗi đỏ / chỉ có lưu ý vàng | Có lỗi đỏ: nút "Bật ngay" / "Hẹn giờ bật" khoá, bấm "Sửa" nhảy đúng ô. Chỉ lưu ý vàng: bật được sau khi xác nhận | U/E | P0 |
| DB09 | Preview chọn Khởi động / Ngày sale / Giờ chót, Desktop / Mobile | Giao diện giống trang khách ở thời điểm đó; preview không ghi bộ đếm, không đổi dữ liệu thật | E | P1 |
| DB10 | "Thao tác khác" → chọn 20 dòng, sửa hàng loạt "giảm 20%" | Giá làm tròn 1.000đ; dòng dưới giá vốn bị đánh dấu; chưa lưu cho đến khi xác nhận | U/E | P1 |
| DB11 | Cột "Lãi còn lại": có `giaVon` / thiếu `giaVon` / giá sale dưới giá vốn | Có: giá sale − giá vốn; thiếu: "Chưa có giá vốn", không hiện 0; lỗ: số đỏ | U | P1 |
| DB12 | Tắt 1 dòng flash khi đang chạy | Sản phẩm rời Sân khấu Flash Sale; đơn đang `held` vẫn giữ giá flash đến hạn | I | P1 |
| DB13 | Admin ở 1280px, 1440px và tablet | Không cuộn ngang ngoài bảng; nút hành động không bị che | M | P2 |

### 11.6. Admin dễ dùng (AU)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| AU01 | Nhân viên chưa từng dùng, không hướng dẫn: tạo chiến dịch từ mẫu "Đại lễ" có 3 sản phẩm giảm giá, 2 voucher, 1 quà, banner | Tự làm xong trong ≤ 10 phút, không hỏi người khác; ghi lại chỗ lúng túng để sửa | M | P1 |
| AU02 | Chưa có chiến dịch nào | Tab Chiến dịch hiện khối trống với các thẻ mẫu dịp lễ; bấm thẻ là vào bước 1 với dữ liệu điền sẵn | E | P1 |
| AU03 | Rà mọi màn tạo / sửa | Mỗi màn chỉ một nút chính màu xanh; mỗi bước có tiêu đề dạng câu hỏi | M | P1 |
| AU04 | Rà chữ trên giao diện admin chiến dịch | Không có từ kỹ thuật tiếng Anh (quota, claim, audience, slot, hold…); mỗi ô có hướng dẫn một dòng + ví dụ | M | P1 |
| AU05 | Mở màn tạo lần đầu | Chỉ thấy ô cần thiết; "Tuỳ chọn thêm" và "Tuỳ chỉnh nâng cao" thu gọn; bấm mở ra đủ chức năng | E | P2 |
| AU06 | Nhập sai (giá sale ≥ giá thường, ngày kết thúc trước ngày bắt đầu, bỏ trống tên) | Báo lỗi ngay cạnh ô bằng câu cụ thể; không bật hộp lỗi chung chung | E | P1 |
| AU07 | Đang sửa thì đóng tab / mất mạng 30 giây | Nháp tự lưu, hiện "Đã lưu lúc hh:mm"; rời trang khi chưa lưu thì hỏi lại; mở lại thấy đúng dữ liệu | E | P1 |
| AU08 | `ADMIN_NV` mở chiến dịch | Ô giá / số lượng / nút bật hiện khoá kèm dòng "Chỉ quản lý được sửa"; các phần được phép vẫn sửa được | E | P1 |
| AU09 | Bước 2 nhập "% giảm" = 38 cho `SP_A` | Ô giá sale tự thành 124.000đ; nhập giá sale thì % tự tính; lãi còn lại cập nhật ngay | U/E | P1 |
| AU10 | Bước 3: danh sách voucher | Hiện dạng vé giống khách thấy; voucher sỉ không có trong danh sách; voucher chưa bật "Khách phải bấm Lưu mã" có nút bật tại chỗ | E | P1 |

### 11.5. Chỉ dành cho khách lẻ (KL)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| KL01 | `isRetailBuyer` với `KHACH`, `KH_MOI`, `KH_CU`, `KH_SI`, `KH_SI_CHO`, `KH_CTV`, tài khoản có cả `si` và `ctv` | 3 đầu `true`; 4 sau `false` | U | P0 |
| KL02 | `KHACH` vào trang chủ lần đầu | Thấy thanh thông báo, banner chiến dịch, card ưu đãi, hộp chào mừng | E | P0 |
| KL03 | `KHACH` bấm "Lưu mã" / "Mua Ngay Giờ Vàng" | Mở bảng đăng nhập tại chỗ; đăng nhập bằng khách lẻ thì tự lưu mã / tiếp tục mua | E | P0 |
| KL04 | `KH_SI`, `KH_SI_CHO`, `KH_CTV` vào trang chủ, `/uu-dai`, PDP `SP_A` | Thấy giao diện chiến dịch; mọi nút Lưu mã / Thu thập tất cả / Mua Ngay Giờ Vàng / Nhắc tôi khoá, ghi "Dành cho khách lẻ"; hộp chào mừng không tự bật | E | P0 |
| KL05 | `KH_CTV` gọi thẳng API `claim` và `claim-batch` | 403 `retail_only`; ví không đổi; `claimedCount` không tăng | I | P0 |
| KL06 | `KH_SI_CHO` đặt `SP_A` trong khung flash | Đơn dùng giá hiện tại của tài khoản, không có `priceKind = flash`, bộ đếm suất không đổi | I | P0 |
| KL07 | `KH_CTV` đặt `SP_B` | Không có dòng quà `QUA_G`; quota quà không đổi | I | P0 |
| KL08 | `KH_SI` áp voucher chiến dịch (`V30K`) bằng API quote / tạo đơn | Không áp, lý do "Dành cho khách lẻ"; voucher ngoài chiến dịch vẫn theo quy tắc cũ | I | P0 |
| KL09 | Đăng xuất rồi đặt không đăng nhập bằng SĐT của `KH_SI` / email của `KH_CTV` | Xử lý như tài khoản đó: không quà, không voucher chiến dịch, không giá flash | I | P0 |
| KL10 | `KH_MOI` lưu `V30K` rồi được duyệt thành CTV | Mã vẫn nằm trong ví nhưng khoá "Dành cho khách lẻ", không áp được; `SP_A` giá flash trong giỏ được tính lại ở checkout | I/E | P1 |
| KL11 | Khách lẻ mua qua link CTV (`ref`) | Được giá flash và voucher chiến dịch; hoa hồng CTV tính trên tiền thực trả | I | P0 |
| KL12 | Admin thêm `VSI` vào kho voucher chiến dịch; preview "Xem như" 4 loại; báo cáo chiến dịch | Bước kiểm tra báo lỗi, không cho áp dụng; preview đúng từng loại tài khoản; số liệu không tính đơn của sỉ / CTV | I/E | P1 |

### 11.7. Trường hợp bổ sung sau rà soát (EX)

| Mã | Dữ liệu / thao tác | Kết quả bắt buộc | Loại | Mức |
|---|---|---|---|---|
| EX01 | Chiến dịch 01–03/10; ngày 01 bán hết 10 suất `SP_A` khung `S09`; sang 02/10 09:00 | Khung `S09` ngày 02 có lại 10 suất; `KH_MOI` đã mua 2 hôm trước vẫn mua được 2 | I | P0 |
| EX02 | Khung 22:00–01:00 có `SP_C`; mua lúc 23:59:59 và 00:30; thử lúc 01:00:00 | Hai lần đầu được giá flash, cùng một bộ đếm (ngày bắt đầu khung); 01:00:00 về giá thường | U/I | P0 |
| EX03 | `KH_MOI` đặt đơn 1 gồm 2 `SP_A`, rồi đơn 2 gồm 2 `SP_A`; sau đó huỷ đơn 1 và đặt lại | Đơn 2: 2 cái giá thường. Sau khi huỷ đơn 1: mua lại được 2 cái giá flash | I | P0 |
| EX04 | Bấm "Đặt hàng" 2 lần liên tiếp / mạng rớt rồi gửi lại cùng `idempotencyKey` (đơn có flash + `V30K`) | Đúng 1 đơn; `held` +1 lần; ví `V30K` giữ 1 lần | I | P0 |
| EX05 | Đã áp `VSHIP` ở checkout, khách đổi sang địa chỉ Bình Dương / chọn nhận tại cửa hàng | Tự bỏ `VSHIP`, hiện lý do, tổng tiền cập nhật ngay; `V30K` vẫn giữ | I/E | P0 |
| EX06 | Nhập tay mã của `V30K` (voucher phải lưu) khi chưa lưu: còn lượt / hết lượt | Còn lượt: tự lưu vào ví rồi áp, `claimedCount` +1. Hết lượt: báo "Voucher đã hết lượt", không áp | I | P1 |
| EX07 | Đang chạy: tăng suất `SP_A` 10 → 15; giảm xuống dưới đã bán + đang giữ; đổi giá sale 124.000đ → 120.000đ khi có đơn đang giữ | Tăng: có hiệu lực ngay. Giảm dưới mức: bị chặn, báo rõ con số. Đổi giá: đơn đang giữ vẫn 124.000đ, đơn mới 120.000đ | I | P0 |
| EX08 | Admin sửa tổng lượt `V30K` (đã lưu 3) thành 2 / thành 5 | 2: bị chặn "Đã có 3 khách lưu". 5: mở thêm 2 lượt ngay | I | P1 |
| EX09 | Kết thúc sớm chiến dịch lúc 15:00 / kéo dài thêm 1 ngày | Hộp xác nhận nói rõ hậu quả. Kết thúc sớm: giá về thường trong ≤ 40 giây, đơn đang giữ giữ giá tới hạn. Kéo dài: đếm ngược và thanh thông báo cập nhật | I/E | P0 |
| EX10 | Xoá chiến dịch đã có đơn / xoá bản nháp chưa bật | Đã có đơn: không có nút xoá, chỉ "Lưu trữ"; báo cáo vẫn xem được. Bản nháp: xoá được | I | P1 |
| EX11 | `QUA_G` vừa là quà của `SP_B` vừa nằm trong danh sách flash (quota 5) | Dòng quà 0đ không trừ suất flash của `QUA_G`; khách mua `QUA_G` trực tiếp mới trừ suất | I | P1 |
| EX12 | Voucher giảm 10% trên tiền hàng 333.333đ; giỏ nhiều dòng flash | Làm tròn đến đồng ở một chỗ; tổng trên web, trong đơn và trên KiotViet bằng nhau, không lệch 1đ | U/I | P0 |
| EX13 | Voucher giảm 50.000đ chỉ áp cho nhóm hàng có tiền hàng đủ điều kiện 40.000đ | Giảm tối đa 40.000đ; tổng đơn không âm | U | P0 |
| EX14 | Tài khoản bị khoá khi đã lưu `V30K` và có `SP_A` giá flash trong giỏ | Không lưu thêm mã, không mua giá flash, không áp voucher; báo lý do rõ | I | P1 |
| EX15 | Admin bấm "Xác nhận thanh toán" tay cho đơn flash, cùng lúc có xác nhận tự động từ ngân hàng | Suất `held → sold` và ví `held → used` đúng 1 lần | I | P0 |
| EX16 | Đơn COD có flash + quà, đẩy KiotViet lỗi, sau đó admin bấm "Thử đẩy lại" | Suất vẫn giữ trong lúc chờ; đẩy lại thành công thì KiotViet có đúng giá 124.000đ và dòng quà 0đ kèm `note`; huỷ / hết hạn thì nhả | I | P0 |
| EX17 | Nhân viên sửa đơn trên KiotViet (giảm `SP_A` 2 → 1, bỏ dòng quà) rồi bấm "Đồng bộ tiền từ KV" | Nhả 1 suất flash, trả 1 suất quà; dòng "Bạn đã tiết kiệm" tính lại; không bộ đếm nào âm | I | P0 |
| EX18 | Hoàn 1 sản phẩm (`mark-returned` theo mã) trong đơn có flash + `V30K` + quà + CTV | Suất đã bán không mở lại; tiền `V30K` chia theo tỉ lệ dòng; quà theo chính sách; hoa hồng CTV thu hồi đúng phần hoàn | I | P0 |
| EX19 | Xoá đơn test (`purge-test`) có flash, voucher, quà | Nhả đủ suất, lượt voucher, suất quà; báo cáo chiến dịch không còn tính đơn này | I | P1 |
| EX20 | Chiến dịch có 200 sản phẩm | `/uu-dai` tải dần theo trang, LCP mobile ≤ 2,5 giây; bảng admin 200 dòng không giật; `current` p95 ≤ 300ms | I/E | P1 |
| EX21 | Đọc Thể lệ trên `/uu-dai` | Có quyền huỷ đơn do lỗi giá và chính sách trả quà khi hoàn hàng, viết dễ hiểu | M | P1 |
| EX22 | Chiến dịch A kết thúc 23:59, chiến dịch B bắt đầu 00:00, cùng có `SP_A` | Không chồng giá; bộ đếm của A và B tách riêng; 00:00 card đổi sang giá của B | I | P1 |

## 12. Điều kiện hoàn thành

- **Theo từng giai đoạn:** chỉ deploy một giai đoạn khi mọi ca **P0 và P1** của giai đoạn đó "Đạt":
  - Bước 0: RF;
  - Phần 1: CP, UI (trừ phần ví và flash), AD liên quan, TS01, TS05–TS07, TS09, TS12, MB01, MB02, KL01, KL02, KL04;
  - Phần 2: WL, UI22–24, TS02–TS04, TS08, TS13, CT, MB04–MB06, KL03, KL05, KL08–KL10, EX05, EX06, EX08, EX12–EX14;
  - Phần 3: FS, WK, SG, PF03, TS10, TS11, TS14–TS19, MB03, KL06, KL11, EX01–EX04, EX07, EX09, EX15, EX22;
  - Phần 4: GF, KL07, EX11, EX16–EX19;
  - Phần 5: DB, AU, EX10, EX20, EX21 và phần còn lại.
- **Trước khi đóng kế hoạch:** 100% ca P0, P1, P2 "Đạt". Không bỏ qua ca nào. Ca nào không áp dụng thì ghi lý do và phải có người duyệt.
- **Chỉ số phải bằng 0:**
  - bán vượt quota;
  - vượt lượt phát voucher;
  - đơn trùng;
  - lệch bộ đếm sau đối soát;
  - lỗi 5xx trong PF02 / PF03.
- **Test tự động:** `npm test` và `npm run typecheck` đạt, `scripts/check-max-lines.cjs` đạt. Ca tranh chấp (WL03, WL04, FS08, FS09, WK01–WK04, EX03, EX04, EX15) chạy trên Mongo thật, không dùng collection giả.
- **Bằng chứng mỗi ca:** mã ca, `runId`, môi trường, dữ liệu vào, kết quả mong đợi / thực tế, ảnh chụp hoặc log, người chạy, người duyệt.
- Không đánh dấu hoàn thành chỉ vì code đã viết hoặc test mock đạt.

## 13. File test tự động dự kiến (mỗi file ≤ 800 dòng)

- `tests/campaign-schema.test.ts` — CP02, SEC01, SEC02, AD04, AD08.
- `tests/campaign-publish.test.ts` — CP01, CP03–CP13.
- `tests/voucher-wallet.test.ts` — WL01, WL02, WL07–WL18, WL22–WL29.
- `tests/voucher-wallet-race.test.ts` — WL03–WL05 (Mongo thật).
- `tests/flash-pricing.test.ts` — FS01–FS07, FS10, FS17, FS18, FS21, FS23, FS28.
- `tests/flash-counters-race.test.ts` — FS08, FS09, FS11–FS16 (Mongo thật).
- `tests/gift-lines.test.ts` — GF01–GF07.
- `tests/kv-gift-payload.test.ts` — GF08.
- `tests/campaign-worker.test.ts` — WK01–WK07, CP05.
- `tests/campaign-safeguards.test.ts` — SG01–SG06, SEC03–SEC06, AD02, AD03, AD05.
- `tests/campaign-phases.test.ts` — TS01, TS03, TS06–TS11, TS13, TS14, TS16, TS17.
- `tests/cart-nudges.test.ts` — CT01–CT03, CT06, CT08, CT09.
- `tests/campaign-dashboard.test.ts` — DB01–DB08, DB10–DB12.
- `tests/campaign-retail-only.test.ts` — KL01, KL05–KL09, KL11, KL12 (phần kiểm tra trước khi áp dụng).
- `tests/campaign-edge-cases.test.ts` — EX01–EX08, EX10–EX19, EX22 (EX01–EX04, EX15 chạy Mongo thật).
- Ca loại E / M: chạy theo checklist này trên staging, ghi kết quả vào bảng theo dõi.
