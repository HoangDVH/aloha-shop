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

Workflow chạy typecheck và regression test trước deploy. Runner và release đều
dùng commit SHA của workflow, tránh kiểm tra một commit nhưng deploy commit khác.

Sau deploy, job **Verify browsers after deployment** chạy Playwright trên Chromium
và WebKit với cấu hình iPhone 13. Bộ test kiểm tra 4 trang công khai, reload một
lần khi lỗi chunk, màn hình phục hồi khi file JS trả 404, cảnh báo quản trị bằng
API fixture và việc API giám sát từ chối người chưa đăng nhập. Báo cáo, ảnh chụp
và trace lỗi được giữ ở artifact GitHub 7 ngày. Test không đăng nhập tài khoản
thật; báo cáo lỗi giả và lượt truy cập test được chặn tại trình duyệt, không ghi
vào dữ liệu khách hàng. WebKit emulation không thay thế kiểm tra iPhone vật lý.
Job browser chạy sau chuyển bản; nếu thất bại CI báo lỗi nhưng chưa tự rollback
dựa trên browser test. Rollback tự động hiện áp dụng cho các kiểm tra deploy HTTP.

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
