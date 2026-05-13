#!/usr/bin/env bash
# Promote staging → prod. Runs ON pinas, invoked from $STAGING_DIR.
# Refuses if staging /health isn't 200, or if main can't fast-forward from
# origin/staging. Prompts for confirmation if any commit between the last
# prod tag and origin/staging contains "MIGRATION:" in its subject.

set -euo pipefail

STAGING_DIR="/home/pi/poke4trade-staging"
STAGING_PORT="8082"
PROD_DIR="/home/pi/poke4trade"
PROD_PORT="8081"
PROD_UNIT="poke4trade.service"
DEPLOY_LOG="$HOME/poke4trade-deploy.log"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

log "Pre-check: staging /health"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$STAGING_PORT/health" || true)
if [[ "$HEALTH_CODE" != "200" ]]; then
    log "ABORT: staging /health returned $HEALTH_CODE — fix staging before promoting."
    exit 1
fi

cd "$STAGING_DIR"
git fetch origin --tags

# Migration sanity check: warn if any commit between last prod tag and
# origin/staging contains "MIGRATION:" in its subject line.
LAST_PROD_TAG=$(git tag -l 'prod-*' --sort=-creatordate | head -1 || true)
if [[ -n "${LAST_PROD_TAG:-}" ]]; then
    MIGRATION_COMMITS=$(git log --pretty=format:"%h %s" "$LAST_PROD_TAG..origin/staging" | grep -i "MIGRATION:" || true)
    if [[ -n "$MIGRATION_COMMITS" ]]; then
        echo
        echo "==== WARNING: schema/data migrations detected ===="
        echo "Commits since $LAST_PROD_TAG containing 'MIGRATION:':"
        echo "$MIGRATION_COMMITS"
        echo "==================================================="
        echo
        read -r -p "Type 'migrations applied' to continue: " CONFIRM
        if [[ "$CONFIRM" != "migrations applied" ]]; then
            log "ABORT: migrations not confirmed."
            exit 1
        fi
    fi
fi

# Fast-forward main → origin/staging in a temp worktree, then push.
TMP_WT=$(mktemp -d)
log "Creating temp worktree at $TMP_WT to fast-forward main"
cleanup() { git worktree remove --force "$TMP_WT" 2>/dev/null || rm -rf "$TMP_WT"; }
trap cleanup EXIT

git worktree add --force "$TMP_WT" main
(
    cd "$TMP_WT"
    git fetch origin
    git reset --hard origin/main
    if ! git merge --ff-only origin/staging; then
        log "ABORT: main cannot fast-forward to origin/staging. Reconcile manually."
        exit 1
    fi
)
PROMOTED_SHA=$(git -C "$TMP_WT" rev-parse HEAD)

TAG_NAME="prod-$(date +%Y%m%d-%H%M)"
log "Tagging $TAG_NAME at $PROMOTED_SHA and pushing"
git -C "$TMP_WT" tag "$TAG_NAME"
git -C "$TMP_WT" push origin main
git -C "$TMP_WT" push origin "$TAG_NAME"

log "Deploying to prod dir"
cd "$PROD_DIR"
git fetch origin --tags
git checkout main
git reset --hard origin/main

log "Installing dependencies (npm ci)"
npm ci --no-audit --no-fund

log "Building frontend"
npm run build

log "Writing runtime env file"
cat > "$PROD_DIR/.env.runtime" <<EOF
COMMIT_SHA=$PROMOTED_SHA
EOF

log "Restarting $PROD_UNIT"
sudo systemctl restart "$PROD_UNIT"

log "Waiting 3s for service"
sleep 3

log "Health check"
HEALTH_CODE=$(curl -s -o /tmp/health.prod.out -w "%{http_code}" "http://localhost:$PROD_PORT/health" || true)
if [[ "$HEALTH_CODE" != "200" ]]; then
    log "FAIL: prod /health returned $HEALTH_CODE"
    cat /tmp/health.prod.out 2>/dev/null || true
    echo "[$(ts)] prod $PROMOTED_SHA FAIL health=$HEALTH_CODE tag=$TAG_NAME" >> "$DEPLOY_LOG"
    echo
    if [[ -n "${LAST_PROD_TAG:-}" ]]; then
        echo "TO ROLLBACK: ./scripts/rollback-prod.sh $LAST_PROD_TAG"
    else
        echo "TO ROLLBACK: ./scripts/rollback-prod.sh   (no prior tag detected — list and pick interactively)"
    fi
    exit 1
fi

cat /tmp/health.prod.out
echo
log "Prod promote successful — tagged $TAG_NAME"
echo "[$(ts)] prod $PROMOTED_SHA OK tag=$TAG_NAME" >> "$DEPLOY_LOG"
