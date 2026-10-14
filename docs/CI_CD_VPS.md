# CI/CD — deploy VPS qua GitHub Actions

## Deploy theo phiên bản (2026-10)

`scripts/deploy-production.sh` lấy source bằng `git archive` vào
`/root/aloha-shop-releases/<timestamp>-<commit>`, cài dependency bằng `npm ci`,
chạy hai typecheck và build ở đó. Không reset working tree hoặc build đè `.next`
của tiến trình đang phục vụ khách. `.env`, uploads và private CV dùng đường dẫn
dùng chung từ `/root/aloha-shop`.

Frontend dùng hai slot PM2: `aloha-shop` cổng 3002 và `aloha-shop-next` cổng 3003.
Slot mới phải trả HTTP thành công trước khi chuyển upstream Nginx. API vẫn chỉ
có một bộ worker trên cổng 3001; có khoảng gián đoạn ngắn khi chuyển API.
Nếu kiểm tra sau chuyển thất bại, script khôi phục cấu hình API và Nginx trước đó.
Bản frontend cũ được giữ tới lần deploy tiếp theo.

File JS/CSS có hash được giữ tại `/var/www/aloha-shop-static` và phục vụ với
cache immutable. HTML/RSC không cache tại Nginx; không bỏ qua Cache-Control
của Next. Release ID dùng `NEXT_PUBLIC_RELEASE_ID` và `deploymentId` để nhận
diện phiên bản. Không tự dọn release/assets; cần theo dõi dung lượng đĩa và
đặt chính sách lưu trước khi dọn.

Lỗi trình duyệt ghi vào log API với tiền tố `[client-error]`, gồm phiên bản,
đường dẫn bỏ query, trình duyệt và stack đã lọc một số thông tin nhạy cảm.
Endpoint giới hạn theo IP và tổng lượng; client gửi tối đa 5 lỗi khác nhau mỗi
lần tải trang. Cảnh báo hiển thị trong trang quản trị, không gửi ra ngoài.
Không gửi cookie, dữ liệu biểu mẫu hoặc localStorage.

Trang tổng quan quản trị có mục **Tình trạng website**, chỉ quản lý đã đăng nhập
được truy cập API `/api/shop/admin/site-health`. Mục này tự cập nhật mỗi phút khi
mở trang: số lỗi trong 15 phút/24 giờ, 20 báo cáo gần nhất và dung lượng ổ đĩa.
Cảnh báo từ 5 báo cáo trong 15 phút; dung lượng cảnh báo từ 80%, nghiêm trọng từ
90%. Báo cáo MongoDB có index thời gian và TTL 7 ngày, được xóa theo chu kỳ TTL
của MongoDB. Nếu VPS/website tắt thì cần hệ thống giám sát bên ngoài để nhận cảnh báo.

Workflow chạy typecheck API và frontend ở hai job song song, cùng regression test trước deploy. Runner và release đều
dùng commit SHA của workflow, tránh kiểm tra một commit nhưng deploy commit khác.

Sau deploy, **Quick browser checks** chạy riêng Chromium và WebKit ở hai job song song.
Mỗi trình duyệt chỉ chạy 5 ca `@smoke`: 4 trang công khai và API giám sát riêng tư.
Thời gian chạy test giới hạn 3 phút (không gồm cài đặt); dừng sau 2 ca lỗi.
Workflow **Full browser regression** chạy toàn bộ test trình duyệt lúc 03:00 giờ Việt Nam
hằng ngày, hoặc qua Run workflow khi thay đổi lớn. Bộ này giữ kiểm tra lỗi chunk,
cảnh báo quản trị, nhóm khách voucher và chia sẻ; giới hạn test 8 phút mỗi trình duyệt.
Báo cáo và trace lỗi được giữ ở artifact GitHub 3 ngày. Chỉ cài trình duyệt của job;
Chromium dùng `--only-shell`. Cache npm được dùng cho cả hai workflow; không cache
bộ trình duyệt lớn trên GitHub. Test không đăng nhập tài khoản
thật; báo cáo lỗi giả và lượt truy cập test được chặn tại trình duyệt, không ghi
vào dữ liệu khách hàng. WebKit emulation không thay thế kiểm tra iPhone vật lý.
Job browser chạy sau chuyển bản; nếu thất bại CI báo lỗi nhưng chưa tự rollback
dựa trên browser test. Rollback tự động hiện áp dụng cho các kiểm tra deploy HTTP.

