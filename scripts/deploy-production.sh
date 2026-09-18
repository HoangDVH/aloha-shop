#!/usr/bin/env bash
# Deploy Aloha shop production trên VPS.
# Chạy từ /root/aloha-shop (hoặc set APP_DIR).
set -euo pipefail

APP_DIR="${APP_DIR:-/root/aloha-shop}"
cd "$APP_DIR"

echo "==> BEFORE $(git rev-parse --short HEAD) $(git log -1 --oneline)"

git fetch origin
git reset --hard origin/main

echo "==> AFTER  $(git rev-parse --short HEAD) $(git log -1 --oneline)"

# Non-interactive shell (CI) có thể thiếu PATH
export PATH="/usr/local/bin:/usr/bin:$PATH"
if command -v npm >/dev/null 2>&1; then
  :
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

# Root deps (API) trước khi restart API
npm install --no-audit --no-fund

pm2 restart aloha-shop-api --update-env

cd frontend
# CTV/admin cần antd & deps mới — luôn sync trước build
npm install --no-audit --no-fund
npm run build
cd ..

pm2 restart aloha-shop --update-env
sleep 2
pm2 ls

echo "DEPLOY_OK $(date -Is)"
