#!/usr/bin/env bash
# Deploy the `staging` branch to the staging dir on pinas.
# Runs ON pinas, expected to be invoked from $STAGING_DIR (e.g. via from-dev.sh).
# Idempotent: running twice on the same commit is a no-op success.

set -euo pipefail

STAGING_DIR="/home/pi/poke4trade-staging"
STAGING_PORT="8082"
STAGING_UNIT="poke4trade-staging.service"
DEPLOY_LOG="$HOME/poke4trade-deploy.log"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

cd "$STAGING_DIR"

log "Fetching latest staging branch"
git fetch origin
git checkout staging
git reset --hard origin/staging

COMMIT_SHA=$(git rev-parse HEAD)
log "Target commit: $COMMIT_SHA"

log "Installing dependencies (npm ci)"
npm ci --no-audit --no-fund

log "Building frontend"
npm run build

log "Writing runtime env file"
cat > "$STAGING_DIR/.env.runtime" <<EOF
COMMIT_SHA=$COMMIT_SHA
EOF

log "Restarting $STAGING_UNIT"
sudo systemctl restart "$STAGING_UNIT"

log "Waiting 3s for service"
sleep 3

log "Health check"
HEALTH_CODE=$(curl -s -o /tmp/health.staging.out -w "%{http_code}" "http://localhost:$STAGING_PORT/health" || true)
if [[ "$HEALTH_CODE" != "200" ]]; then
    log "FAIL: /health returned $HEALTH_CODE"
    cat /tmp/health.staging.out 2>/dev/null || true
    echo "[$(ts)] staging $COMMIT_SHA FAIL health=$HEALTH_CODE" >> "$DEPLOY_LOG"
    exit 1
fi

cat /tmp/health.staging.out
echo
log "Staging deploy successful"
echo "[$(ts)] staging $COMMIT_SHA OK" >> "$DEPLOY_LOG"
