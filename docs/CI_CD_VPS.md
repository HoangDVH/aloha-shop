# CI/CD — deploy VPS qua GitHub Actions

## Luồng
Push / merge vào `main` → workflow **Deploy production** SSH vào VPS → `scripts/deploy-production.sh` (git pull + build + pm2 restart).

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
- Deploy dùng `git reset --hard origin/main` — thay đổi tay trên VPS sẽ bị ghi đè.
- `.env` trên VPS không nằm trong git nên được giữ nguyên.
