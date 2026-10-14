#!/usr/bin/env bash
# Immutable releases; two frontend slots, one API worker set, automatic rollback.
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
APP_DIR="${APP_DIR:-/root/aloha-shop}"
RELEASE_ROOT="${RELEASE_ROOT:-/root/aloha-shop-releases}"
export NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-enabled/aloha-shop}"
TOOLS_DIR=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$RELEASE_ROOT"
exec 9>"$RELEASE_ROOT/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
cd "$APP_DIR"
git fetch origin
REF=$(git rev-parse "${DEPLOY_REF:-origin/main}")
ID="$(date -u +%Y%m%dT%H%M%S)-${REF:0:12}"
RELEASE="$RELEASE_ROOT/$ID"
mkdir -p "$RELEASE"
chmod 700 "$RELEASE"
# This repo tracks node_modules; exclude platform-specific binaries.
git archive "$REF" | tar -x -C "$RELEASE" --exclude='node_modules' --exclude='*/node_modules' --exclude='*/.next' --exclude='uploads' --exclude='private'
if [ -n "${DEPLOY_PATCH:-}" ]; then
  git -C "$RELEASE" apply --check "$DEPLOY_PATCH"
  git -C "$RELEASE" apply "$DEPLOY_PATCH"
fi
ln -s "$APP_DIR/.env" "$RELEASE/.env"
if [ -f "$APP_DIR/frontend/.env.local" ]; then ln -s "$APP_DIR/frontend/.env.local" "$RELEASE/frontend/.env.local"; fi
mkdir -p "$APP_DIR/uploads"
ln -s "$APP_DIR/uploads" "$RELEASE/uploads"
mkdir -p "$APP_DIR/private"
ln -s "$APP_DIR/private" "$RELEASE/private"
export NEXT_PUBLIC_RELEASE_ID="$ID"
cd "$RELEASE"
npm ci --no-audit --no-fund
npm ci --prefix frontend --no-audit --no-fund
PUPPETEER_SKIP_DOWNLOAD=1 npm ci --prefix getPrivateTokenKV --no-audit --no-fund
for file in .env .token_cache.json; do
  if [ -f "$APP_DIR/getPrivateTokenKV/$file" ]; then ln -s "$APP_DIR/getPrivateTokenKV/$file" "$RELEASE/getPrivateTokenKV/$file"; fi
done
npm run typecheck:api
npm run typecheck:web
npm run build --prefix frontend
# Retain hashed files for old tabs; monitor disk before introducing pruning.
ASSETS="${STATIC_ROOT:-/var/www/aloha-shop-static}"
mkdir -p "$ASSETS"
chmod 755 "$ASSETS"
if [ -d "$APP_DIR/frontend/.next/static" ]; then cp -an "$APP_DIR/frontend/.next/static/." "$ASSETS/"; fi
cp -an "$RELEASE/frontend/.next/static/." "$ASSETS/"
find "$ASSETS" -type d -exec chmod 755 {} +
find "$ASSETS" -type f -exec chmod 644 {} +
cp -an "$ASSETS/." "$RELEASE/frontend/.next/static/"
pm2 jlist > "$RELEASE/processes.json"
chmod 600 "$RELEASE/processes.json"
node "$TOOLS_DIR/release-processes.cjs" "$RELEASE"
source "$RELEASE/slot.env"
cp "$NGINX_SITE" "$RELEASE/nginx.before"
python3 "$TOOLS_DIR/release-nginx.py" "$RELEASE/nginx.before" "$RELEASE/nginx.after" "$PORT" "$ASSETS"
SWITCHED=0
API_SWITCHED=0
rollback() {
  echo 'Deployment failed; restoring previous release' >&2
  cp "$RELEASE/nginx.before" "$NGINX_SITE"
  if [ "$SWITCHED" = 1 ]; then nginx -t && systemctl reload nginx; fi
  if [ "$API_SWITCHED" = 1 ]; then
    pm2 delete aloha-shop-api >/dev/null 2>&1 || true
    pm2 start "$RELEASE/api.before.json" --update-env
  fi
  pm2 delete "$SLOT" >/dev/null 2>&1 || true
  pm2 save >/dev/null || true
}
trap rollback ERR
trap 'rollback; exit 130' INT TERM
pm2 delete "$SLOT" >/dev/null 2>&1 || true
pm2 start "$RELEASE/web.json" --update-env
ready=0
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/" >/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
cp "$RELEASE/nginx.after" "$NGINX_SITE"
if ! nginx -t; then cp "$RELEASE/nginx.before" "$NGINX_SITE"; false; fi
cp "$RELEASE/nginx.before" "$NGINX_SITE"
API_SWITCHED=1
pm2 delete aloha-shop-api >/dev/null
pm2 start "$RELEASE/api.json" --update-env
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/api/health >/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
SWITCHED=1
cp "$RELEASE/nginx.after" "$NGINX_SITE"
nginx -t
systemctl reload nginx
curl -fsS --max-time 20 https://alohathegioichaucay.com/ >/dev/null
curl -fsS --max-time 20 https://alohathegioichaucay.com/api/shop/appearance >/dev/null
pm2 save >/dev/null
ln -s "$RELEASE" "$RELEASE_ROOT/current.new"
mv -Tf "$RELEASE_ROOT/current.new" "$RELEASE_ROOT/current"
trap - ERR INT TERM
echo "DEPLOY_OK release=$ID slot=$SLOT port=$PORT"
