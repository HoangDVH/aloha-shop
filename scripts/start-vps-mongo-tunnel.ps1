# Tunnel Mongo VPS -> local :27018 (avoid Docker :27017)
# Shop standalone: MONGO_URI=mongodb://127.0.0.1:27018
#
# Usage:
#   powershell -File scripts/start-vps-mongo-tunnel.ps1
#   powershell -File scripts/start-vps-mongo-tunnel.ps1 -Detach
# Detach needs SSH key (run scripts/setup-vps-ssh-key.ps1 once).

param(
  [switch]$Detach
)

$ErrorActionPreference = "Stop"
$VpsHost = "160.25.167.211"
$VpsUser = "root"
$LocalPort = 27018
$KeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519_aloha_vps"

$existing = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Port $LocalPort dang mo - tunnel co the da chay."
  exit 0
}

$sshArgs = @("-N", "-L", "${LocalPort}:127.0.0.1:27017")
if (Test-Path $KeyPath) {
  $sshArgs += @("-i", $KeyPath, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3")
} elseif ($Detach) {
  Write-Host "Detach can SSH key. Chay truoc:"
  Write-Host "  powershell -File scripts/setup-vps-ssh-key.ps1"
  exit 1
}

$sshArgs += "${VpsUser}@${VpsHost}"

if ($Detach) {
  Write-Host "Mo tunnel nen: localhost:$LocalPort -> ${VpsHost}:27017"
  Start-Process -FilePath "ssh" -ArgumentList $sshArgs -WindowStyle Hidden
  Start-Sleep -Seconds 2
  $ok = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
  if ($ok) {
    Write-Host "OK - tunnel dang chay nen (khong can giu cua so)."
    exit 0
  }
  Write-Host "FAIL - khong listen :$LocalPort. Kiem tra SSH key / VPS."
  exit 1
}

Write-Host "Mo SSH tunnel: localhost:$LocalPort -> ${VpsHost}:127.0.0.1:27017"
if (-not (Test-Path $KeyPath)) {
  Write-Host "Nhap mat khau SSH neu duoc hoi. Giu cua so nay mo."
  Write-Host "Muon khong can cua so: chay setup-vps-ssh-key.ps1 roi -Detach."
}
ssh @sshArgs
