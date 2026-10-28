# Báo cáo kiểm thử Aloha Shop — 17/10/2026

## A. Tổng quan điều hành

**Shop chưa đủ bằng chứng để xác nhận sẵn sàng production.** Đợt kiểm tra đã chạy ứng dụng thật, thao tác trình duyệt, gọi API thật trên dữ liệu QA, chụp ảnh và lưu trace. Đã xác nhận **19 nhóm lỗi: 5 High, 13 Medium, 1 Low; chưa tái hiện lỗi sản phẩm mức Critical**. Các cảnh báo dependency mức Critical và cấu hình JWT có điều kiện được ghi riêng, không cộng vào số lỗi đã khai thác/tái hiện.

**Theo yêu cầu cuối cùng của người dùng, đợt này chỉ kiểm tra và báo cáo; chưa sửa mã ứng dụng.** Các thay đổi phục vụ kiểm thử nằm trong test/harness/report/artifact. Giữ nguyên thay đổi local đã có; không commit hoặc push.

### Môi trường và phiên bản

| Hạng mục | Môi trường thực tế |
|---|---|
| Frontend / API | Frontend production build tại `127.0.0.1:3302`; server backend gốc tại `127.0.0.1:3301` với clean QA env, `NODE_ENV=development`; không đại diện cấu hình production HTTPS |
| Mã kiểm tra | Git `103f161` cùng các thay đổi local có sẵn; build ID `d8LmjtmqgqU_02rZzzdEV` |
| Runtime / framework | Windows, Node **25.8.1**, Next.js **15.5.24**, React **19.2.8**; repository định hướng Node 22, nên chưa chứng minh tương đương runtime production |
| Công cụ trình duyệt | Playwright **1.64.0**; Chromium **156.0.8078.4** (revision 1248), Firefox **157.0** (1555), WebKit **27.2** (2370) |
| Dữ liệu | Mongo riêng `aloha_shop_test_enterprise_20261017`; tài khoản khách lẻ, CTV, sỉ HCM, sỉ tỉnh, admin và tài khoản probe riêng; sản phẩm/voucher/nội dung/đơn QA tổng hợp |
| Cô lập | Guard giới hạn DB QA và HTTP loopback; tắt credential đối tác, worker thanh toán/vận chuyển/đồng bộ, email và ngân hàng thật |

Frontend build và TypeScript đã chạy thành công. Quá trình build có cảnh báo nhiều lockfile và retry tải font `ECONNRESET`, sau đó hoàn tất exit 0, tạo 49/49 trang static. Không sửa `.env` hoặc source để vượt qua build. Chi tiết: [môi trường](artifacts/enterprise-qa-2026-10-17/ENVIRONMENT.md), [kết quả build/typecheck/test](artifacts/enterprise-qa-2026-10-17/checks/CHECKS_REPORT.md).

### Kết quả thực thi và cách đếm

| Bộ kiểm tra | Đã chạy | Đạt | Lỗi | Bỏ qua | Ghi chú |
|---|---:|---:|---:|---:|---|
| Playwright baseline | 137 | 103 | 34 | 0 | Kết quả raw được giữ nguyên; 34 test lỗi không đồng nghĩa 34 lỗi sản phẩm |
| Playwright mở rộng | 35 | 19 | 16 | 0 | Kết quả raw trước kiểm tra lại; có lỗi helper/locator bên cạnh lỗi sản phẩm |
| Playwright kiểm tra lại có mục tiêu | 26 | 21 | 5 | 0 | Raw lần kiểm tra lại thứ nhất; 5 lỗi còn do flow dialog/redirect/sidebar trong bộ QA |
| Playwright bổ sung sau đối chiếu flow thực tế | 10 | 10 | 0 | 0 | Voucher 3 engine, redirect Firefox, admin WebKit và catalog có dữ liệu ở 5 viewport |
| Playwright bảo mật trên route thật | 3 | 0 | 3 | 0 | Ba assertion chống thực thi script đều thất bại, xác nhận SEC-001–003 |
| **Tổng lượt thực thi browser, gồm lần chạy lại** | **211** | **153** | **58** | **0** | Giữ nguyên cả lỗi ban đầu; không phải 211 ca độc lập hoặc 58 bug |

| Bộ kiểm tra khác | Kết quả đã thực thi |
|---|---|
| Node unit/integration — 180 file | **1.082 ca: 1.065 đạt, 9 lỗi, 8 bỏ qua**, 0 hủy; concurrency 2; có Mongo test riêng |
| Node kiểm tra lại địa chỉ KiotViet | **4/4 đạt** sau khi sửa URL giả trong harness QA; không sửa ứng dụng. Còn 8 assertion bảo trì test ở 5 file |
| API nghiệp vụ thật trên DB QA | **43 lượt assertion**, 35 trường hợp riêng biệt: kết quả cuối **33 đạt, 2 lỗi High** |
| Python nginx/rollback | **5/5 đạt**, dùng dịch vụ giả |
| Backend TypeScript / frontend TypeScript | **Đạt / đạt**. Lệnh `lint` frontend hiện là `tsc --noEmit`, không có bộ ESLint riêng được cấu hình |
| Production build | **Đạt**, exit 0; 49/49 static pages |

