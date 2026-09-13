# One-time: create local SSH key and install on VPS (password once).
# After this, mongo tunnel can run in background without keeping a window open.

$ErrorActionPreference = "Stop"
$VpsHost = "160.25.167.211"
$VpsUser = "root"
$KeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519_aloha_vps"
$PubPath = "$KeyPath.pub"

$sshDir = Join-Path $env:USERPROFILE ".ssh"
if (-not (Test-Path $sshDir)) {
  New-Item -ItemType Directory -Path $sshDir | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  Write-Host "Tao khoa SSH: $KeyPath"
  ssh-keygen -t ed25519 -f $KeyPath -N '""' -C "aloha-mongo-tunnel"
} else {
  Write-Host "Da co khoa: $KeyPath"
}

$pub = (Get-Content $PubPath -Raw).Trim()
Write-Host ""
Write-Host "Sap cai public key len VPS (se hoi mat khau SSH 1 lan)..."
$remoteCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys && echo OK"
ssh -o StrictHostKeyChecking=accept-new "${VpsUser}@${VpsHost}" $remoteCmd

Write-Host ""
Write-Host "Thu dang nhap bang key (khong mat khau)..."
ssh -i $KeyPath -o BatchMode=yes -o ConnectTimeout=10 "${VpsUser}@${VpsHost}" "echo KEY_OK"

$configPath = Join-Path $sshDir "config"
$block = @"

Host aloha-vps
  HostName $VpsHost
  User $VpsUser
  IdentityFile $KeyPath
  IdentitiesOnly yes
"@

if (-not (Test-Path $configPath) -or -not (Select-String -Path $configPath -Pattern "Host aloha-vps" -Quiet)) {
  Add-Content -Path $configPath -Value $block -Encoding ascii
  Write-Host "Da them Host aloha-vps vao ~/.ssh/config"
}

Write-Host ""
Write-Host "Xong. Chay tunnel nen:"
Write-Host "  powershell -File scripts/start-vps-mongo-tunnel.ps1 -Detach"
