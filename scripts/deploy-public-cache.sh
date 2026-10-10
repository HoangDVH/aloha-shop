#!/usr/bin/env bash
# Run a reviewed patch package, not git reset/pull, so unrelated production work is preserved.
set -euo pipefail
APP_DIR=/root/aloha-shop
PACKAGE_DIR="${1:?package directory required}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/root/aloha-cache-backups/$STAMP"
cd "$APP_DIR"
git apply --check "$PACKAGE_DIR/backend.patch"
test ! -e backend/cache/readCache.ts
test ! -e /etc/redis/redis-shop-cache.conf
test -z "$(ss -ltnH 'sport = :6380')"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cp .env "$BACKUP_DIR/env"
cp /etc/redis/redis.conf "$BACKUP_DIR/redis.conf"
redis-cli CONFIG GET maxmemory-policy | tail -1 > "$BACKUP_DIR/redis-policy"
for file in backend/redis.ts backend/shopCatalog/catalog/cache.ts backend/shopCatalog/routes/cacheAdmin.routes.ts backend/shopAppearance/register.ts backend/shopGifts/giftRepo.ts backend/shopGifts/routes/public.routes.ts; do
  mkdir -p "$BACKUP_DIR/$(dirname "$file")"
  cp "$file" "$BACKUP_DIR/$file"
done
cat > "$BACKUP_DIR/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=$(cd "$(dirname "$0")" && pwd)
APP_DIR=/root/aloha-shop
cp "$BACKUP_DIR/env" "$APP_DIR/.env"
cp "$BACKUP_DIR/redis.conf" /etc/redis/redis.conf
redis-cli CONFIG SET maxmemory-policy "$(cat "$BACKUP_DIR/redis-policy")" >/dev/null
for file in backend/redis.ts backend/shopCatalog/catalog/cache.ts backend/shopCatalog/routes/cacheAdmin.routes.ts backend/shopAppearance/register.ts backend/shopGifts/giftRepo.ts backend/shopGifts/routes/public.routes.ts; do
  cp "$BACKUP_DIR/$file" "$APP_DIR/$file"
done
cd "$APP_DIR"
pm2 restart aloha-shop-api --update-env >/dev/null
echo ROLLBACK_OK
ROLLBACK
chmod 700 "$BACKUP_DIR/rollback.sh"
# A failure after mutation automatically restores API files, environment and old policy.
trap 'bash "$BACKUP_DIR/rollback.sh"' ERR
mkdir -p /var/lib/redis-shop-cache
chown redis:redis /var/lib/redis-shop-cache
cat > /etc/redis/redis-shop-cache.conf <<'CONFIG'
bind 127.0.0.1
protected-mode yes
port 6380
daemonize no
supervised systemd
dir /var/lib/redis-shop-cache
save ""
appendonly no
maxmemory 64mb
maxmemory-policy allkeys-lru
logfile ""
CONFIG
cat > /etc/systemd/system/redis-shop-cache.service <<'SERVICE'
[Unit]
Description=Aloha disposable public response cache
After=network.target
[Service]
Type=notify
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/redis-shop-cache.conf
Restart=on-failure
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/redis-shop-cache
[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable --now redis-shop-cache >/dev/null
test "$(redis-cli -p 6380 PING)" = PONG
redis-cli CONFIG SET maxmemory-policy noeviction >/dev/null
redis-cli CONFIG REWRITE >/dev/null
mkdir -p backend/cache
cp "$PACKAGE_DIR/transport.ts" backend/cache/transport.ts
cp "$PACKAGE_DIR/readCache.ts" backend/cache/readCache.ts
git apply "$PACKAGE_DIR/backend.patch"
python3 - <<'PY'
from pathlib import Path
import secrets
p = Path('.env')
lines = [line for line in p.read_text().splitlines() if not line.startswith(('CACHE_REDIS_URL=', 'SHOP_PUBLIC_CACHE_ENABLED='))]
lines += ['CACHE_REDIS_URL=redis://127.0.0.1:6380', 'SHOP_PUBLIC_CACHE_ENABLED=1']
if not any(line.startswith('CACHE_METRICS_TOKEN=') for line in lines):
    lines.append('CACHE_METRICS_TOKEN=' + secrets.token_hex(32))
p.write_text('\n'.join(lines) + '\n')
PY
npm run typecheck:api
pm2 restart aloha-shop-api --update-env >/dev/null
# No frontend rebuild: this release changes backend response caching only.
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/shop/gifts >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3001/api/shop/appearance >/dev/null
curl -fsS http://127.0.0.1:3001/api/shop/gifts >/dev/null
trap - ERR
echo "CACHE_RELEASE_OK backup=$BACKUP_DIR"