Có **175 tổ hợp test definition × project/browser**. Năm lần đo catalog với danh mục đã có dữ liệu là trạng thái đối chứng khác năm lần danh mục rỗng ban đầu, nên được giữ riêng: **180 tổ hợp kịch bản/trạng thái, kết quả cuối 151 đạt, 29 lỗi, 0 bỏ qua**. 29 kết quả lỗi còn gồm 5 layout fallback, 14 axe scans, 2 reduced-motion checks, 3 dialog-focus checks, 2 cart-reload checks và 3 XSS checks. Đây không phải 29 lỗi sản phẩm độc lập. Không thay kết quả fallback lỗi bằng đối chứng có dữ liệu đạt. [Tổng hợp có mọi lượt chạy và biến thể](artifacts/enterprise-qa-2026-10-17/browser-summary.json).

Các probe đối chứng, ảnh bằng chứng và phép đo DOM không được tự chuyển thành số test đạt. Giữ cả lỗi ban đầu do fixture/harness: nhãn nút admin sai, helper chuyển toàn bộ trang làm mất timer lưu giỏ, fixture danh mục rỗng, cấu hình ví/campaign QA, URL token giả, redirect CTV, sidebar admin mobile và locator chưa đi đúng dialog nhận voucher. Chỉ sửa hạ tầng kiểm thử. Firefox có thể hủy document khi redirect xác thực; test chỉ chấp nhận đúng `NS_BINDING_ABORTED`, rồi vẫn bắt buộc URL đăng nhập admin, form visible và API từ chối quyền. Không bỏ assertion phân quyền.

### Phạm vi có bằng chứng và giới hạn bao phủ

Đã khám phá **54 pattern trang, 8 pattern động, 1 Next route handler, 2 route metadata và 287 khai báo tuyến HTTP backend**. Phân tích AST tìm thấy 745 vị trí khai báo nút, 284 link, 25 form, 412 trường nhập và 44 dialog/drawer trong source frontend. **Đây là số khai báo tĩnh, không phải số nút hoặc endpoint đã được thao tác và nghiệm thu.** Chưa kiểm tra mọi tổ hợp trang × vai trò × trạng thái × kích thước × trình duyệt.

Các luồng đã được thực thi gồm tìm kiếm/cảnh báo rỗng, thao tác giỏ và đăng nhập, validation đăng ký, chia sẻ sản phẩm, truy cập theo vai trò, tạo đơn QA, voucher/giá server, quy tắc sỉ HCM/tỉnh, trạng thái admin, responsive, axe, bàn phím và ba phép đo hiệu năng lab. API xác nhận giá cùng SKU: khách lẻ/CTV 100.000đ, hai nhóm sỉ 70.000đ; sỉ đủ điều kiện đặt 30 × 70.000đ − voucher 50.000đ = 2.050.000đ. Chặn điện thoại `abc`, số lượng 1,5, giá giả 1đ và cùng idempotency key nhưng đổi phường; gửi lại đúng nội dung không nhân đôi đơn.

Danh sách chi tiết: [route và tương tác](artifacts/enterprise-qa-2026-10-17/checks/route-inventory.md), [JSON đầy đủ](artifacts/enterprise-qa-2026-10-17/checks/route-inventory.json), [báo cáo API](artifacts/enterprise-qa-2026-10-17/API_REPORT_SECTION.md). CRUD sâu của admin, mọi cấu hình chiến dịch, mọi trạng thái đơn/hoa hồng và mọi nút chưa được tuyên bố bao phủ đầy đủ.

## B. Danh sách lỗi đã xác nhận

Tất cả lỗi sản phẩm dưới đây **chưa được sửa**, theo phạm vi report-only. Bảng gộp các biểu hiện cùng nguyên nhân; `VIS-001` trong báo cáo visual tương ứng `QA-RESP-01`, không đếm hai lần.

### B1. High — nghiệp vụ và bảo mật

