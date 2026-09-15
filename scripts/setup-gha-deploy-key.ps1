# One-time: tạo SSH key cho GitHub Actions deploy → cài public key lên VPS.
# Private key KHÔNG commit; thêm vào GitHub Secrets (VPS_SSH_KEY).
#
# Usage:
#   powershell -File scripts/setup-gha-deploy-key.ps1
#   (cần VPS_PASSWORD trong env, hoặc sẽ hỏi)

$ErrorActionPreference = "Stop"
$VpsHost = if ($env:VPS_HOST) { $env:VPS_HOST } else { "160.25.167.211" }
$VpsUser = if ($env:VPS_USER) { $env:VPS_USER } else { "root" }
$KeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519_aloha_gha_deploy"
$PubPath = "$KeyPath.pub"

$sshDir = Join-Path $env:USERPROFILE ".ssh"
if (-not (Test-Path $sshDir)) {
  New-Item -ItemType Directory -Path $sshDir | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  Write-Host "Tao khoa CI: $KeyPath"
  ssh-keygen -t ed25519 -f $KeyPath -N '""' -C "github-actions-aloha-shop-deploy"
} else {
  Write-Host "Da co khoa: $KeyPath"
}

$pub = (Get-Content $PubPath -Raw).Trim()
Write-Host "Cai public key len VPS..."

# Dùng ssh2 qua node nếu có password (non-interactive)
$pass = $env:VPS_PASSWORD
if (-not $pass) { $pass = $env:VPS_SSH_PASSWORD }

if ($pass) {
  $env:VPS_HOST = $VpsHost
  $env:VPS_USER = $VpsUser
  $env:VPS_PASSWORD = $pass
  $env:PUB_KEY_PATH = $PubPath
  node (Join-Path $PSScriptRoot "install-gha-deploy-key-on-vps.cjs")
} else {
  ssh -o StrictHostKeyChecking=accept-new "${VpsUser}@${VpsHost}" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys && echo KEY_INSTALLED"
}

Write-Host "Thu SSH bang key..."
ssh -i $KeyPath -o BatchMode=yes -o ConnectTimeout=10 "${VpsUser}@${VpsHost}" "echo KEY_OK && cd /root/aloha-shop && git rev-parse --short HEAD"

Write-Host ""
Write-Host "=== Them GitHub Secrets (repo Settings > Secrets > Actions) ==="
Write-Host "VPS_HOST     = $VpsHost"
Write-Host "VPS_USER     = $VpsUser"
Write-Host "VPS_PORT     = 22"
Write-Host "VPS_SSH_KEY  = (toan bo noi dung file private key ben duoi)"
Write-Host ""
Write-Host "Private key path: $KeyPath"
Write-Host "Mo file bang: notepad `"$KeyPath`""
Write-Host ""
Write-Host "Hoac neu co GitHub CLI:"
Write-Host "  gh secret set VPS_HOST --body `"$VpsHost`""
Write-Host "  gh secret set VPS_USER --body `"$VpsUser`""
Write-Host "  gh secret set VPS_PORT --body `"22`""
Write-Host "  gh secret set VPS_SSH_KEY < `"$KeyPath`""
