# Kế hoạch chống lạm dụng ưu đãi không dùng OTP — Aloha

Ngày lập: 30/09/2026. Trạng thái: đề xuất, chưa triển khai trong lượt lập kế hoạch. Không thay đổi dữ liệu khách, cấu hình production hoặc đơn KiotViet.

## 1. Mục tiêu, phạm vi và giới hạn

Triển khai 5 lớp: lịch sử tài khoản/điện thoại mua hàng; giữ quyền khách mới; giới hạn lượt và ngân sách; giới hạn tốc độ; kiểm tra đơn có dấu hiệu bất thường. Không dùng OTP/SMS, không mua dịch vụ chống gian lận. Có chi phí phát triển, hạ tầng và công vận hành; không gọi đây là giải pháp không có chi phí.

Không thể xác minh chắc chắn một người dùng nhiều tài khoản, nhiều số và nhiều thiết bị. Đích nghiệm thu là kiểm soát quyền, tiền và xử lý công bằng các trường hợp có dữ liệu; không cam kết chặn 100% gian lận. Không tự coi số điện thoại khách khai là số đã xác minh.

Tài liệu liên quan: [ưu đãi/voucher](KE_HOACH_UU_DAI_VOUCHER.md), [phí ship](KE_HOACH_PHI_SHIP_TAM_TINH.md). Kế hoạch này không thay cách tính giảm hàng, hỗ trợ ship, hoa hồng hoặc ánh xạ KiotViet đã thống nhất. Các lỗi tiền đã nêu ở lần rà trước phải được xử lý trước khi bật thu tiền tự động.

Phạm vi UI: tận dụng checkout và chi tiết đơn hiện hữu; bổ sung phần xét ưu đãi trong màn hình xử lý đơn hiện có khi cần. Không tạo trang quản lý phí ship mới. Phần xét duyệt là công việc cần triển khai, chưa mặc định hệ thống đã có.

## 2. Tham khảo và nguyên tắc áp dụng

Không có một chứng nhận “chuẩn công ty lớn” cho mọi cửa hàng. Áp dụng các nguyên tắc có thể kiểm chứng: giới hạn rõ, cập nhật nguyên tử, chống gửi trùng, lịch sử điều chỉnh, phục hồi lỗi, xét duyệt có lý do và đo tỷ lệ chặn nhầm.