| ID / mức độ | Route, thành phần và tái hiện | Mong đợi → thực tế | Nguyên nhân đã xác định | Sửa, xác minh và bằng chứng |
|---|---|---|---|---|
| **QA-STATE-01 — High** | Tạo đơn QA `cho_xac_nhan`, phương thức `Pending`, chưa thu tiền; admin gọi `POST /api/shop/admin/orders/:id/mark-shipping` | Chặn đơn review chưa xong bước xác nhận/phương án thanh toán → trả **200**, chuyển `dang_giao` trong khi vẫn unpaid/0 | Guard loại trừ hoàn thành/hủy và backorder nhưng thiếu điều kiện chuyển trạng thái của đơn review thông thường | **Chưa sửa; tái hiện API thật; còn mở.** [Chi tiết và mã đơn](artifacts/enterprise-qa-2026-10-17/API_REPORT_SECTION.md), [raw API](artifacts/enterprise-qa-2026-10-17/api-audit.json) |
| **QA-STATE-02 — High** | Tạo đơn review `Pending/unpaid/0`, chưa đang giao; admin gọi `POST /api/shop/admin/orders/:id/mark-delivered` | Chặn hoàn tất/trừ kho khi chưa đủ điều kiện giao nhận và phương án thanh toán/COD hợp lệ → **200**, `hoan_thanh`, `stockApplied: true`, tồn **500 → 498**, vẫn unpaid/0 | Hàm hoàn tất thiếu kiểm tra trạng thái trước và điều kiện hoàn tất của đơn review `Pending` | **Chưa sửa; kiểm tra trước/sau trong Mongo QA; còn mở.** [Chi tiết](artifacts/enterprise-qa-2026-10-17/API_REPORT_SECTION.md), [raw API](artifacts/enterprise-qa-2026-10-17/api-audit.json) |
| **SEC-001 — High** | `/bai-viet/[slug]`; editor/admin lưu HTML có SVG với cú pháp `<svg/onload=...>` đặt marker vô hại, rồi mở bài công khai trong context không đăng nhập | HTML hoạt động bị loại bỏ → API lưu 200, trang công khai 200 và marker JavaScript thực thi | Regex sanitizer yêu cầu khoảng trắng trước thuộc tính, trong khi HTML parser chấp nhận dấu `/`; bypass cả lọc tag và event | **Chưa sửa; Playwright route thật thất bại như mong đợi của test phát hiện lỗi; còn mở.** [Bảo mật chi tiết](artifacts/enterprise-qa-2026-10-17/security/security-findings.md), [kết quả](artifacts/enterprise-qa-2026-10-17/security/playwright-security-results.json) |
| **SEC-002 — High** | `/tuyen-dung/[slug]`; manager lưu/publish mô tả tuyển dụng QA có SVG `onload`, sau đó khách mở trang | Giữ rich text an toàn → create 201/publish 200; trang công khai thực thi marker | Các trường rich HTML chỉ trim/giới hạn độ dài; helper hiển thị không sanitize; render bằng `dangerouslySetInnerHTML` | **Chưa sửa; tái hiện save-to-public-route; còn mở.** [Bảo mật chi tiết](artifacts/enterprise-qa-2026-10-17/security/security-findings.md), [kết quả](artifacts/enterprise-qa-2026-10-17/security/playwright-security-results.json) |
| **SEC-003 — High** | Product detail / `ProductJsonLd.tsx`; tên sản phẩm QA do nguồn catalog có quyền ghi chứa dấu kết thúc `</script>` và script marker | Giá trị vẫn là dữ liệu trong JSON-LD → trang sản phẩm công khai thực thi marker | Ghi trực tiếp `JSON.stringify(data)` vào HTML script; không escape `<` nên HTML parser kết thúc script sớm | **Chưa sửa; tái hiện public product route; còn mở.** [Chi tiết và source](artifacts/enterprise-qa-2026-10-17/security/security-findings.md), [kết quả](artifacts/enterprise-qa-2026-10-17/security/playwright-security-results.json) |

Hai lỗi trạng thái được xác nhận trên đơn **review chưa chốt phương án thanh toán**; không suy ra mọi đơn COD chưa thu tiền đều phải bị cấm giao. Ba lỗi XSS cần nguồn nhập nội dung/catalog có quyền ghi; chưa chứng minh khách ẩn danh có thể sửa nội dung. Probe chỉ đặt marker trong browser QA, không lấy dữ liệu hoặc tác động tài khoản thật.

### B2. Medium — luồng sử dụng và responsive

| ID / mức độ | Route, thành phần và tái hiện | Mong đợi → thực tế | Nguyên nhân đã xác định | Sửa, xác minh và bằng chứng |
|---|---|---|---|---|
| **QA-CART-01 — Medium** | Khách đăng nhập, server cart rỗng; thêm sản phẩm rồi tải lại/chuyển toàn bộ trang trước kỳ đồng bộ; probe bắt đầu chuyển sau 292 ms | Dòng đã thêm được giữ → local có qty 1/selected true rồi bị ghi đè thành giỏ rỗng, “Mua hàng (0)” | PUT debounce 700 ms bị mất khi đổi tài liệu; lần khởi tạo sau hydrate server cũ đè thay đổi local chưa gửi | **Chưa sửa; tái hiện và có đối chứng.** Header cart link nội bộ giữ dòng, PUT 200, nút mua bật. [Chi tiết](artifacts/enterprise-qa-2026-10-17/FUNCTIONAL_BUGS.md), [JSON/ảnh](artifacts/enterprise-qa-2026-10-17/checks/uncertain-browser-probes.json) |
| **QA-RESP-01 — Medium** | `/tim` khi category-tree rỗng/chưa tải/lỗi; viewport 320 px; giả lập riêng API danh mục 503 | Preset giá cuộn trong hàng/ở trong khung → hàng 270 px chứa 900 px, `overflow-x:visible`, không cuộn chính hàng; nút cuối nằm ngoài khung; document 925 px | Nhánh dự phòng `CatalogSubcatBar` render cả fragment giá trong flex thường, bỏ qua `CatalogChipRow` | **Chưa sửa; tái hiện có điều kiện.** Không kết luận catalog đầy đủ luôn lỗi. [Chi tiết](artifacts/enterprise-qa-2026-10-17/FUNCTIONAL_BUGS.md), [số đo](artifacts/enterprise-qa-2026-10-17/checks/category-failure-responsive.json), [ảnh](artifacts/enterprise-qa-2026-10-17/checks/category-failure-responsive-320.png) |
| **QA-SEARCH-01 — Medium** | `/tim`, `HeaderSearch.tsx`; giữ chunk JS, để HTML/CSS hiện input; nhập query và Enter trước hydration | Giữ/gửi query hoặc chờ sẵn sàng → native navigation `/tim?`, query thiếu và input trống | Form chỉ dựa vào React `onSubmit`; input không có `name=q`, thiếu fallback gửi tìm kiếm native | **Chưa sửa; probe tải JS chậm tái hiện.** Hai đối chứng search bình thường giữ query; không kết luận mọi search đều lỗi. [Chi tiết](artifacts/enterprise-qa-2026-10-17/FUNCTIONAL_BUGS.md), [JSON](artifacts/enterprise-qa-2026-10-17/checks/delayed-js-search.json), [ảnh](artifacts/enterprise-qa-2026-10-17/checks/delayed-js-search-after-submit.png) |

