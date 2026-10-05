# Kế hoạch tuyển dụng Aloha — phiên bản tối giản

Cập nhật: 05/10/2026. Trạng thái: đã triển khai bản đầu — xem mục 14.

Bản này thay thế đề xuất 11 collection trước đó. Phạm vi mặc định: tuyển nhân viên cho Aloha, giữ liên kết tới `/tuyen-ctv` hiện có. Thiết kế cho nhu cầu tuyển ít vị trí, do một nhóm quản trị nhỏ xử lý; số lượng thực tế chưa được cung cấp. Không khẳng định đây là thiết kế tối ưu tuyệt đối: hiệu năng phải được kiểm chứng bằng dữ liệu và truy vấn khi triển khai.

## 1. Kết luận về database

**Tạo mới 2 collection nghiệp vụ:** `recruitment_jobs` và `recruitment_applications`. MongoDB gọi là collection, tương đương khái niệm bảng người dùng đang hỏi.

Thông tin ứng viên, metadata CV, lịch hẹn đơn giản, kết quả, ghi chú và lịch sử ngắn được nhúng vào hồ sơ. Không tạo collection cho mỗi khái niệm. CV nhị phân nằm ở kho tệp riêng, không nhúng vào MongoDB và không đặt ở thư mục uploads công khai.

Email xác nhận không yêu cầu collection outbox riêng ở bản này: lưu trạng thái gửi ngay trong hồ sơ. Cấu hình cố định trong mã/env; không làm màn hình cấu hình động. Tận dụng xác thực quản trị hiện có nhưng thêm quyền tuyển dụng ở backend.

## 2. Tham khảo doanh nghiệp lớn và cơ sở thiết kế

