#!/usr/bin/env bash
# Retention policy: Prune old releases while protecting active and rollback versions.
set -euo pipefail

RELEASE_ROOT="${1:-/root/aloha-shop-releases}"
KEEP="${2:-5}"
DRY_RUN="${DRY_RUN:-0}"

if [ ! -d "$RELEASE_ROOT" ]; then
  echo "Release root directory $RELEASE_ROOT does not exist; skipping pruning."
  exit 0
fi

# 1. Resolve current active symlink
CURRENT_ACTIVE=""
if [ -L "$RELEASE_ROOT/current" ]; then
  CURRENT_ACTIVE="$(readlink -f "$RELEASE_ROOT/current" 2>/dev/null || true)"
fi

# 2. Extract directories actively used by running PM2 processes
PM2_USED=""
if command -v pm2 >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  PM2_USED="$(pm2 jlist 2>/dev/null | jq -r '.[].pm2_env.pm_cwd // empty' | grep "^$RELEASE_ROOT" | sed 's/\/frontend$//' | sed 's/\/backend$//' | sort -u || true)"
fi

# 3. Find all release directories sorted newest to oldest
ALL_RELEASES="$(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -name "20*" | sort -r || true)"
TOTAL_COUNT="$(echo "$ALL_RELEASES" | grep -c . || true)"

if [ "$TOTAL_COUNT" -le "$KEEP" ]; then
  echo "Release count ($TOTAL_COUNT) is within retention limit ($KEEP); nothing to prune."
  exit 0
fi

# 4. Partition releases into KEEP and CANDIDATES
PRUNE_CANDIDATES="$(echo "$ALL_RELEASES" | tail -n +$((KEEP + 1)))"

PRUNED_COUNT=0
for dir in $PRUNE_CANDIDATES; do
  [ -z "$dir" ] && continue
  
  # Safety Check: never delete CURRENT_ACTIVE
  if [ -n "$CURRENT_ACTIVE" ] && [ "$dir" = "$CURRENT_ACTIVE" ]; then
    echo "Skipping protected release (symlink current): $dir"
    continue
  fi

  # Safety Check: never delete directory used by any PM2 process
  if [ -n "$PM2_USED" ] && echo "$PM2_USED" | grep -Fxq "$dir"; then
    echo "Skipping protected release (active in PM2): $dir"
    continue
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] Would prune: $dir"
  else
    echo "Pruning old release: $dir"
    rm -rf "$dir"
  fi
  PRUNED_COUNT=$((PRUNED_COUNT + 1))
done

echo "Pruned $PRUNED_COUNT old releases. Kept $((TOTAL_COUNT - PRUNED_COUNT)) releases."