### B3. Accessibility — 8 nhóm axe Medium, 2 nhóm bàn phím Medium, 1 nhóm motion Low

Mỗi nhóm dưới đây còn mở, chưa sửa ứng dụng. Tái hiện axe bằng mở route ở 375/1440 px và chạy tags WCAG 2/2.1/2.2 A/AA như spec. Source, selector, node HTML và failure summary đầy đủ nằm trong [review accessibility](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.md) và [JSON từng node](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.json).

| ID / mức độ | Route/thành phần; cách tái hiện | Mong đợi → thực tế; nguyên nhân | Sửa / xác minh |
|---|---|---|---|
| **QA-A11Y-01 — Medium** | Search desktop trên `/`, `/tim`, PDP, đăng ký sỉ, bài viết; axe `aria-allowed-attr` | Role/ARIA autocomplete nhất quán → `aria-expanded` gắn vào input textbox thiếu quan hệ role phù hợp; `HeaderSearch.tsx` | Chưa sửa; 5 scan/5 node; đã xác nhận DOM/axe |
| **QA-A11Y-02 — Medium** | Quantity input PDP; axe `label` ở hai chiều rộng | Trường mua hàng có tên truy cập → nhãn “Số lượng mua” là div, chưa liên kết input bằng label/ARIA; `ProductQuantityPicker.tsx` | Chưa sửa; 2 scan/2 node |
| **QA-A11Y-03 — Medium** | Cả 7 route axe; kiểm tra màu chữ/nền | Text thường đạt contrast phù hợp kích thước → ví dụ **2,63:1**, **3,66:1**, **4,22:1** dưới 4,5:1; palette/text token nhạt | Chưa sửa; 14 scan/385 node occurrences. Kết quả sát ngưỡng cần kiểm tra compositing riêng |
| **QA-A11Y-04 — Medium** | Home mobile, dots quà tặng; axe `aria-hidden-focus` | Control focusable hiện trong cây truy cập → wrapper `aria-hidden` vẫn chứa nút slide; `HomeGiftSection.tsx` | Chưa sửa; 1 scan/1 node wrapper |
| **QA-A11Y-05 — Medium** | Search trigger/map/footer/CTA storefront; axe `label-content-name-mismatch` | Tên truy cập chứa nội dung nhãn hiển thị → nhãn bị thay bởi aria-label khác; ví dụ search visible “Tìm sản phẩm…” và tên “Mở tìm kiếm sản phẩm” | Chưa sửa; 10 scan/29 node occurrences. Một số logo/whitespace cần xác minh manual; không đếm riêng từng node |
| **QA-A11Y-06 — Medium** | Home service/trust scrollers; axe `scrollable-region-focusable` | Người dùng bàn phím tiếp cận vùng cuộn → vùng được báo thiếu điểm focus/child focusable | Chưa sửa; 2 scan/3 node |
| **QA-A11Y-07 — Medium** | Hero home desktop; axe `target-size` trên `Banner 1`–`Banner 4` | Hit target/khoảng cách đạt yêu cầu → inactive dots khoảng **6,1 × 6,1 px**, khoảng cách không đủ | Chưa sửa; 1 scan/4 node |
| **QA-A11Y-08 — Medium** | Mọi route axe; kiểm tra viewport metadata | Không hạn chế khả năng phóng to → `maximum-scale=1`, `user-scalable=no` tại root layout | Chưa sửa; 14 scan/14 node. Hành vi pinch zoom trên thiết bị thật chưa được nghiệm thu; browser có thể ghi đè |
| **A11Y-MANUAL-001 — Medium** | `/tim` 320 px; mở menu, Tab qua control, Escape rồi nút đóng | Focus nằm trong overlay và được trả về trigger → focus còn ở nền/bị che, Tab tới nền; Escape không đóng; đóng bằng nút visible đưa focus về BODY | Chưa sửa; probe bàn phím xác nhận. `SiteChrome` thiếu quản lý/giới hạn/khôi phục focus. [Probe](artifacts/enterprise-qa-2026-10-17/security/menu-keyboard-probe.json) |
| **A11Y-MANUAL-002 — Medium** | Dialog ứng tuyển; mở “Ứng tuyển ngay”, focus nút “Đóng” cuối rồi Shift+Tab | Focus còn trong modal → `dialog.contains(activeElement)` false | Chưa sửa; đã có failure Chromium/Firefox/WebKit trong suite mở rộng; `ApplyDialog` không giữ focus ở đường Tab ngược. [Review/evidence](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.md) |
| **QA-MOTION-01 — Low** | Home, bật `prefers-reduced-motion: reduce`; đọc animation chạy | Giảm chuyển động liên tục → ping **1000 ms/infinite** vẫn chạy tại `.animate-ping`; `HomeTrustShowcase.tsx` | Chưa sửa; 2 custom checks lỗi. Đây là lỗi preference/UX, chưa dùng riêng nó để kết luận vi phạm WCAG AA |

