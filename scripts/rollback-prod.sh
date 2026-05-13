#!/usr/bin/env bash
# Roll prod back to a previous prod-YYYYMMDD-HHMM tag.
# Runs ON pinas. With no arg, lists recent prod-* tags and prompts.

set -euo pipefail

PROD_DIR="/home/pi/poke4trade"
PROD_PORT="8081"
PROD_UNIT="poke4trade.service"
DEPLOY_LOG="$HOME/poke4trade-deploy.log"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

cd "$PROD_DIR"
git fetch origin --tags

TARGET_TAG="${1:-}"

if [[ -z "$TARGET_TAG" ]]; then
    echo "Recent prod tags (newest first):"
    git tag -l 'prod-*' --sort=-creatordate | head -5
    echo
    read -r -p "Enter tag to roll back to: " TARGET_TAG
fi

if ! git rev-parse "$TARGET_TAG" >/dev/null 2>&1; then
    log "ABORT: tag '$TARGET_TAG' not found"
    exit 1
fi

log "Rolling back to $TARGET_TAG"
git checkout --detach "$TARGET_TAG"
ROLLBACK_SHA=$(git rev-parse HEAD)

log "Installing dependencies (npm ci)"
npm ci --no-audit --no-fund

log "Building frontend"
npm run build

log "Writing runtime env file"
cat > "$PROD_DIR/.env.runtime" <<EOF
COMMIT_SHA=$ROLLBACK_SHA
EOF

log "Restarting $PROD_UNIT"
sudo systemctl restart "$PROD_UNIT"

log "Waiting 3s for service"
sleep 3

log "Health check"
HEALTH_CODE=$(curl -s -o /tmp/health.prod.out -w "%{http_code}" "http://localhost:$PROD_PORT/health" || true)
if [[ "$HEALTH_CODE" != "200" ]]; then
    log "FAIL: /health returned $HEALTH_CODE after rollback"
    cat /tmp/health.prod.out 2>/dev/null || true
    echo "[$(ts)] rollback $ROLLBACK_SHA FAIL health=$HEALTH_CODE tag=$TARGET_TAG" >> "$DEPLOY_LOG"
    exit 1
fi

cat /tmp/health.prod.out
echo
log "Rollback to $TARGET_TAG successful"
echo "[$(ts)] rollback $ROLLBACK_SHA OK tag=$TARGET_TAG" >> "$DEPLOY_LOG"
