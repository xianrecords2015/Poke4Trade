#!/usr/bin/env bash
# Drop the staging schema and re-seed it from a fresh mysqldump of prod.
# Runs ON pinas. Destructive against poke4trade_staging.

set -euo pipefail

PROD_SCHEMA="poke4trade"
STAGING_SCHEMA="poke4trade_staging"
DUMP_FILE="/tmp/prod-seed-$(date +%s).sql"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

log "Dumping $PROD_SCHEMA"
sudo mysqldump --single-transaction --quick "$PROD_SCHEMA" > "$DUMP_FILE"

log "Dropping and recreating $STAGING_SCHEMA"
sudo mysql -e "DROP DATABASE IF EXISTS \`$STAGING_SCHEMA\`"
sudo mysql -e "CREATE DATABASE \`$STAGING_SCHEMA\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

log "Loading dump into $STAGING_SCHEMA"
sudo mysql "$STAGING_SCHEMA" < "$DUMP_FILE"

rm -f "$DUMP_FILE"
log "Staging schema refreshed."