| Nguồn chính thức | Điều có thể xác minh | Áp dụng cho Aloha |
|---|---|---|
| [Shopee – hướng dẫn ứng tuyển](https://help.shopee.sg/portal/4/article/76939-%5BOthers%5D-How-do-I-apply-for-a-job-with-Shopee) | Tìm việc, lọc phòng ban/cấp bậc/địa điểm, xem JD, điền thông tin và CV, nhận xác nhận qua email, recruiter liên hệ khi được lựa chọn | Giữ hành trình tìm → đọc → nộp → nhận xác nhận → được liên hệ |
| [Lazada Careers](https://www.lazada.com/en/careers/) | Tìm việc, nhóm phòng ban, sứ mệnh/giá trị và nội dung văn hóa | Giới thiệu Aloha ngắn gọn, danh sách việc rõ; chỉ dùng quyền lợi và hình ảnh thật |
| [Amazon – hướng dẫn ứng tuyển CS](https://www.amazon.jobs/content/en/how-we-hire/customer-service-application-guide) | Tạo profile, thông tin liên hệ, đánh giá; quy trình tùy vai trò và địa điểm | Chọn bước theo vị trí; Aloha chưa cần account ứng viên và hệ thống đánh giá phức tạp |
| [MongoDB – Embedded Data](https://www.mongodb.com/docs/manual/data-modeling/embedding/) | Dữ liệu liên quan có thể nhúng để đọc cùng một document và cập nhật atomic; document có giới hạn kích thước | Nhúng dữ liệu nhỏ thuộc một hồ sơ; giữ tin và hồ sơ riêng; giới hạn mảng và dung lượng |

Nguồn công khai không cho biết schema database nội bộ của Shopee, Lazada hay Amazon. Hai collection là thiết kế đề xuất cho Aloha dựa vào nhu cầu sử dụng và hướng dẫn MongoDB, không phải schema sao chép từ các sàn. Ít collection hơn không tự động có nghĩa nhanh hơn; mục tiêu là ít chức năng, ít quan hệ và đủ để vận hành.

## 3. Chức năng giữ và bỏ

### Giữ trong bản triển khai đầu

- Trang tuyển dụng: giới thiệu ngắn, các việc đang mở, liên hệ chính thức và liên kết tuyển CTV.
- Form “Hãy để Aloha kết nối với bạn” theo ảnh TMA: nhận liên hệ tuyển dụng ngay cả khi chưa chọn tin; lưu cùng collection hồ sơ, phân biệt bằng `submissionType`.
- Chi tiết việc: mô tả, yêu cầu, quyền lợi, địa điểm/ca làm, lương nếu công bố, hạn nộp.
- Form một trang: họ tên, email, điện thoại, kinh nghiệm ngắn, CV theo yêu cầu vị trí và đồng ý xử lý dữ liệu.
- Trang thành công và email xác nhận khi hạ tầng email sẵn sàng.
- Admin đăng/sửa/mở/đóng tin; danh sách hồ sơ có filter; xem hồ sơ và tải CV riêng tư.
- Admin cập nhật trạng thái, người phụ trách nếu cần, ghi chú và lịch hẹn đơn giản ngay trong hồ sơ.
- Ghi nhận kết quả nhận việc/từ chối/rút hồ sơ; thời hạn lưu và xóa cả CV theo chính sách.
- Quyền truy cập, validation server, rate limit, chống submit lặp và lịch sử sửa trạng thái.

### Bỏ khỏi phạm vi mặc định

Không triển khai account/portal ứng viên, OTP tra cứu, Kanban, workflow duyệt nhiều cấp, cấu hình pipeline, bài test, scorecard, lịch calendar riêng, đồng bộ Google Calendar, nhắc lịch tự động, cổng offer/chữ ký, talent pool, job alert, referral, dashboard funnel, export Excel, AI chấm CV, payroll/onboarding và hệ thống CMS tuyển dụng riêng.

Phỏng vấn, trao đổi lương và đề nghị nhận việc được người phụ trách thực hiện qua kênh liên hệ chính thức; admin ghi lịch hẹn/kết quả. Yêu cầu rút hồ sơ hoặc xóa dữ liệu được xử lý qua liên hệ có xác minh. Không hứa có chức năng tra cứu online chưa xây.

## 4. Schema tối thiểu

Trường `?` là tùy chọn, chỉ lưu khi dùng. Tên trường giữ rõ nghĩa; không rút thành ký hiệu khó bảo trì. Ngày giờ lưu UTC, hiển thị Asia/Saigon; tiền VND lưu số nguyên.

### 4.1. `recruitment_jobs` — tin tuyển dụng

| Trường | Ý nghĩa |
|---|---|
| `_id` | ObjectId; một tin tương ứng một đợt tuyển |
| `slug` | URL duy nhất |
| `title` | Tên vị trí |
| `department?` | Nhãn phòng ban nếu cần; không tạo bảng phòng ban |
| `locations` | Các nơi làm việc; nhúng `[{key, city, address}]`; một tin có thể có nhiều địa chỉ như TMA, không cần bảng địa điểm |
| `jobCategory?`, `level?` | Ngành nghề và cấp bậc; nhãn tùy chọn theo cách trình bày JobsGO |
| `experienceRequirement` | `{mode, minMonths?, maxMonths?}`; `mode`: none/required; số tháng hỗ trợ yêu cầu 6 tháng |
| `educationRequirement?` | Bằng cấp tối thiểu; enum có `not_required` |
| `vacancies?` | Số lượng cần tuyển, số nguyên dương; hiển thị khi admin nhập |
| `employmentType` | `full_time`, `part_time`, `intern`, `temporary`; UI chỉ hiển thị loại đang dùng |
| `shiftDescription?` | Ca/giờ làm |
| `description`, `requirements`, `benefits` | Nội dung JD, giới hạn độ dài, sanitize nếu HTML |
| `salary` | `{mode, min?, max?, period}`; mode negotiated/range/from/up_to, period month/hour; VND cố định; chỉ chứa lương được phép công bố |
| `cvRequired` | Vị trí có bắt CV không; mặc định false |
| `status` | `draft`, `open`, `closed` |
| `publishedAt?`, `deadlineAt?` | Ngày đăng tự tạo khi mở lần đầu; hạn nhận bắt buộc trước khi mở tin, theo thẻ TMA |
| `createdBy`, `updatedBy` | Tham chiếu tài khoản quản trị hiện có |
| `createdAt`, `updatedAt`, `version` | Thời điểm và phiên bản chống ghi đè |

Không lưu `hiredCount` hoặc tổng hồ sơ như số đếm thứ hai; tính từ applications khi admin cần. `vacancies` là số lượng tuyển công khai theo tin JobsGO, không phải một module quản lý định biên/ngân sách. Không tạo mã việc bên cạnh slug/ObjectId nếu UI không cần. Đợt tuyển mới tạo document mới và slug mới.

JD đã xuất bản chỉ sửa diễn đạt; thay đổi đáng kể về vị trí, địa điểm, lương hoặc yêu cầu phải đóng và tạo tin/đợt mới. Cách này tránh phải sao chép toàn bộ JD vào mỗi hồ sơ; nếu cần lưu mọi phiên bản chính xác về sau thì thêm job revision có chủ đích.

### 4.2. `recruitment_applications` — hồ sơ và quá trình xử lý

| Trường | Ý nghĩa |
|---|---|
| `_id`, `jobId?` | ID hồ sơ; jobId bắt buộc với ứng tuyển tin, không có với form liên hệ chung |
| `submissionType` | `job_application` hoặc `general_interest`; backend kiểm tra điều kiện tương ứng |
| `interestedPosition` | Vị trí quan tâm; server lấy title của tin nếu ứng tuyển cụ thể, ứng viên nhập nếu liên hệ chung |
| `locationPreference` | `{mode: selected/any, locations?: [{key, city, address?}]}`; selected phải có nơi đã kiểm tra bởi server, any không có locations |
| `experienceLevel` | `experienced`, `new_graduate`, `intern`, `no_experience`; phù hợp form TMA và công việc Aloha |
| `publicCode` | Mã biên nhận ngẫu nhiên duy nhất; không cấp quyền xem hồ sơ |
| `idempotencyKey`, `requestHash` | Nhận diện lần submit và nội dung; retry cùng key/cùng nội dung trả kết quả cũ, khác nội dung trả 409 |
| `jobSummary?` | `{title, locations, employmentType}` tại lúc nộp; chỉ có với ứng tuyển tin |
| `contact` | `{fullName, email, phone}`; chuẩn hóa email/phone phục vụ tìm kiếm, không tự xác minh danh tính |
| `experienceSummary?` | Kinh nghiệm nhập tay; bắt buộc khi vị trí cần và không có CV |
| `cv?` | `{storageKey, originalName, mimeType, sizeBytes, scanStatus}`; metadata của tối đa một CV |
| `status` | `new`, `reviewing`, `interviewing`, `offered`, `hired`, `rejected`, `withdrawn` |
| `assignedTo?` | Người xử lý; bỏ khỏi UI nếu chỉ một người quản lý |
| `appointment?` | `{startsAt, mode, locationOrLink, note?}`; một lịch sắp tới, người phụ trách đặt và liên hệ thủ công |
| `notes` | Ghi chú ngắn `{id, authorId, text, createdAt}` |
| `history` | Sự kiện `{id, actorId, action, fromStatus?, toStatus?, at, reason?}`; gồm tạo hồ sơ, chuyển trạng thái, đổi lịch và kết quả |
| `confirmation?` | `{status, attempts, nextAttemptAt?, leaseUntil?, lastErrorCode?, sentAt?, messageKey}`; trạng thái email xác nhận duy nhất |
| `consent` | `{noticeVersion, acceptedAt, purpose}`; purpose `specific_job` hoặc `recruitment_contact`; không dùng cho marketing |
| `retentionUntil` | Hạn lưu theo chính sách đã duyệt |
| `createdAt`, `updatedAt`, `updatedBy?`, `version` | Thời điểm và phiên bản |

Không có candidateId, account mua hàng, CC​CD, tài khoản ngân hàng, profile dài hạn, expectedSalary, UTM hoặc portfolio nếu chưa có yêu cầu. Một người nộp hai vị trí tạo hai hồ sơ độc lập. Chấp nhận lặp vài trường liên hệ để tránh quản lý thêm danh tính/gộp hồ sơ/xóa liên collection.

Không unique theo email/phone nhập từ public form: người khác có thể nhập thông tin đó, chặn người thật. Chống retry bằng idempotency; rate limit chống spam; đánh dấu nghi trùng theo job/email để HR kiểm tra. Nếu cần bảo đảm mỗi người một hồ sơ thì phải thêm xác thực liên hệ, không giả định email nhập tay đã được xác minh.

### 4.3. Giới hạn nhúng và các thao tác atomic

- Giới hạn chuỗi: họ tên 150 ký tự, email 254, điện thoại 30, kinh nghiệm 5.000, mỗi ghi chú 2.000; kiểm tra cả tổng kích thước payload.
- Đề xuất notes tối đa 50 mục và history tối đa 200 sự kiện/hồ sơ; kiểm tra trước khi ghi, không âm thầm xóa lịch sử cũ. Cảnh báo khi gần ngưỡng; nếu thực tế thường xuyên vượt thì tách event collection trước khi chạm ngưỡng. Các ngưỡng là cấu hình kỹ thuật cần xác nhận qua dùng thử.
- Giữ tổng document nhỏ hơn 256 KB ở bản đầu; không lưu nội dung email, file hoặc stack trace trong arrays. Giới hạn này thấp hơn nhiều so với giới hạn BSON 16 MiB.
- Cập nhật trạng thái, history và version trong cùng một update có điều kiện `version`; không cần transaction nhiều collection cho việc này.
- Không nhúng tất cả applications vào jobs: danh sách có thể tăng không giới hạn và cần phân trang độc lập.
- Email có trạng thái pending/retry/processing/sent/failed; worker claim bằng lease atomic và retry có giới hạn. Dùng messageKey idempotent nếu nhà cung cấp hỗ trợ; không hứa gửi đúng một lần khi provider không hỗ trợ. Email thất bại không mất hồ sơ.
- Khi nộp, kiểm tra tin mở/hạn; với race đóng tin, quy định hồ sơ hợp lệ nếu đã được kiểm tra tại thời điểm tiếp nhận. Nếu nghiệp vụ yêu cầu ranh giới đóng tuyệt đối, bổ sung transaction/điều phối sau khi xác minh deployment; không tự khẳng định hai collection cập nhật atomic cùng nhau.

### 4.4. Index ban đầu

Các collection có index `_id` mặc định. Chỉ thêm index gắn với truy vấn thực tế:

| Collection | Index | Mục đích |
|---|---|---|
| jobs | `{slug: 1}` unique | Chi tiết việc và URL duy nhất |
| jobs | `{status: 1, publishedAt: -1, _id: -1}` | Danh sách việc mở theo thứ tự ổn định |
| applications | `{publicCode: 1}` unique | Mã biên nhận |
| applications | `{idempotencyKey: 1}` unique | Chống cùng lần submit tạo hai hồ sơ |
| applications | `{jobId: 1, status: 1, createdAt: -1, _id: -1}` | Filter hồ sơ theo vị trí/trạng thái |
| applications | `{createdAt: -1, _id: -1}` | Inbox tất cả hồ sơ |
| applications | `{retentionUntil: 1}` | Worker tìm hồ sơ tới hạn xóa |
| applications | `{confirmation.nextAttemptAt: 1}` partial cho pending/retry | Chỉ tạo nếu bật worker email; hỗ trợ lấy việc chờ gửi |

Không tạo index cho tất cả trường. Dùng `explain` với truy vấn thực tế trước khi thêm index người phụ trách hoặc email. Với số tin nhỏ, UI chỉ lọc địa điểm/hình thức và tìm từ khóa có giới hạn; chưa dùng Elasticsearch, Atlas Search hoặc cache Redis riêng. Lọc status toàn bộ inbox có thể cần index riêng khi đo thấy cần.

Không dùng TTL xóa applications trực tiếp vì còn CV ở kho tệp. Worker xóa tệp trước rồi xóa hồ sơ, thao tác idempotent; lỗi xóa tệp cần retry/cảnh báo.

## 5. Mười một collection cũ được xử lý ra sao?

| Đề xuất cũ | Quyết định mới |
|---|---|
| `recruitment_jobs` | Giữ và rút trường |
| `recruitment_applications` | Giữ, chứa dữ liệu liên quan của một hồ sơ |
| `recruitment_candidates` | Bỏ; nhúng contact vào hồ sơ |
| `recruitment_files` | Bỏ collection; nhúng metadata CV, file lưu riêng |
| `recruitment_interviews` | Bỏ collection; nhúng một lịch hẹn sắp tới |
| `recruitment_evaluations` | Bỏ chức năng scorecard; dùng notes |
| `recruitment_offers` | Bỏ cổng offer; trao đổi thủ công, ghi trạng thái/kết quả |
| `recruitment_events` | Bỏ collection; nhúng history có giới hạn |
| `recruitment_outbox` | Bỏ collection; nhúng trạng thái email xác nhận |
| `recruitment_access_tokens` | Bỏ; không có portal/OTP |
| `recruitment_settings` | Bỏ; cấu hình cố định bằng mã/env, thông báo quyền riêng tư có version |

Không tạo trước các collection “để sau dùng”. Nếu dùng GridFS để lưu CV sẽ có collection kỹ thuật bổ sung; bản này chọn kho tệp riêng để tránh phát sinh đó. Không dùng Redis làm nơi duy nhất lưu lịch sử hoặc trạng thái email cần bền vững.

## 6. Luồng vận hành đầy đủ nhưng đơn giản

1. Quản trị tạo tin draft, xem trước, chuyển open khi nội dung và quyền lợi đã được xác nhận. Form liên hệ chung cuối trang nhận hồ sơ general_interest không cần tin đang mở.
2. Ứng viên mở danh sách/chi tiết, điền form một trang, tải CV nếu cần, đồng ý và gửi.
3. Server validate, kiểm tra tin với job_application hoặc kiểm tra vị trí/nơi làm mong muốn với general_interest, xử lý file riêng, lưu hồ sơ new cùng trạng thái email pending nếu có email.
4. Trả mã biên nhận; email gửi nền. Gửi lại cùng request không tạo hồ sơ mới. Người dùng thấy lỗi rõ khi file/form không hợp lệ.
5. Admin mở inbox, đọc CV, chuyển reviewing; liên hệ người phù hợp qua email/điện thoại chính thức.
6. Nếu phỏng vấn: nhập appointment, chuyển interviewing, liên hệ xác nhận thủ công; kết quả ghi notes/history.
7. Nếu đề nghị nhận việc: chuyển offered; HR trao đổi đề nghị bên ngoài. Nếu ứng viên từ chối, chuyển rejected kèm lý do nội bộ “từ chối đề nghị”; nếu xin rút, chuyển withdrawn.
8. Chỉ khi ứng viên thực tế đi làm, admin chuyển hired. Chấp nhận lời đề nghị chưa đồng nghĩa hired.
9. Đóng tin để ngừng nhận mới; hồ sơ cũ tiếp tục được xử lý. Đến hạn lưu, worker xóa CV và hồ sơ theo chính sách.

Các nhánh kết thúc có thể đi từ bước phù hợp; chuyển lùi/mở lại cần quyền và lý do. Không tự động từ chối hàng loạt khi đóng tin. Email/Zalo không được gửi thực tế bởi agent trong quá trình lập kế hoạch; đây là hành vi của hệ thống sau khi triển khai và vận hành.

## 7. API và quyền tối thiểu

| API đề xuất | Mục đích |
|---|---|
| `GET /api/recruitment/jobs` | Public listing, tìm từ khóa title, filter và phân trang giới hạn |
| `GET /api/recruitment/form-options` | Public: danh sách nơi làm từ cấu hình Aloha được xác nhận, cộng nơi của tin đang mở; không tạo collection danh mục |
| `GET /api/recruitment/jobs/:slug` | Public chi tiết tin đã công bố; tin đóng hiển thị trạng thái nhưng không cho nộp |
| `POST /api/recruitment/applications` | Form multipart job_application/general_interest, tối đa một file, kèm Idempotency-Key |
| `GET/POST /api/admin/recruitment/jobs` | Admin danh sách/tạo tin |
| `PATCH /api/admin/recruitment/jobs/:id` | Sửa/mở/đóng, kiểm tra quyền và expectedVersion |
| `GET /api/admin/recruitment/applications` | Inbox phân trang; response không chứa CV key/notes/history không cần thiết |
| `GET /api/admin/recruitment/applications/:id` | Chi tiết cho người được phép |
| `PATCH /api/admin/recruitment/applications/:id` | Sửa status/assignment/appointment, ghi history cùng update |
| `POST /api/admin/recruitment/applications/:id/notes` | Thêm ghi chú có author từ phiên admin |
| `GET /api/admin/recruitment/applications/:id/cv` | Kiểm tra quyền, trả file riêng tư với header tải phù hợp |
| `DELETE /api/admin/recruitment/applications/:id` | Xóa theo yêu cầu/chính sách; quyền riêng, xử lý file và retry |

Không public API xem hồ sơ bằng mã biên nhận. Dùng đăng nhập staff hiện có; quyền tối thiểu `recruitment.jobs.manage`, `recruitment.applications.manage`, `recruitment.data.delete`, kiểm tra phía server. Chỉ thêm phạm vi theo người/đội khi thực tế có nhiều nhóm cần cách ly; tuyệt đối không mở hồ sơ cho mọi tài khoản staff mặc định.

Bảo vệ bắt buộc: Zod server validation, sanitize JD, rate limit submit, CSRF cho cookie admin, optimistic concurrency, CV private. Multipart giới hạn dung lượng trước khi đọc toàn bộ; PDF tối đa 5 MB đề xuất cho bản đầu, kiểm tra nội dung và quét/cách ly trước khi cho tải. Nếu hạ tầng quét chưa có thì phát hành form kinh nghiệm nhập tay trước, chưa bật nhận CV.

Upload đi cùng submit, không có endpoint upload tạm riêng. Khi DB insert lỗi phải dọn file; nếu tiến trình chết, tác vụ dọn orphan đối chiếu storageKey có trong hồ sơ, có khoảng chờ an toàn. Key ngẫu nhiên do server tạo. Tệp không được đặt trong `/uploads` phục vụ công khai.

Consent chỉ dùng cho tuyển dụng. Không đưa email, phone, file hoặc ghi chú vào analytics/log. Thời hạn lưu và thông báo xử lý dữ liệu phải được Aloha xác nhận trước khi bật form; không tự chọn một số tháng làm nghĩa vụ pháp luật.

## 8. UI/UX tối thiểu

- `/tuyen-dung`: giới thiệu gọn + thanh tìm kiếm + thẻ việc theo ảnh TMA + phân trang + form “Hãy để Aloha kết nối với bạn” + liên hệ + link tuyển CTV.
- `/tuyen-dung/[slug]`: JD đầy đủ, CTA ứng tuyển và form ngay trang hoặc dialog toàn màn hình trên mobile; không thêm route wizard riêng.
- `/admin/tuyen-dung/viec-lam`: bảng tin và form soạn/sửa/xem trước.
- `/admin/tuyen-dung/ho-so`: inbox, filter việc/trạng thái, chi tiết bằng drawer hoặc trang nếu CV cần nhiều không gian. Không dashboard/calendar/Kanban riêng.
- Thông báo quyền riêng tư có đường dẫn ổn định từ form, nội dung có version; trang admin và nội dung cá nhân noindex.

Mobile từ 360 px, label rõ, focus lỗi đầu tiên, nút chạm khoảng 44 px, loading/retry/empty state. Form chỉ bắt họ tên/email/điện thoại/consent và yêu cầu riêng của vị trí. Không bắt đăng nhập hoặc bắt thư xin việc. Trang thành công nêu mã biên nhận và cách liên hệ; không hứa phỏng vấn hoặc thời hạn chưa được duyệt. Không lưu CV và thông tin cá nhân vào localStorage.

Dùng nhận diện/component sẵn có của Aloha; title/description SEO lấy từ JD thay vì thêm nhiều trường SEO tùy chỉnh. Nội dung ảnh/văn hóa/quyền lợi phải có thật. Không có tin thì hiển thị liên hệ và tuyển CTV, không tạo tin mẫu gây hiểu nhầm.

## 9. Tối ưu theo hạ tầng hiện hữu

Đã xác minh dự án dùng Next.js/React/TypeScript, Express, MongoDB, Redis; có auth staff và tuyển CTV. Server: `backend/shop_standalone_server.ts`. Tạo module `backend/shopRecruitment/` và components/API client tuyển dụng theo convention repo. Không thêm database, microservice, queue server, thư viện UI hoặc công cụ tìm kiếm mới nếu chưa cần.

Worker email và retention có thể chạy trong backend hiện tại, nhưng claim/lease trong MongoDB để nhiều process không xử lý cùng việc. Listing public chỉ đọc projection trường công khai; inbox không tải toàn bộ notes/history; phân trang ổn định. Dùng aggregation đếm hồ sơ khi admin cần, chưa tạo collection báo cáo hoặc số đếm đồng bộ thứ hai.

Không tự động cache thêm lớp: tin ít và cập nhật không thường xuyên, đo trước. Không dùng regex không giới hạn cho inbox lớn. Khi có dữ liệu thực, kiểm tra explain, thời gian API, dung lượng document và tỷ lệ lỗi; tối ưu theo nút thắt đo được.

## 10. Kiểm thử và triển khai

Ước lượng sơ bộ: 8–12 ngày làm việc cho một lập trình viên với nội dung đã có; thêm 2–4 ngày nếu phải dựng email/kho file/quét file. Đây là phạm vi gọn mới, thay thế dự toán 5–7 tuần của bản nhiều tính năng. Cần rà code và hạ tầng trước khi cam kết.

1. 1–2 ngày: chốt JD thật, schema, quyền, retention, wireframe và cơ chế file/email.
2. 2–3 ngày: jobs API/admin/public listing và JD.
3. 3–4 ngày: applications, form, private CV hoặc kinh nghiệm nhập tay, inbox, trạng thái/history, email nếu có.
4. 2–3 ngày: tác vụ xóa/dọn file, kiểm thử nghiệp vụ/quyền/race và UAT mobile.

Nghiệm thu: đăng một tin thật → nộp trên mobile → nhận biên nhận → admin xử lý/phỏng vấn → ghi đề nghị → hired hoặc kết thúc; tin đóng không nhận mới theo quy tắc tiếp nhận đã định; retry không tạo hồ sơ trùng; thiếu quyền không đọc CV; sửa đồng thời trả conflict; email lỗi không mất hồ sơ; file lỗi bị từ chối; worker xóa đủ file/dữ liệu; form không mất nội dung khi lỗi mạng. Kiểm tra chỉ tạo hai collection tuyển dụng dự kiến.

Tài liệu chưa triển khai runtime nên chưa chạy test ứng dụng. Khi triển khai cần test transition, idempotency, private file, quyền, worker và luồng nộp/xử lý; không tạo test cho mọi trường chỉ để lặp lại schema.

## 11. Khi nào mới mở rộng?

- Nhiều hồ sơ vượt ngưỡng lịch sử, có audit truy vấn độc lập: tách events có kế hoạch migration, không cắt lịch sử.
- HR thực sự dùng nhiều vòng/người phỏng vấn và lịch chung: thêm interviews; chưa thêm scorecard nếu không dùng.
- Ứng viên thường xuyên cần tra cứu nhiều hồ sơ: xác nhận nhu cầu portal rồi thêm danh tính/token an toàn; không truy cập chỉ bằng publicCode.
- Nhiều loại email/nhắc lịch: tách outbox khi trạng thái gửi nhúng không còn phù hợp.
- Có talent pool được phê duyệt và quy trình consent/retention riêng: mới tách candidates.

Trước khi lập trình chỉ cần chốt vị trí đầu tiên, người quản lý, CV có cần không, email có sẵn không và chính sách xử lý/lưu hồ sơ. Các chức năng bị bỏ không thuộc backlog phải làm; chỉ xem xét lại khi có nhu cầu thực tế.

## 12. Chốt trường admin → backend → shop theo JobsGO và hai ảnh TMA

Phần này cập nhật yêu cầu ngày 05/10/2026 và áp dụng cho các mục schema/UI phía trên. Vẫn chỉ có hai collection. Tất cả thuộc tính của **một tin tuyển dụng** nằm chung một document `recruitment_jobs`; hồ sơ gửi tới Aloha nằm trong `recruitment_applications`, không nhúng danh sách ứng viên vào tin.

### 12.1. Nguồn đã kiểm tra

- [Tin JobsGO được khảo sát](https://jobsgo.vn/viec-lam/nhan-vien-hanh-chinh-van-phong-luong-tu-9-12-trieu-26377343290.html): công khai chức danh, lương, nơi làm, kinh nghiệm, bằng cấp, hạn nộp; nội dung mô tả/yêu cầu/quyền lợi; ngành nghề, loại hình, cấp bậc, ngày đăng, số lượng tuyển. Đây là các trường trên tin public, chưa xác minh form admin nội bộ của JobsGO. Không lấy ngày hạn hoặc “còn N ngày” từ tin mẫu làm dữ liệu thật của Aloha.
- [Trang TMA](https://www.tma.vn/tuyen-dung/viec-lam) và hai ảnh người dùng: thanh tìm kiếm; thẻ chức danh, địa chỉ, hạn, nút chi tiết; form họ tên/email/điện thoại/nơi làm/vị trí quan tâm/kinh nghiệm/CV/đồng ý. Trang có các lựa chọn kinh nghiệm đã có kinh nghiệm, mới ra trường, thực tập. Aloha bổ sung chưa có kinh nghiệm cho nhu cầu bán hàng/kho nếu phù hợp.

Các kiểu dữ liệu, cách nhóm admin và mapping dưới đây là thiết kế riêng cho Aloha. Không sao chép chức năng sàn nhiều nhà tuyển dụng như profile công ty, đăng nhập tìm việc, AI đánh giá CV, quảng cáo tin, chat hoặc chia sẻ CV cho nhà tuyển dụng khác.

### 12.2. Một bảng ánh xạ toàn bộ trường tin tuyển dụng

Ký hiệu: **B** bắt buộc trước khi mở tin; **T** tùy chọn; **S** server tạo. Tin nháp cho phép thiếu trường nhưng không được xuất bản.

| Trường trên admin | Backend trong recruitment_jobs | Kiểu / mức | Shop frontend tương ứng |
|---|---|---|---|
| Tên công việc/vị trí | `title` | string, B | Tiêu đề thẻ TMA, H1 chi tiết, vị trí điền sẵn khi ứng tuyển |
| Đường dẫn tin | `slug` | string unique, S từ title | URL chi tiết; admin có thể sửa trước mở lần đầu; giữ ổn định sau đó |
| Phòng ban | `department` | string, T | Dòng tóm tắt chi tiết nếu có; không bắt filter |
| Ngành nghề | `jobCategory` | string, T | Chi tiết nếu có, phân biệt với phòng ban |
| Cấp bậc | `level` | enum, T | Thực tập/nhân viên/chuyên viên/trưởng nhóm/quản lý trong tóm tắt |
| Loại hình làm việc | `employmentType` | enum, B | Toàn thời gian/bán thời gian/thực tập/thời vụ |
| Nơi làm việc | `locations` | array 1–5 địa điểm, B | Địa chỉ đầy đủ trên thẻ giống TMA và trang chi tiết |
| Kinh nghiệm yêu cầu | `experienceRequirement` | object, B; mặc định không yêu cầu | Không yêu cầu / từ N tháng-năm / khoảng N–M trên chi tiết |
| Bằng cấp | `educationRequirement` | enum, T | Không yêu cầu/THPT/trung cấp/cao đẳng/đại học trong chi tiết; vắng thì ẩn |
| Số lượng tuyển | `vacancies` | integer > 0, T | “Số lượng tuyển: N” ở chi tiết; không tính người đã tuyển từ trường này |
| Cách hiển thị lương | `salary.mode` | enum, B; mặc định negotiated | Thỏa thuận / khoảng / từ / đến |
| Lương tối thiểu/tối đa | `salary.min`, `salary.max` | integer VND, tùy mode | Format tiền từ số đã lưu; không lưu thêm salaryText |
| Đơn vị tính lương | `salary.period` | month/hour, B khi có số | “VNĐ/tháng” hoặc “VNĐ/giờ” ở chi tiết |
| Thời gian/ca làm | `shiftDescription` | string, T | Khối thời gian làm việc khi có |
| Mô tả công việc | `description` | rich text giới hạn, B | Khối “Mô tả công việc” |
| Yêu cầu công việc | `requirements` | rich text giới hạn, B | Khối “Yêu cầu công việc” |
| Quyền lợi | `benefits` | rich text giới hạn, B | Khối “Quyền lợi được hưởng” |
| Hạn nộp hồ sơ | `deadlineAt` | date, B | “Ngày hết hạn: dd/MM/yyyy” trên thẻ; hạn nộp trên chi tiết |
| Ngày đăng | `publishedAt` | date, S | Ngày đăng trên chi tiết; không đồng nhất ngày tạo nháp |
| Có yêu cầu CV | `cvRequired` | boolean, B; mặc định false | Form đánh dấu CV bắt buộc chỉ khi tin yêu cầu |
| Trạng thái tin | `status` | draft/open/closed, B | Quyết định hiển thị và cho phép nộp; không hiện nhãn nháp ở shop |
| Người tạo/sửa, ngày tạo/sửa, version | các trường quản trị hiện có | S | Chỉ admin; public API không trả |

Tên/logo/giới thiệu Aloha và liên hệ tuyển dụng dùng thông tin thương hiệu/cấu hình hiện hữu đã xác nhận; không nhập lặp trong mỗi tin, không tạo companyId hoặc bảng công ty riêng. Không lấy địa chỉ TMA làm địa chỉ Aloha.

**Quy tắc lương:** negotiated không lưu min/max; range bắt cả hai và min ≤ max; from chỉ bắt min; up_to chỉ bắt max. Giá trị phải dương. VND cố định ở bản đầu. Nếu thu nhập gồm hoa hồng/phụ cấp, mô tả rõ trong quyền lợi, tránh mặc định toàn bộ là lương cứng.

**Quy tắc hạn:** admin chọn ngày ở Asia/Saigon; server quy đổi cuối ngày đó sang UTC, hết hạn khi thời gian hiện tại vượt hạn. Không dùng 00:00 đầu ngày khiến tin hết hạn sớm. Hạn phải tương lai khi mở; tin status=open nhưng quá hạn cũng không nhận hồ sơ mới. Không cần worker cập nhật status chỉ để hiển thị hết hạn.

**Quy tắc nơi làm:** mỗi địa điểm có key ổn định, city, address; không lưu thêm chuỗi địa chỉ thứ hai nếu có thể format từ dữ liệu gốc. Tin có nhiều địa chỉ hiển thị từng dòng. Giới hạn năm địa điểm là đề xuất kỹ thuật, không phải giới hạn của TMA.

### 12.3. Màn hình admin soạn tin

Một form, bốn nhóm; không tách thành bốn bảng DB:

1. **Thông tin việc:** tên, phòng ban/ngành nghề nếu cần, cấp bậc, loại hình, địa điểm, số lượng.
2. **Điều kiện và thu nhập:** kinh nghiệm, bằng cấp, lương, ca làm.
3. **Nội dung:** mô tả, yêu cầu, quyền lợi.
4. **Đăng tin:** hạn nhận, yêu cầu CV, trạng thái; nút lưu nháp, xem trước, mở tin hoặc đóng tin.

Danh sách admin hiển thị các cột: tên vị trí, nơi làm, loại hình, lương, hạn, trạng thái, số hồ sơ và thao tác. Số hồ sơ lấy bằng aggregation trên applications theo jobId; không lưu số đếm lặp trong jobs. Trường tùy chọn ẩn trong nhóm mở rộng nếu HR chưa cần; trước khi mở tin chỉ kiểm tra trường B. Xem trước phải dùng cùng renderer với shop để tránh hiển thị khác nhau.

### 12.4. Trang shop theo ảnh thứ nhất

Trang `/tuyen-dung` có thanh tìm kiếm rộng và nút “Tìm kiếm”, bên dưới là thẻ bo góc trên nền nhẹ. Dùng màu thương hiệu Aloha. Mỗi thẻ mặc định chỉ có tên vị trí, icon địa chỉ + nơi làm, icon lịch + hạn, nút “Xem chi tiết”, giữ bố cục thoáng như ảnh TMA. Lương/kinh nghiệm và các thuộc tính JobsGO hiển thị đầy đủ ở trang chi tiết, không nhét tất cả vào thẻ.

Search theo title, trim từ khóa, giới hạn độ dài và phân trang từ server; Enter tương đương bấm nút. Escape ký tự nếu dùng regex, không nhận regex thô từ người dùng. Với ít tin chưa thêm search engine hoặc index text. Không có kết quả thì hiện thông báo và nút xóa từ khóa; form liên hệ chung vẫn có bên dưới. Bản đầu 10 tin/trang, thứ tự publishedAt giảm dần rồi _id.

Chi tiết `/tuyen-dung/[slug]`: H1 → tóm tắt lương/địa điểm/kinh nghiệm/bằng cấp/loại hình/cấp bậc/số lượng/ngày đăng/hạn → mô tả → yêu cầu → quyền lợi → thời gian làm nếu có → nút ứng tuyển. Mỗi trường hiển thị từ API, không hardcode từng tin. Trường tùy chọn vắng thì ẩn; yêu cầu không có bằng cấp khác với chưa nhập bằng cấp. Tin hết hạn có thông báo, tắt CTA nộp cho tin đó và vẫn cho liên hệ chung.

### 12.5. Form shop theo ảnh thứ hai

Tiêu đề “Hãy để Aloha kết nối với bạn”, mô tả “Để lại thông tin, Aloha sẽ liên hệ khi có công việc phù hợp”. Desktop phần giới thiệu/minh họa bên trái, form hai cột bên phải; mobile một cột. Dùng minh họa Aloha có quyền sử dụng hoặc bố cục chữ; không lấy ảnh nhân vật/logo TMA.

| Ô form | Backend trong recruitment_applications | Quy tắc |
|---|---|---|
| Họ và tên * | `contact.fullName` | Bắt buộc, trim |
| Email * | `contact.email` | Bắt buộc, validation và normalize |
| Số điện thoại * | `contact.phone` | Bắt buộc; chấp nhận định dạng hợp lệ theo thị trường Aloha |
| Nơi làm việc mong muốn * | `locationPreference` | Chọn địa điểm do server cung cấp hoặc “Tất cả”; không nhập địa chỉ tùy ý |
| Công việc/Vị trí quan tâm * | `interestedPosition` | Form chung nhập text; ứng tuyển tin điền sẵn và server lấy title từ jobId |
| Kinh nghiệm * | `experienceLevel` | Dropdown đã có kinh nghiệm/mới ra trường/thực tập/chưa có kinh nghiệm |
| Mô tả kinh nghiệm | `experienceSummary` | Tùy chọn; yêu cầu khi cần thay CV theo quy tắc vị trí; không làm form dài mặc định |
| Đính kèm CV | `cv` | Tối đa một file; metadata riêng tư; form chung tùy chọn, tin cụ thể theo cvRequired |
| Đồng ý thông báo xử lý dữ liệu * | `consent` | Checkbox không chọn sẵn; server ghi version, purpose và thời điểm |
| Gửi | `submissionType`, `jobId?` | general_interest ở cuối danh sách; job_application khi ứng tuyển một tin |

`experienceLevel` là tình trạng của **ứng viên**, khác `experienceRequirement` là điều kiện của **tin**. Không dùng chung một trường cho hai nghĩa. Không cho ứng viên chọn “Tất cả” như cách vượt yêu cầu địa điểm: với ứng tuyển tin, any chỉ có nghĩa sẵn sàng làm ở các nơi của tin; selected phải là tập con locations của tin. Form chung chọn nơi từ cấu hình Aloha.

Danh mục nơi làm trả qua form-options từ cấu hình được Aloha xác nhận, cộng địa điểm đang tuyển. Khi chưa có tin vẫn cho phép chọn nơi hợp lệ từ cấu hình; không tạo dropdown rỗng và cũng không giả địa chỉ. Key không hợp lệ trả lỗi trường.

Form general_interest bổ sung đúng nhu cầu ảnh TMA nhưng không xây account/talent pool chuyên dụng. Phải ghi rõ mục đích liên hệ cho cơ hội phù hợp, hạn lưu và cách rút/xóa; không tái sử dụng consent ứng tuyển một tin cho mục đích này. Admin filter theo submissionType; hồ sơ chung không có jobId, hiển thị nhãn “Liên hệ tuyển dụng” cùng vị trí quan tâm. Muốn chuyển sang quy trình cho một tin, HR liên hệ ứng viên xác nhận rồi ghi jobId/jobSummary và history; không tự gán việc trái mong muốn.

Hai loại submit dùng chung endpoint nhưng schema phân biệt theo submissionType. Thành công hiển thị mã biên nhận; lỗi giữ thông tin form, focus lỗi, cho retry. Email xác nhận phân biệt “đã nhận hồ sơ cho vị trí…” và “đã nhận thông tin quan tâm tuyển dụng…”. Không hứa chắc sẽ có công việc phù hợp.

### 12.6. API public và nghiệm thu bổ sung

Jobs listing trả `_id, slug, title, locations, deadlineAt` cùng pagination; chỉ trả tin open còn hạn. Jobs detail trả trường công khai theo bảng mapping; backend không trả createdBy/updatedBy/version trong public DTO. Tin draft không truy cập được bằng slug. Form-options chỉ trả nơi làm/nhãn kinh nghiệm/giới hạn file và version thông báo công khai.

Phải kiểm thử cả tin nhiều địa điểm, lương khoảng/từ/đến/thỏa thuận, kinh nghiệm 6 tháng, hạn cuối ngày, trường tùy chọn, search không kết quả, general_interest không có jobId, ứng tuyển tin bị sửa title giả trong request, địa điểm không hợp lệ, CV tùy chọn/bắt buộc và consent sai purpose. Worker retention/email phải xử lý cả hai loại hồ sơ. Index jobId vẫn dùng cho hồ sơ tin; inbox chung dùng index createdAt; thêm index submissionType chỉ khi truy vấn thực tế cần.

Form liên hệ chung không có đợt tuyển để tự kết thúc, nên phải có retentionUntil ngay lúc nhận; không lưu vô thời hạn để chờ cơ hội. Phần xây dựng/mapping form mới dự kiến thêm 1–2 ngày vào ước lượng bản gọn, tùy cấu hình nơi làm và nội dung privacy đã sẵn sàng.

## 13. Đánh giá gộp hồ sơ vào `aloha_shop_accounts`

Đã kiểm tra code hiện tại: tên collection trong `backend/shopAuth/models.ts` là `aloha_shop_accounts`; roles hiện có customer/ctv/si; email có unique index. Đăng ký trong `backend/shopAuth/routes.ts` kiểm tra email tồn tại và tạo tài khoản/phiên đăng nhập. API quản trị account trong `backend/shopAuth/adminRoutes.ts` đọc document rồi ánh xạ qua `toPublicShopAccount`; mapper này liệt kê trường cụ thể, chưa có trường tuyển nhân viên.

**Kết luận: có thể gộp về kỹ thuật, nhưng giữ `recruitment_applications` riêng phù hợp hơn với form không bắt đăng nhập đã chọn.** Hồ sơ là một lần ứng tuyển/để lại thông tin, không đồng nghĩa một tài khoản. Một người có nhiều lần nộp với kết quả, CV, lịch sử và hạn lưu khác nhau.

| Phương án | Tác động | Quyết định |
|---|---|---|
| Nhúng `recruitment.applications[]` trong account | Cần tài khoản hoặc xác thực trước khi gắn hồ sơ; phức tạp khi phân trang/tìm theo tin/cập nhật phần tử/xóa theo hạn; document account lớn dần | Chưa áp dụng |
| Tạo document loại applicant trong accounts cho mỗi hồ sơ | Email unique hiện có xung đột; phải đổi index, truy vấn danh sách/thống kê và mọi luồng auth liên quan | Chưa áp dụng |
| Tạo account ẩn cho khách nộp hồ sơ | Có thể chiếm email của người thật và làm luồng đăng ký báo đã tồn tại; cần sửa đăng ký/xác minh/chuyển đổi account | Chưa áp dụng |
| Hồ sơ riêng, `accountId?` tham chiếu account hiện có | Khách vẫn nộp được; dữ liệu tuyển dụng có quyền/lifecycle riêng; liên kết tài khoản khi có phiên xác thực hợp lệ | Khuyến nghị |

Nếu người nộp đã đăng nhập, có thể bổ sung `accountId?` vào applications lấy từ phiên server, không nhận accountId tùy ý từ client. Giữ contact tại lúc nộp làm snapshot, không ghi đè tên/email/phone trong account từ form ứng tuyển. Nếu khách chỉ nhập email trùng account thì không tự gắn vào account đó; muốn liên kết về sau cần xác minh quyền sở hữu. Bản đầu không yêu cầu đăng nhập và không cần triển khai chức năng tự liên kết về sau.

CV, ghi chú HR và trạng thái tuyển không bổ sung vào DTO account mua hàng/CTV hoặc session. Xóa hồ sơ tuyển và CV không xóa tài khoản mua hàng; xóa account xử lý liên kết theo chính sách, không mặc định xóa hồ sơ tuyển ngay. Không thêm role applicant chỉ để đánh dấu đã nộp hồ sơ.

Nếu sau này bắt buộc mọi ứng viên có account và chỉ có một hồ sơ ngắn, có thể đánh giá lại embedding. Với nhu cầu hiện tại, giảm một collection sẽ làm tăng độ phức tạp của luồng account và tuyển dụng, chưa đem lại lợi ích rõ ràng. Quyết định mặc định vẫn tạo hai collection tuyển dụng.

## 14. Trạng thái triển khai (05/10/2026)

- Backend: `backend/shopRecruitment/` (đúng 2 collection, index theo mục 4.4, worker email/retention/dọn CV mồ côi). Frontend: `/tuyen-dung`, `/tuyen-dung/[slug]`, `/tuyen-dung/quyen-rieng-tu`, `/admin/tuyen-dung/viec-lam`, `/admin/tuyen-dung/ho-so`. Test: `tests/recruitment.test.ts`.
- Khác bản thiết kế để khớp repo: API nằm dưới `/api/shop/recruitment/...` và `/api/shop/admin/recruitment/...` (Next chỉ proxy `/api/shop/*`); CV gửi base64 trong JSON như upload bài viết (repo không có thư viện multipart); bảng `users` do app thu mua quản lý nên quyền mặc định là Quản lý, bật `RECRUITMENT_STRICT_PERMISSIONS=1` để kiểm thêm `recruitment.*` trong `users.permissions`; JD lưu văn bản thuần (hiển thị giữ xuống dòng), không nhận HTML.
- Tin đã đăng khóa nơi làm, lương, loại hình, kinh nghiệm, bằng cấp, yêu cầu CV, slug; admin dùng «Nhân bản» để tạo đợt mới.
- Bổ sung: nút «Ứng tuyển ngay» mở popup trên `/tuyen-dung` (đầu trang, từng thẻ việc làm, mục Kết nối, trang chi tiết dùng chung một form); khách đã đăng nhập được điền sẵn họ tên/email/SĐT và hồ sơ lưu `accountId` lấy từ phiên server; mọi hồ sơ lưu `source` (nơi bấm nộp). CV nhận PDF/DOC/DOCX, nhận diện theo nội dung, từ chối file Word có macro. Không thêm collection, không ghi vào `aloha_shop_accounts`.
- Cần Aloha chốt trước khi mở form (cấu hình trong `.env`): `RECRUITMENT_RETENTION_DAYS` (để trống = không nhận hồ sơ), `RECRUITMENT_LOCATIONS`, nội dung trang quyền riêng tư + `RECRUITMENT_PRIVACY_VERSION`. Nhận CV (`RECRUITMENT_CV_ENABLED`) mặc định tắt; khi bật cần nâng `client_max_body_size` của nginx (CV 5MB ≈ 6,7MB base64).