### B4. Các phát hiện cần phân loại riêng

**SEC-004 — High nếu thiếu cấu hình:** staff JWT secret trả fallback phát triển ngay cả trong process `production` khi biến môi trường thiếu; shop JWT đã fail-closed. Hành vi hàm được tái hiện cô lập; **chưa kiểm tra secret production, chưa chứng minh hệ thống live đang dùng fallback hoặc token có thể giả mạo trên live**. Chưa sửa. [Điều kiện, source và probe](artifacts/enterprise-qa-2026-10-17/security/security-findings.md).

`npm audit` thực thi thành công, exit 1 vì có cảnh báo trên API/frontend; QA browser exit 0. Đây là số **package bị ảnh hưởng**, gồm transitive/effect entries, không phải số exploit hoặc CVE độc lập:

| Phạm vi | Full: Critical / High / Moderate | Tổng full | Runtime: Critical / High / Moderate | Tổng runtime |
|---|---:|---:|---:|---:|
| Root/API | 3 / 1 / 7 | 11 | 1 / 1 / 7 | 9 |
| Frontend | 0 / 3 / 1 | 4 | 0 / 3 / 1 | 4 |
| Browser QA | 0 / 0 / 0 | 0 | 0 / 0 / 0 | 0 |

`proxy-addr` phụ thuộc cấu hình trust subnet; source mặc định loopback. Cảnh báo `sharp` cần xét Linux/native binary và đường nhập SVG; chưa chứng minh RCE trên Windows hoặc production. `shell-quote`/`concurrently` là dev-only. Một số advisory Next phụ thuộc Pages Router/root catch-all không thấy trong app này. Chưa chạy `npm audit fix` hoặc thay dependency. Phân tích applicability và nguồn advisory chính thức nằm trong [báo cáo bảo mật](artifacts/enterprise-qa-2026-10-17/security/security-findings.md).

**5 khoảng trống bảo trì test — Low:** mock drag/drop của gift picker (3 assertion); mock `useShopAuth` (1); kỳ vọng inline style mobile tab cũ (1); mock `giftProductSelection` (2); mock `zod` cho checkout sỉ (1). Tổng 8 assertion ở 5 file; không cộng vào lỗi sản phẩm. Chưa sửa/xóa/disable các test đó. [Chi tiết CHECK-01–05](artifacts/enterprise-qa-2026-10-17/FUNCTIONAL_BUGS.md), [raw TAP](artifacts/enterprise-qa-2026-10-17/checks/node-tests.tap).

## C. Responsive và kiểm tra trực quan

Baseline đã đọc **63 phép đo trang = 9 route × 7 chiều rộng**, cộng 7 bài navigation riêng. Chưa có mẫu thiết kế được phê duyệt để so sánh. Review thủ công 20 ảnh đại diện: home, catalog, PDP và đăng ký ở 320/375/768/1440/1920 px; chủ yếu vùng đầu 1.100 px, cùng ảnh lỗi 1024 px và menu. Không tuyên bố đã xem thủ công mọi pixel của tất cả full-page screenshots.

| Viewport | Trang đo | Root width trong khung | Ảnh lỗi đo được | Kết luận baseline |
|---:|---:|---:|---:|---|
| 320 | 9 | 8/9 | 0 | `/tim` category fallback rộng 925 px |
| 375 | 9 | 8/9 | 0 | Cùng fallback rộng 925 px |
| 430 | 9 | 8/9 | 0 | Cùng fallback rộng 925 px |
| 768 | 9 | 8/9 | 0 | Fallback rộng 1027 px |
| 1024 | 9 | 8/9 | 0 | Fallback rộng 1027 px |
| 1440 | 9 | 9/9 | 0 | Không lỗi root width trong 9 trang được đo |
| 1920 | 9 | 9/9 | 0 | Không lỗi root width trong 9 trang được đo |