- [Shopify — Discount codes](https://help.shopify.com/en/manual/discounts/discount-methods/discount-codes): giới hạn một lần mỗi khách áp dụng theo ưu đãi cụ thể. Aloha cần quyền khách mới chung nếu muốn kiểm soát xuyên chương trình.
- [Voucherify — Locking validation session](https://docs.voucherify.io/guides/locking-validation-session): giữ lượt tạm thời, giải phóng khi hết hạn hoặc chuyển sang sử dụng. Tham khảo nguyên tắc; không tích hợp dịch vụ này.
- [Stripe — Radar technical guide](https://stripe.com/guides/primer-on-machine-learning-for-fraud-protection): phối hợp tín hiệu và xét duyệt. Đây là tài liệu chống gian lận thanh toán, không phải bằng chứng mọi sàn áp cùng chính sách voucher. Aloha dùng quy tắc minh bạch trước, chưa cần mô hình máy học.

Nguồn được đối chiếu ngày 30/09/2026. Các thời hạn/ngưỡng mẫu dưới đây là đề xuất của Aloha, không phải ngưỡng do các nguồn khuyến nghị.

## 3. Hiện trạng và công nghệ tái sử dụng

| Thành phần | Đã có / việc phải bổ sung |
|---|---|
| shopPromotions/customerEligibility.ts | Có kiểm tra lịch sử; cần lọc đúng quyền khách mới, không dùng mọi redemption để kết luận khách cũ, không coi đang giao COD là mua thành công |
| shopPromotions/checkoutPromotions.ts | customerKeyFor hiện theo tài khoản; cần bổ sung khóa điện thoại khai báo và quyền xuyên chương trình |
| shopPromotions/redemptionService.ts | Có giữ lượt khách/chương trình và chuyển trạng thái có điều kiện; cần khóa lượt mã, transaction hoặc phục hồi nhiều bước, unique indexes |
| shopOrders/orderCreateRoutes.ts | Có tính lại ưu đãi, giữ lượt, tìm idempotency; cần ràng buộc duy nhất và kiểm tra request trùng trước tác dụng phụ |
| shopOrders/markPaid.ts, orderCustomerActionRoutes.ts | Có dùng/giải phóng quyền; cần hết hạn theo batch chính xác, xử lý hơn 100 đơn và phục hồi lỗi |
| shopRateLimit.ts, redis.ts | Có rate limit Redis và fallback RAM; hiện đọc X-Forwarded-For trực tiếp, phải chỉ tin proxy được cấu hình |
| MongoDB native, Express, Zod, TypeScript | Lưu quyền, ledger, xác thực request và API; kiểm chứng topology trước khi chọn transaction |
| Next.js/React, UI admin hiện có | Hiển thị trạng thái, tiếp tục đơn cũ, đề nghị kiểm tra, quyết định có lý do |
| node:test, tsx | Unit, integration bằng DB/Redis thử; không dùng DB thật để thử cạnh tranh |

Danh sách hiện trạng là kết quả đọc source, không phải xác nhận cấu hình production. Trước thực thi phải rà lại vì code đang được phát triển.

## 4. Chính sách chung cần dùng thống nhất

- Khách mới = chưa có lần mua web thành công. Tài khoản tồn tại lâu nhưng chưa mua vẫn có thể đủ điều kiện.
- Đề xuất thời điểm dùng quyền: chuyển khoản đủ tiền đã đối soát; COD giao thành công và xác nhận đã thu. Cọc hoặc trạng thái đang giao chưa tiêu thụ quyền, nhưng tiếp tục giữ cho đơn hiện tại.
- Đơn mua thành công không dùng mã khách mới vẫn làm khách không còn quyền lần đầu.
- Quyền dùng chung cho mọi chương trình thuộc nhóm `first_web_purchase`; ưu đãi đơn lớn/ship thông thường có giới hạn riêng. Nếu chương trình ship cũng dành riêng khách mới thì phải tham gia cùng quyền chung của đơn.
- Một đơn có thể có nhiều lợi ích khách mới nếu chính sách kết hợp cho phép, nhưng chỉ sở hữu một quyền lần đầu. Hai đơn không được cùng giữ quyền đó.
- Hủy/hết hạn trước thành công trả quyền theo trạng thái; hoàn sau thành công không tự trả quyền lần đầu. Ngoại lệ có người duyệt và lịch sử.
- Không thay giá đơn đã chốt hoặc đã thanh toán chỉ vì chính sách/tín hiệu rủi ro thay đổi.

## 5. Biện pháp 1 — Lịch sử tài khoản và điện thoại mua hàng

### 5.1. Dữ liệu và nhận diện

Lưu riêng accountId, buyerPhoneNormalized, recipientPhone và snapshot tại lúc đặt. Số người nhận không cấp quyền mua mới. Chuẩn hóa số Việt Nam về một định dạng, ví dụ +84901234567; kiểm tra độ hợp lệ, không biến số lỗi thành khóa rỗng dùng chung. Chỉ hỗ trợ quốc gia đã có quy tắc; không tự đoán số quốc tế.

Khóa tài khoản lấy từ phiên đăng nhập, không từ body. Đổi số không xóa lịch sử thành công của tài khoản. Khi chưa mua thành công nhưng đổi số trên đơn đang giữ quyền: cập nhật quyền trong giao dịch có kiểm tra, không để hai số giữ hai đơn. Không gộp tài khoản hoặc chuyển quyền truy cập chỉ vì trùng số.

Trùng tài khoản đã mua: không đủ điều kiện khách mới. Trùng số khai báo với lịch sử mua của tài khoản khác: không tự cấp lại ưu đãi; cho yêu cầu kiểm tra vì số có thể dùng chung, nhập nhầm hoặc được cấp lại. Không tiết lộ tên/đơn của người khác trong thông báo.

### 5.2. Tránh khóa nhầm người khác

Chỉ nhập điện thoại để xem giá không tạo khóa. Giữ số chỉ khi gửi đơn hợp lệ, trong thời hạn giới hạn, có giới hạn tốc độ. Một tài khoản cố tình nhập số người khác để giữ quyền không được khóa vô hạn: có hết hạn, giới hạn gia hạn, truy vết và đường đề nghị xét lại.

Số tự khai là tín hiệu kiểm soát chương trình, không phải định danh được xác thực. Nếu nhân viên duyệt ngoại lệ do dùng chung số, cấp quyền ngoại lệ giới hạn cho đúng tài khoản/đơn; giữ lịch sử số cũ, không xóa dấu đã dùng của người trước.

## 6. Biện pháp 2 — Giữ quyền khách mới và chống đặt đồng thời

### 6.1. Vòng đời

`available → held → consumed`; `held → released` khi hủy/hết hạn hợp lệ. Sau release, claim có thể được cấp lại, còn lịch sử sự kiện được giữ. `review_required` là trạng thái xét duyệt riêng, không đồng nghĩa gian lận hoặc đã sử dụng quyền.

Khóa hiện hành theo `(policyGroup, identityType, identityKey)` với unique index: account và phone. Giữ cả hai khóa cho cùng orderId ổn định trong một giao dịch; nếu một khóa thuộc đơn khác thì toàn bộ thao tác thất bại. Không ghép account+phone thành một khóa duy nhất vì sẽ cho phép cùng số ở tài khoản khác đi qua.

### 6.2. Tạo đơn nguyên tử

1. Đăng nhập, validate request; kiểm tra idempotency theo accountId + clientRequestId. Hash nội dung nghiệp vụ; cùng key khác nội dung trả conflict.
2. Backend đọc giá, đánh giá ưu đãi, quyền, giới hạn và quote. Preview không giữ quyền.
3. Trong Mongo transaction: chiếm idempotency; giữ khóa danh tính; tăng có điều kiện lượt mã/lượt khách/lượt chương trình/ngân sách; ghi order và redemption cùng outbox.
4. Commit xong mới gọi KiotViet/thông báo qua worker có retry. Không giữ transaction trong khi chờ mạng.
5. Retry trả cùng đơn hoặc trạng thái đang xử lý; không phát sinh giữ lượt hoặc chứng từ mới. Mã KiotViet là mã tham chiếu ngoài, không đổi khóa orderId nội bộ.

Mongo transaction cần replica set hoặc topology hỗ trợ: kiểm tra thực tế trước. Nếu chưa hỗ trợ, không giả định chuỗi update riêng lẻ là nguyên tử. Chọn triển khai topology phù hợp hoặc thiết kế giao dịch nhiều bước có operationId, bước bù và worker phục hồi được kiểm thử; chưa có một trong hai thì không bật tự động giữ quyền trong production. Redis chỉ hỗ trợ hiệu năng/rate limit, không là nguồn duy nhất của quyền tài chính.

### 6.3. Hết hạn và phục hồi

Tách thời hạn quote, thời hạn giữ quyền và thời hạn thanh toán. Đề xuất khởi đầu: chờ shop xác nhận tối đa 24 giờ, gia hạn có lý do theo SLA; đơn đã xác nhận/cọc đang thực hiện giữ đến khi kết thúc, không tự mất quyền giữa giao hàng. Chính sách thời gian phải chốt với vận hành trước rollout.

Worker claim từng batch bằng lease có owner/expiry; chỉ chuyển trạng thái các ID đã claim, rồi thực hiện hoàn quyền trong transaction. Không lấy 100 đơn rồi updateMany toàn bộ đơn hết hạn. Không dùng TTL xóa bản ghi giữ trước khi hoàn counter. Kiểm thử tranh chấp thanh toán/hủy/hết hạn để chỉ có một kết quả hợp lệ.

Reconciliation định kỳ so ledger với heldCount/budgetHeld/customerUsage; có chế độ báo lệch và repair idempotent được kiểm thử. Mọi lỗi giữa chừng phải có operationId để tiếp tục hoặc bù, không nuốt lỗi rồi báo đã hoàn tất.

## 7. Biện pháp 3 — Giới hạn lượt, tiền và ngân sách

- Mỗi đơn có trần giảm; mỗi chương trình có tổng lượt/ngân sách; khách có giới hạn lượt theo chương trình và định danh chính sách. Dùng số nguyên VND.
- Giữ mã một lần bằng update có điều kiện `used + held < limit`, cùng transaction với chương trình. Check trước ở evaluator chỉ để hiển thị, không thay ràng buộc lúc giữ.
- Ngân sách khả dụng = tổng - đã dùng - đang giữ; không âm. Ship được giữ theo số hỗ trợ thực tế, không vượt phí ship. Không giảm một phần khi ngân sách thiếu nếu chính sách không cho phép.
- Giảm hàng và giảm ship giữ riêng nhưng cùng giao dịch tạo đơn; thất bại một lợi ích không để giữ treo lợi ích còn lại. Không tự tăng tổng so với báo giá khách đã chấp thuận: trả quote mới để xác nhận.
- Đơn lớn xét từng đơn, không cộng lịch sử trừ khi có chương trình tích lũy riêng. Chia đơn không mặc định là gian lận. Nếu muốn giới hạn theo ngày/chương trình thì công bố, lưu múi giờ Asia/Ho_Chi_Minh và kiểm thử biên ngày.
- Đổi chính sách có version, không hồi tố đơn đã chốt. Ví dụ mức giảm10%, trần50.000đ, ngân sách5.000.000đ chỉ là fixture, không phải cấu hình được phép bật thật.

## 8. Biện pháp 4 — Giới hạn tốc độ

Theo từng hành động: tạo tài khoản, kiểm tra mã, đặt đơn, hủy/đặt lại, gửi đề nghị xét lại. Tách key theo account, phone-token, cookie phiên và IP. IP dùng ngưỡng rộng hơn để tránh ảnh hưởng mạng dùng chung. Không khóa mua hàng lâu dài chỉ vì trùng IP.

Đề xuất thử trong chế độ chỉ ghi nhận: gửi đơn mới 5 lần/10 phút/tài khoản; thử mã 20 lần/10 phút/tài khoản; đề nghị xét lại 3 lần/ngày/tài khoản. Đây là ngưỡng thử, cần đo lưu lượng thực và chỉnh trước bật. Retry cùng idempotency trả lại kết quả không tính là đơn mới, nhưng vẫn chịu giới hạn request tổng chống quá tải.

Redis INCR và expiry phải nguyên tử (script hoặc primitive phù hợp). Chỉ lấy IP từ reverse proxy tin cậy, proxy xóa header do client tự gửi; không dùng X-Forwarded-For tùy ý. Trả HTTP429, Retry-After và thông báo có thời gian thử lại.

Redis lỗi: cảnh báo, fallback cục bộ chỉ để giảm tải và ghi rõ không bảo vệ toàn cụm. Quyền/lượt/ngân sách vẫn được Mongo kiểm soát. Nếu không thể kiểm tra quyền tài chính, không tự cấp ưu đãi; cho khách chờ xác nhận hoặc chủ động chọn mua không ưu đãi với tổng rõ ràng. Không làm mất đơn đã chốt.

## 9. Biện pháp 5 — Xét đơn đáng ngờ

### 9.1. Quyết định có thể giải thích

| Nhóm | Ví dụ | Kết quả |
|---|---|---|
| Không đủ điều kiện chắc chắn | Cùng tài khoản đã mua thành công | Không cấp ưu đãi khách mới, vẫn mua bình thường |
| Xung đột số chưa xác minh | Tài khoản mới dùng số đã hưởng ưu đãi | Đề nghị kiểm tra; không tự quy kết gian lận |
| Nhiều dấu hiệu kết hợp | Nhiều tài khoản mới, cùng cookie và địa chỉ, giỏ giống nhau trong khoảng ngắn | review_required trước chốt tiền |
| Tín hiệu đơn lẻ | Cùng IP hoặc cùng địa chỉ | Ghi tín hiệu, không tự từ chối |
| Không có dấu hiệu | Khách mới bình thường | Tiếp tục luồng hiện hữu |

Không dựng fingerprint bí mật hoặc coi cookie là định danh chắc chắn. Dùng cookie bên thứ nhất có mục đích rõ, cấu hình bảo mật phù hợp; xóa cookie không khiến tài khoản đã mua trở thành mới. Email đăng nhập không tự chứng minh mỗi người một tài khoản; không tự xóa dấu chấm/dấu cộng cho mọi nhà cung cấp email.

### 9.2. UI shop và vận hành

Checkout hiển thị ưu đãi, ship và tổng rõ; khi cần xét: “Ưu đãi cần được Aloha kiểm tra trước khi xác nhận đơn”. Có nút tiếp tục đơn đang giữ, đề nghị kiểm tra hoặc mua không ưu đãi sau khi xem tổng mới. Không hiển thị thông tin tài khoản khác.

Trong chi tiết đơn admin hiện có: badge trạng thái, mã lý do, lịch sử xét, các đơn liên quan trong quyền được cấp và điện thoại che bớt. Quyết định: chấp nhận ưu đãi; yêu cầu làm rõ; không đủ điều kiện. Từ chối/ngoại lệ bắt buộc lý do; quyền tài chính tách khỏi quyền chỉ xem. Chỉ đổi phiên bản còn hiện hành để hai nhân viên không ghi đè quyết định nhau.

Nếu bỏ ưu đãi trước thanh toán: báo tổng mới, chờ khách xác nhận rồi mới tạo yêu cầu thu theo giá mới. Không hủy tự động vì tín hiệu yếu; không sửa tiền đã trả. Ngoại lệ chỉ cho đúng order/account, không xóa lịch sử chung. Đề xuất SLA một ngày làm việc và báo khách thời gian dự kiến; cần chốt theo năng lực shop.

CTV chỉ thấy đơn/hoa hồng thuộc quyền mình và trạng thái dự kiến, không được xem tín hiệu chống lạm dụng của khách khác. Quyết định ưu đãi và quyết định CTV tự mua/hoa hồng là hai việc riêng.

## 10. Dữ liệu, API và bảo vệ thông tin

Tên collection/field chỉ là đề xuất, thích nghi model khi triển khai:

| Dữ liệu | Trường / ràng buộc chính |
|---|---|
| Claim quyền | policyGroup, identityType, identityKey, orderId, state, leaseUntil, version; unique khóa danh tính |
| Request tạo đơn | accountId, requestId, bodyHash, orderId, state; unique accountId+requestId |
| Redemption | orderId, promotionId, benefitType, amount, state, operationId; unique theo quyền lợi và lần thực hiện hợp lệ |
| Ledger quyền/ngân sách | eventId duy nhất, operationId, before/after, reason, policyVersion; lịch sử chỉ thêm |
| Review | orderId, reasons, state, actor, decision, decisionVersion, timestamps |
| Outbox | eventId duy nhất, payload tối thiểu, status, retryAt, lease; worker xử lý ít nhất một lần và consumer idempotent |

Không dùng mã điện thoại hash thường làm dữ liệu “ẩn danh”: miền số nhỏ có thể dò. Dùng HMAC có secret và keyVersion cho khóa tra cứu; thông tin gốc chỉ ở nơi nghiệp vụ cần với phân quyền. HMAC vẫn là dữ liệu có thể liên kết, không mặc nhiên vô danh. Xoay khóa cần dual-read/migrate có kiểm soát để không cấp lại quyền.

API dự kiến: preview trả eligible/ineligible/review_required/held_elsewhere; tạo đơn trả cùng order khi retry; đề nghị xét lại gắn chủ đơn; quyết định admin yêu cầu quyền và version; job expiry/reconcile nội bộ không public. Không tin accountId, discount, quyết định hoặc điểm rủi ro từ client.

Lưu IP/cookie/signal thô trong thời hạn ngắn theo chính sách đã công bố; đề xuất 30 ngày cho tín hiệu vận hành. Lịch sử đơn, quyền, quyết định theo lịch lưu trữ nghiệp vụ được duyệt; không tự áp cùng TTL cho tất cả. Trước bật phải chốt thông báo mục đích, thời hạn và quy trình xử lý yêu cầu của khách. Log không chứa token, secret, điện thoại đầy đủ hoặc địa chỉ đầy đủ.

## 11. Migration, rollout và xử lý sự cố

1. Rà các lỗi source mục 3 và các lỗi tổng tiền/thanh toán. Xác minh Mongo topology, Redis/proxy, lưu lượng, định nghĩa đơn thành công và các điểm cập nhật trạng thái.
2. Chạy báo cáo read-only lịch sử: chuẩn hóa số, phát hiện trùng và bản ghi thiếu. Không suy khách cũ từ mọi redemption; không tự gộp người trùng số.
3. Backfill lịch sử thành công theo account và phone snapshot đáng tin; thiếu dữ liệu thì đánh dấu cần xem, không gán về cùng khóa rỗng. Rà duplicate trước tạo unique index, không xóa mù dữ liệu.
4. Bật lớp1–3 trong staging; chạy concurrency và fault injection với nhiều instance. Xử lý đơn đang held trước chuyển cơ chế; không cấp lại quyền cũ hoặc trừ ngân sách hai lần.
5. Lớp4–5 chạy shadow (chỉ ghi nhận, không đổi giá/từ chối) 7–14 ngày đề xuất, đo chặn nhầm rồi hiệu chỉnh.
6. Bật giới hạn trên nhóm thử nhỏ bằng cờ backend, tăng dần sau đối soát. Cờ đề xuất riêng cho quyền mới, rate limit và review để tắt từng phần.
7. Rollback dừng quyết định mới gây lỗi, giữ ledger/claim hiện hữu và tiếp tục thanh toán/hủy/hoàn. Không xóa dấu consumed hoặc reset ngân sách khi tắt tính năng.

Theo dõi: conflict giữ quyền, vượt ngân sách (phải 0), đơn trùng (phải 0), hold quá hạn, drift bộ đếm, tuổi outbox, tỷ lệ429, số review, thời gian xử lý và tỷ lệ duyệt lại sau từ chối. Không gọi review là “gian lận được xác nhận”. Có người chịu trách nhiệm xử lý cảnh báo và runbook retry/repair.

## 12. Test case QA/QC — tất cả Chưa chạy

Fixture staging: ưu đãi khách mới10% tối đa50.000đ; hàng500.000đ; ship40.000đ; hỗ trợ ship20.000đ; tổng470.000đ. CTV5% trên hàng450.000đ →22.500đ. Dùng DB/Redis thử riêng và chặn network ghi thật.

| Mã | Dữ liệu/thao tác | Kết quả bắt buộc |
|---|---|---|
| AB01 | Tài khoản cũ chưa mua, đặt fixture | Đủ điều kiện; tổng470.000; HH22.500 dự kiến |
| AB02 | Tài khoản đã mua đổi số rồi đặt | Không có ưu đãi khách mới; ưu đãi khác xét riêng |
| AB03 | 0901234567 và +84901234567 ở hai tài khoản | Cùng khóa số; không tự cấp hai quyền |
| AB04 | Mua tặng, chỉ đổi số người nhận | Không thay lịch sử/quyền người mua |
| AB05 | Tài khoản mới dùng số có lịch sử của người khác | Không tự cấp lại; có đường xét lại; không lộ đơn người trước |
| AB06 | Nhân viên duyệt ngoại lệ số dùng chung | Chỉ account/đơn được duyệt hưởng; lịch sử người trước giữ nguyên |
| AB07 | Đơn đang giữ hỗ trợ ship thông thường | Không tự làm mất tư cách khách mới |
| AB08 | COD đang giao rồi giao thất bại | Chưa consumed; giải phóng đúng khi kết thúc hủy |
| AB09 | Đơn không dùng ưu đãi mua thành công | Tài khoản không còn quyền khách mới |
| AB10 | 20 request đồng thời cùng account, khác requestId | Tối đa một đơn giữ quyền khách mới; các đơn khác không âm thầm nhận giá mới |
| AB11 | Hai account cùng số, đặt đồng thời | Tối đa một quyền theo số; request thua không giữ ngân sách treo |
| AB12 | Hai chương trình khách mới, hai tab chọn khác nhau | Quyền chung chỉ thuộc một đơn |
| AB13 | Một đơn có cả giảm hàng và ship dành khách mới | Một claim, hai redemption đúng ngân sách; không chặn chính đơn đó |
| AB14 | Gửi20 lần cùng requestId/body | Một orderId, một bộ giữ lượt, một tác dụng phụ ngoài |
| AB15 | Cùng requestId, sửa giỏ | Conflict, không tái dùng giá/đơn khác |
| AB16 | Hai khách tranh mã còn1 lượt | Chỉ một lần giữ mã thành công |
| AB17 | Nhiều khách tranh ngân sách còn50.000 | Tổng held+used không vượt budget; không bộ đếm âm |
| AB18 | Giữ giảm hàng thành công rồi giữ ship thất bại | Rollback toàn bộ giao dịch; khách nhận báo giá cần xác nhận lại |
| AB19 | Dừng tiến trình sau mỗi bước ghi giữ/consume/release | Restart phục hồi; ledger/counter/claim khớp, không hoàn/dùng hai lần |
| AB20 | Thanh toán thành công tranh chấp expiry/hủy | Một kết quả hợp lệ; tiền tới muộn vào đối soát, không cấp lại quyền đã consumed |
| AB21 | 150 đơn hết hạn, batch100 | Xử lý đủ150 qua batch; không đổi trạng thái những đơn chưa claim mà bỏ hoàn lượt |
| AB22 | Hủy rồi đặt lại; gọi hủy2 lần | Trả quyền đúng một lần; ngân sách không âm; đơn mới có thể xét lại |
| AB23 | Hoàn hàng sau mua thành công | Không tự cấp lại quyền khách mới; hoàn tiền/HH theo snapshot |
| AB24 | KiotViet nhận đơn nhưng response timeout | Tra cứu/retry theo tham chiếu; không nhân đôi chứng từ/ưu đãi |
| AB25 | CùngIP, hai người hợp lệ cùng nhà | Không bị kết luận gian lận từIP/địa chỉ đơn lẻ |
| AB26 | Nhiều account, cùng cookie/địa chỉ/giỏ trong thời gian ngắn | Review có lý do; không tự kết luận cùng người |
| AB27 | Xóa cookie sau đã mua | Account vẫn mất quyền lần đầu; tín hiệu thiếu không thành quyền mới |
| AB28 | Giả X-Forwarded-For để né rate limit | Backend chỉ tin proxy hợp lệ; không đổi key theo header giả |
| AB29 | Vượt ngưỡng request, retry đúng đơn |429 có Retry-After cho spam; retry hợp lệ không tạo thêm lượt/order |
| AB30 | Redis mất kết nối, nhiều instance | Không vượt quyền/ngân sáchMongo; cảnh báo giảm bảo vệ tốc độ |
| AB31 | Nhập số người khác ở preview hoặc spam đặt/hủy | Preview không giữ; hold có giới hạn và lối xét lại; không khóa vô hạn |
| AB32 | Hai admin duyệt cùng review | Version check; một quyết định hiện hành, lịch sử đầy đủ |
| AB33 | Khách/CTV gọiAPI duyệt hoặc xem review người khác |403/404 phù hợp; không lộ tín hiệu/dữ liệu cá nhân |
| AB34 | Bỏ giảm50.000 trước thu ở fixture | Tổng mới520.000; chờ khách xác nhận; HH cơ sở mới500.000 nếu đủ điều kiện |
| AB35 | Có tín hiệu mới sau khách đã trả470.000 | Không tự tăng tổng/ghi đã thu thêm; xử lý nghiệp vụ có lịch sử |
| AB36 | Bật/tắt cờ khi có held/consumed và đơn đang trả | Không mất quyền, tiền hoặc ledger; không cấp lại khách cũ |
| AB37 | Backfill trùng số/số lỗi/thiếu số và xoay HMAC key | Không gộp người tự động, không khóa rỗng chung, không cấp lại do đổi key |
| AB38 | Mobile360px, bàn phím, mạng chậm, review/429 | Nhãn rõ, không che tổng/nút, không gửi giá cũ hoặc lộ tài khoản khác |

Test cần gọi service thật với Mongo/Redis thử, dùng barrier cho tranh chấp và ngắt tiến trình có chủ đích. Không viết lại công thức trong test rồi coi là integration. Kiểm tra số record, số tiền, counter và ledger sau mỗi ca. Ghi expected/actual, runId, môi trường, evidence và người review.

## 13. Điều kiện hoàn thành và điểm cần chốt

Chỉ hoàn thành khi: AB01–AB38 áp dụng đều đạt; test đồng thời đa instance và phục hồi lỗi đạt; không vượt ngân sách/nhân đôi đơn; đối soát quyền và tiền bằng0 sai lệch; typecheck các phần thay đổi đạt; luồng shop→KV→thanh toán→CTV không hồi quy; vận hành đã thử xét lại và rollback.

Phải chốt trước production: định nghĩa thành công theo từng phương thức; thời hạn giữ/gia hạn; giới hạn chương trình; ngưỡng rate limit/rule review; người duyệt/SLA; thời hạn lưu tín hiệu; khả năng Mongo transaction. Nếu thiếu một quyết định, triển khai phần độc lập và giữ phần phụ thuộc ở shadow/staging; không ngầm chọn cấu hình ảnh hưởng khách thật.

Không đánh dấu hoàn thành chỉ vì có file kế hoạch, test mock đạt hoặc đã thêm trường dữ liệu. Kế hoạch này chưa được triển khai/kiểm thử trong lượt lập tài liệu.
