#!/usr/bin/env bash
set -euo pipefail
trap 'systemctl start redis-shop-cache' EXIT
systemctl stop redis-shop-cache
for path in appearance gifts category-tree; do
  HEADERS=$(curl -fsS -D - -o /dev/null "http://127.0.0.1:3001/api/shop/$path")
  printf '%s\n' "$HEADERS" | grep -qi 'X-Shop-Cache: BYPASS'
  echo "$path: HTTP 200 BYPASS with cache Redis stopped"
done
test "$(redis-cli PING)" = PONG
systemctl start redis-shop-cache
sleep 6
curl -fsS http://127.0.0.1:3001/api/shop/gifts >/dev/null
curl -fsS -D - -o /dev/null http://127.0.0.1:3001/api/shop/gifts | grep -i X-Shop-Cache
test "$(redis-cli -p 6380 PING)" = PONG
echo OUTAGE_RECOVERY_OK