Sau baseline, fixture danh mục được sửa đúng collection và có 2 roots/3 nodes. Điều đó là thay đổi dữ liệu QA; không sửa ứng dụng. Probe category API 503 vẫn tái hiện QA-RESP-01. Các carousel có slide nằm ngoài viewport nhưng root width đúng, và phần trang trí bị cắt có chủ đích, không tự coi là lỗi tràn trang.

| Kiểm tra bổ sung | Kết quả thực thi cuối |
|---|---|
| 14 ca layout admin/CTV tại 7 chiều rộng | **14/14 đạt** sau sửa helper chờ đúng redirect CTV; menu admin mobile mở và đóng bằng Escape |
| Catalog có cây danh mục, 320/375/430/768/1024 px | **5/5 đạt**, không tràn root và không ảnh hỏng trong trạng thái này; lỗi fallback QA-RESP-01 còn mở |
| Navigation theo viewport | Kết quả cuối **7/7 đạt** bằng điều khiển đóng visible; lỗi focus bàn phím vẫn còn |

Tổng cộng có **82 phép đo layout** được lưu: 63 baseline, 14 admin/CTV, 5 catalog có danh mục; **77 đạt root width, 5 lỗi fallback**, không thấy ảnh hỏng trong các phép đo này. Trạng thái loading/ảnh chưa được tải ngoài phạm vi đo không được suy thành đạt.

Menu mở/đóng bằng control visible đã hoạt động ở 320/375/430 px. Lỗi kiểm thử bấm lại trigger bị drawer che không chứng minh người dùng không thể đóng menu; lỗi focus/keyboard riêng vẫn còn. Ảnh PDP đang loading/giảm opacity không đủ chứng minh nút mua hỏng. Hero autoplay có thể đổi slide giữa hai ảnh. Ảnh sản phẩm là fixture tổng hợp, và media ngoài bị chặn, nên chưa nghiệm thu chất lượng ảnh/CDN thật. [Ảnh, selector, review chi tiết](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.md), [mọi số đo](artifacts/enterprise-qa-2026-10-17/layout-summary.json).

## D. Tương thích trình duyệt

Đã chạy đủ ba engine. Bảng dưới là **baseline chức năng/vai trò 16 ca mỗi engine**, giữ nguyên trước các kiểm tra lại có mục tiêu:

| Engine | Đạt | Lỗi | Bỏ qua | Phạm vi |
|---|---:|---:|---:|---|
| Chromium | 13 | 3 | 0 | Desktop 1440 px |
| Firefox | 12 | 4 | 0 | Desktop 1440 px |
| WebKit | 13 | 3 | 0 | Emulation iPhone 13; chưa thay cho Safari trên iPhone thật |

Các failure ban đầu gồm vấn đề fixture/locator/timing và lỗi sản phẩm; chỉ bug có bằng chứng tái hiện được đưa vào mục B. Kết quả kiểm tra lại nằm ở bảng A cuối cùng, không ghi đè raw baseline. Bảo mật XSS được xác minh trên Chromium; chưa chạy ba payload đó trên Firefox/WebKit. Phép scan axe dùng Chromium ở hai chiều rộng.

Kết quả cuối của **23 ca chức năng/vai trò/mở rộng trên mỗi engine**, sau kiểm tra lại nhóm bị ảnh hưởng bởi harness:

| Engine | Đạt | Lỗi còn mở | Ca lỗi |
|---|---:|---:|---|
| Chromium | 21 | 2 | Focus dialog ứng tuyển; giỏ mất khi reload ngay |
| Firefox | 22 | 1 | Focus dialog ứng tuyển |
| WebKit | 21 | 2 | Focus dialog ứng tuyển; giỏ mất khi reload ngay |

Đăng ký thật, lưu voucher qua dialog rồi reload/ví API, đặt đơn qua UI tới trang xác nhận, và upload CV → admin tải lại đúng nội dung file đều đã đạt trên cả ba engine. Cart reload đạt trong một lượt Firefox không phủ định lỗi timing đã tái hiện trên Chromium/WebKit và probe độc lập. Đây là xác nhận tạo đơn QA, chưa phải hoàn tất thanh toán.

Một `pageerror` WebKit xuất hiện trong CTV smoke vốn đạt, liên quan request overview “due to access control checks”; đồng thời có request bị hủy khi đổi trang. Chưa có response 403/500 tương ứng để kết luận CORS server sai. Có **32 thông báo fallback RSC** trong 6 case vai trò, chủ yếu Firefox; 4 case đó vẫn đạt, kèm hủy navigation/prefetch. Giữ đây là quan sát ổn định cần điều tra có mục tiêu, chưa biến thành lỗi CORS/navigation đã xác nhận. [Tổng hợp 137 diagnostic](artifacts/enterprise-qa-2026-10-17/checks/browser-evidence-summary.json).

Đối chiếu cuối **208 diagnostic attachments** (không gồm 3 test bảo mật dùng reporter riêng) có tổng **4 pageerror trong 2 case WebKit vốn đạt**: 1 overview CTV ở baseline và 3 request RSC/prefetch ở case sỉ tỉnh kiểm tra lại. Không thấy HTTP 500 tương ứng. Các lỗi này vẫn là quan sát cần điều tra khi hủy navigation, chưa có bằng chứng kết luận CORS server. [Diagnostics toàn bộ lượt](artifacts/enterprise-qa-2026-10-17/diagnostics-summary.json).

