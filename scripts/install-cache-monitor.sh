#!/usr/bin/env bash
set -euo pipefail
cd "${APP_DIR:-/root/aloha-shop}"
test -f scripts/collect-public-cache-metrics.cjs
install -d -m 700 /var/log/aloha-cache-monitor
cat > /etc/systemd/system/aloha-cache-monitor.service <<'EOF'
[Unit]
Description=Aloha passive cache and API metrics snapshot
After=network.target
[Service]
Type=oneshot
WorkingDirectory=/root/aloha-shop
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env node scripts/collect-public-cache-metrics.cjs
UMask=0077
TimeoutStartSec=40
EOF
cat > /etc/systemd/system/aloha-cache-monitor.timer <<'EOF'
[Unit]
Description=Sample Aloha cache every five minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=15s
[Install]
WantedBy=timers.target
EOF
cat > /etc/logrotate.d/aloha-cache-monitor <<'EOF'
/var/log/aloha-cache-monitor/samples.jsonl {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0600 root root
}
EOF
systemctl daemon-reload
systemctl enable --now aloha-cache-monitor.timer
systemctl start aloha-cache-monitor.service
systemctl is-active aloha-cache-monitor.timer
