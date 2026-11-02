param(
  [string]$VpsHost = "160.25.167.211",
  [string]$VpsUser = "root"
)

$keyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519_aloha_vps"

Write-Host "Auto-reconnecting SSH tunnel to $VpsHost starting..."

while ($true) {
  try {
    ssh -N -L 27018:127.0.0.1:27017 -L 6380:127.0.0.1:6380 `
      -i $keyPath `
      -o IdentitiesOnly=yes `
      -o TCPKeepAlive=yes `
      -o ServerAliveInterval=15 `
      -o ServerAliveCountMax=4 `
      "$VpsUser@$VpsHost"
  } catch {
    Write-Host "SSH error: $_"
  }
  Write-Host "SSH tunnel disconnected, reconnecting in 2s..."
  Start-Sleep -Seconds 2
}