**OBS-STABILITY-01 — Medium cần điều tra, chưa xác định nguyên nhân:** đọc thêm error store của đúng DB QA sau khi dừng server ghi nhận **6 bản ghi**. Một React #418 của Chromium trùng thời gian probe JSON-LD cố ý chèn script, nên không dùng làm bằng chứng hydration lỗi trong luồng bình thường. Năm bản ghi Firefox tại `/` được error boundary bắt gồm **2 `ChunkLoadError` và 3 `TypeError: Error in input stream`**, trùng khoảng thời gian test redirect, checkout và voucher. Browser diagnostics có request chunk `NS_BINDING_ABORTED`, chưa thấy HTTP 404 tương ứng; chưa chứng minh do deploy thiếu asset, lỗi app hoặc cơ chế hủy navigation của trình duyệt. Các bản ghi boundary này không nhất thiết phát ra `pageerror`, nên không được bỏ qua chỉ vì test chức năng sau đó đạt. Cần tái hiện có mục tiêu để xác minh recovery/UI và nguyên nhân; chưa sửa, chưa cộng thành 5 bug độc lập hoặc gộp vào 19 nhóm đã xác nhận. [Log đã loại thông tin nhạy cảm, mốc UTC và đối chiếu lượt test](artifacts/enterprise-qa-2026-10-17/server-client-errors.json).

## E. Hiệu năng và độ ổn định

Đo bằng `web-vitals` trong Chromium production build, **loopback không throttle, một navigation/một tương tác mỗi route**, máy có tải từ các tác vụ QA khác. Font/Maps/host ngoài bị chặn; dữ liệu và ảnh tổng hợp. Đây là **lab samples, không phải dữ liệu người dùng thực hoặc kết luận tốc độ production**.

| Route | LCP (ms) | CLS | INP (ms) | TTFB lab (ms) |
|---|---:|---:|---:|---:|
| `/` | 2444 | 0,115057 | Chưa ghi nhận sample | 85,3 |
| `/tim` | 644 | 0,077844 | 64 | 44,0 |
| `/sp/QAENT001` | 652 | 0,010579 | 80 | 130,4 |

Homepage CLS được thư viện đánh dấu cần cải thiện trong lượt đo này; chưa xác định đầy đủ thành phần gây dịch chuyển, chưa kết luận lỗi regression hoặc field Core Web Vitals. Không thay INP chưa có sample bằng 0. Chưa đo rò rỉ bộ nhớ dài hạn, tải đồng thời production, số lần React render có profiler, hoặc hiệu năng media thật. [Số đo gốc và resource timing](artifacts/enterprise-qa-2026-10-17/lab-summary.json).

Ba test lab đạt nghĩa là đã lấy được navigation/resource measurements, **không phải đạt ngân sách hiệu năng**. Resource timing ghi logo header khoảng 261 KB và logo auth được preload khoảng 689 KB trên home; cần xem lại chi phí preload và phân phối asset trong môi trường gần production. Chưa xác định đó là request thừa chỉ từ kích thước.

Toàn baseline ghi **424 HTTP response lỗi**: 277 shop auth/me 401, 126 auth/refresh 401, 7 staff auth/me 401 và 14 catalog 503. 410 phản hồi 401 là kiểm tra phiên chưa đăng nhập; cả 14 phản hồi 503 nằm trong ba case cố tình giả lập API lỗi. Không ghi nhận HTTP 500 tự phát trong diagnostics baseline. Có **558 lần chặn ngoài có chủ đích** (Fonts 424, Maps 134). Tổng 733 console-error và 1.172 request-failure occurrences gồm trùng lặp/retry, chặn ngoài và hủy request; không phải chừng đó lỗi sản phẩm. Một pageerror và RSC fallback được giữ ở mục D, không che khỏi báo cáo. [Diễn giải và bằng chứng](artifacts/enterprise-qa-2026-10-17/checks/BROWSER_TRIAGE.md).

## F. Accessibility — mục tiêu WCAG 2.2 AA

Đã thực thi **14 axe scan: 0 đạt, 14 lỗi** trên 7 route ở 375 và 1440 px. Kết quả có **8 rule ID riêng, 49 rule occurrences, 443 node occurrences**; các shared component lặp lại giữa trang/viewport được gộp thành 8 nhóm ở mục B. Không coi 443 node là 443 bug. Nhãn `critical/serious/moderate` của axe khác mức độ Critical/High của báo cáo ứng dụng.

Hai custom reduced-motion checks đều lỗi. Kiểm tra bàn phím xác nhận vấn đề focus ở menu toàn màn hình và dialog ứng tuyển. Các kiểm tra đã bao gồm nhãn form, accessible name, semantics/ARIA, contrast, control bị ẩn nhưng còn focus, vùng cuộn, kích thước target, hạn chế zoom và preference motion. Chưa hoàn tất NVDA/VoiceOver/TalkBack, điều khiển giọng nói, pinch zoom thiết bị thật, 200% text resize/400% reflow, thông báo lỗi/live region mọi form, hoặc mọi modal theo mọi vai trò.