## Kiểm tra nhanh tại máy

Chọn nhóm liên quan; không mặc định chạy `npm test` toàn repo:

```powershell
npm run test:quick -- sharing
npm run test:quick -- vouchers
npm run test:quick -- recovery
npm run test:quick -- sharing vouchers --dry-run
```

Lệnh không đối số chỉ in hướng dẫn, không chạy test. Các nhóm được khử trùng lặp;
không tải trình duyệt, không tự retry. Mỗi file test Node giới hạn 30 giây.
`npm run test:release` dành cho CI, giữ các regression bắt buộc và thêm test PDP voucher.
Chạy `npm run typecheck:api` hoặc `npm run typecheck:web` theo phần code đã đổi.
Kết quả đã đạt không cần chạy lại nếu không có thay đổi liên quan.

Nếu cần kiểm tra trình duyệt và máy đã có Playwright:

```powershell
npm test --prefix tests/browser-qa
npm run test:failed --prefix tests/browser-qa -- --project=chromium
```

Lệnh mặc định chỉ chạy Chromium smoke; full suite dùng `test:full` khi được yêu cầu.
Sau hai lần cùng một ca lỗi, đọc trace để xác định nguyên nhân trước khi chạy lại.
Không dùng `--repeat-each` hoặc lặp full suite cho sửa đổi thông thường.
Ảnh chụp bổ sung chỉ bật bằng `QA_DIAGNOSTIC_SCREENSHOTS=1`; báo cáo HTML local
chỉ bật bằng `QA_REPORT=1`. Trace và ảnh ca lỗi vẫn được giữ để điều tra.
Không xóa cache/browser cũ tự động. Lịch CI kiểm tra website đang triển khai, không
khẳng định source mới nhất trên `main` đã được triển khai; có thể khác phiên bản nếu deploy lỗi.

Kiểm tra sau deploy: trang chủ, `/tim`, trang sản phẩm, giỏ hàng, đăng nhập;
giữ tab cũ qua một lần deploy và xác nhận file JS cũ vẫn trả 200. Kiểm tra cache
HTML `private, no-store`, JS `immutable`, và log `[client-error]`.

Khôi phục thủ công: mỗi release giữ `nginx.before` và `api.before.json` (private).
Khôi phục Nginx, chạy `nginx -t` rồi reload; thay tiến trình `aloha-shop-api`
bằng config `api.before.json`, kiểm tra `/api/health`, rồi `pm2 save`.
Không chạy script deploy cũ hoặc `pm2 restart` theo đường dẫn root để nâng cấp.

## Luồng
Push / merge vào `main` → workflow **Deploy production** SSH vào VPS → lấy runner từ Git → build release riêng → kiểm tra → chuyển upstream.

Cũng chạy tay: GitHub → Actions → Deploy production → Run workflow.

## Setup 1 lần

### 1. Tạo SSH key cho CI và cài lên VPS
```powershell
$env:VPS_PASSWORD = "..."   # mật khẩu SSH VPS
powershell -File scripts/setup-gha-deploy-key.ps1
```

### 2. Thêm GitHub Secrets
Repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Name | Value |
|------|--------|
| `VPS_HOST` | `160.25.167.211` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | Toàn bộ file `~/.ssh/id_ed25519_aloha_gha_deploy` (kể cả dòng BEGIN/END) |

Với GitHub CLI:
```powershell
gh secret set VPS_HOST --body "160.25.167.211"
gh secret set VPS_USER --body "root"
gh secret set VPS_PORT --body "22"
gh secret set VPS_SSH_KEY < "$env:USERPROFILE\.ssh\id_ed25519_aloha_gha_deploy"
```

### 3. Kiểm tra
Push một commit lên `main` hoặc Run workflow thủ công. Xem log tại **Actions**.

## Lưu ý
- Không commit private key.
- VPS phải `git fetch` được `origin` (đã cấu hình sẵn).
- Deploy lấy source từ `origin/main`, không đưa thay đổi tay trên VPS vào release. Mọi sửa code phải có trong Git hoặc patch đã kiểm tra.
- `.env` trên VPS không nằm trong git nên được giữ nguyên.