**Không thể chứng nhận WCAG 2.2 AA chỉ từ axe và các probe hẹp này.** [Review a11y/visual](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.md), [JSON từng node](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.json), [axe attachments tổng hợp](artifacts/enterprise-qa-2026-10-17/axe-summary.json).

## G. Xác minh cuối và phần còn mở

| Phân loại | Kết quả |
|---|---|
| **Đã xác minh đạt trong phạm vi nêu rõ** | TypeScript hai phía, production build; 33 trường hợp API riêng cuối cùng; 5 Python tests; 151 kết quả kịch bản browser cuối; đăng ký, voucher, tạo đơn UI, upload/download trên ba engine; giá/role, validation và idempotency có bằng chứng riêng |
| **Đã sửa và kiểm thử lại** | **Chưa sửa lỗi ứng dụng.** Chỉ sửa fixture/harness QA và kiểm tra lại nhóm liên quan; ví dụ URL token giả đạt lại 4/4. Raw lỗi ban đầu vẫn được giữ |
| **Còn lỗi đã xác nhận** | 5 High + 13 Medium + 1 Low tại mục B; 8 assertion bảo trì test trong 5 file; không gộp dependency alerts/SEC-004 có điều kiện vào 19 nhóm |
| **Quan sát chưa đủ kết luận** | OBS-STABILITY-01: Firefox chunk/input-stream errors được boundary bắt; WebKit pageerror khi hủy request; RSC fallback; CLS homepage của một lượt lab; ảnh hưởng thực tế của các advisory theo cấu hình production |
| **Bị cô lập/chưa nghiệm thu tích hợp** | Thu tiền/chuyển khoản/QR/ngân hàng và webhook đối soát thật; KiotViet order/invoice/thu tiền/đổi-hủy thật; carrier quote/dispatch/label/tracking; email/SMS; worker hội tụ tự động |
| **Chưa kiểm tra đủ** | Mọi nút/mọi trang/mọi trạng thái; CRUD sâu admin, end-to-end duyệt/chi trả/rút hoa hồng CTV; Google/Zalo OAuth thật; header/secret/HTTPS production; tấn công phá hoại/DoS; thiết bị thật và accessibility thủ công đầy đủ; memory/load dài hạn |

Đơn QA được tạo và lưu số tiền/trạng thái thật trong DB QA; điều đó chưa chứng minh đã thu tiền hoặc xuất hóa đơn hợp lệ. Các đơn QA có `kvOrderId/kvInvoiceId/kvInvoiceCode: null` do tích hợp bị tắt. Luồng review đơn `Pending/unpaid/0` không được tính là hoàn tất COD. Upload/download CV đã đạt trên ba engine, gồm đối chiếu byte file tải về; không suy từ endpoint cấu hình 200.

### Hồ sơ bàn giao và cách kiểm tra lại

- Test browser: [tests/browser-qa/enterprise](tests/browser-qa/enterprise); bảo mật: [security.spec.cjs](artifacts/enterprise-qa-2026-10-17/security/security.spec.cjs). Các trace/ảnh failure và HTML report được lưu trong [artifact audit](artifacts/enterprise-qa-2026-10-17).
- Báo cáo chuyên đề: [API/nghiệp vụ](artifacts/enterprise-qa-2026-10-17/API_REPORT_SECTION.md), [3 lỗi chức năng](artifacts/enterprise-qa-2026-10-17/FUNCTIONAL_BUGS.md), [bảo mật/advisory](artifacts/enterprise-qa-2026-10-17/security/security-findings.md), [visual/a11y](artifacts/enterprise-qa-2026-10-17/security/visual-a11y-review.md), [unit/type/build](artifacts/enterprise-qa-2026-10-17/checks/CHECKS_REPORT.md).
- Lệnh đã dùng: `npm run typecheck:api`; frontend `tsc --noEmit --incremental false`; `next build`; Node runner có `tsx --test` với guard DB test; Playwright dùng các config baseline/extended/recheck trong thư mục enterprise. Chi tiết command/exit/time có trong JSON metadata; chưa có bước sửa ứng dụng rồi regression.
- **Trạng thái bàn giao:** đã dừng đúng hai server QA; kiểm tra cả `3301` và `3302` đều `ECONNREFUSED`. Giữ database QA, fixture và artifact để tái hiện; chưa chạy dropDatabase hoặc xóa file. Credentials/CV QA nằm trong khu vực bị Git-ignore, không chép vào report hoặc commit. [ENVIRONMENT.md](artifacts/enterprise-qa-2026-10-17/ENVIRONMENT.md) có hướng dẫn khởi chạy lại và cleanup chỉ đúng DB QA.

Các lỗi High cần được xử lý và kiểm thử lại trước khi dùng báo cáo này làm bằng chứng nghiệm thu phát hành. Hiện báo cáo xác nhận các kết quả đã chạy và các giới hạn trên; chưa phê duyệt toàn shop đạt yêu cầu production.
