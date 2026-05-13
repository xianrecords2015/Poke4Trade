#!/usr/bin/env bash
# Run on the LOCAL machine. SSH wrapper around the deploy scripts on pinas.
# Edit the variables below if pinas's address, user, or paths change.

set -euo pipefail

# --- Configuration (edit if pinas moves) ---
PINAS_HOST="pi@10.0.0.208"
STAGING_DIR="/home/pi/poke4trade-staging"
PROD_DIR="/home/pi/poke4trade"
STAGING_UNIT="poke4trade-staging.service"
PROD_UNIT="poke4trade.service"
# -------------------------------------------

CMD="${1:-}"
shift || true

case "$CMD" in
    deploy-staging)
        ssh -t "$PINAS_HOST" "cd '$STAGING_DIR' && ./scripts/deploy-staging.sh"
        ;;
    promote)
        ssh -t "$PINAS_HOST" "cd '$STAGING_DIR' && ./scripts/promote-to-prod.sh"
        ;;
    rollback)
        ARG="${1:-}"
        ssh -t "$PINAS_HOST" "cd '$PROD_DIR' && ./scripts/rollback-prod.sh ${ARG}"
        ;;
    logs)
        TARGET="${1:-staging}"
        case "$TARGET" in
            staging) UNIT="$STAGING_UNIT" ;;
            prod)    UNIT="$PROD_UNIT" ;;
            *) echo "Usage: $0 logs [staging|prod]"; exit 1 ;;
        esac
        ssh -t "$PINAS_HOST" "sudo journalctl -u '$UNIT' -f -n 50"
        ;;
    status)
        ssh "$PINAS_HOST" "systemctl status '$PROD_UNIT' '$STAGING_UNIT' --no-pager 2>&1 | sed -n '1,40p'; echo; echo '=== deploy log (tail 20) ==='; tail -n 20 ~/poke4trade-deploy.log 2>/dev/null || echo '(no deploy log yet)'"
        ;;
    refresh-staging-db)
        ssh -t "$PINAS_HOST" "cd '$STAGING_DIR' && ./scripts/refresh-staging-db.sh"
        ;;
    *)
        cat <<USAGE
Usage: $0 <command>

Commands:
  deploy-staging         Pull staging on pinas, npm ci, build, restart staging unit, health-check.
  promote                Promote staging → prod (fast-forward main, tag, deploy, health-check).
  rollback [tag]         Roll prod back to a tag. With no arg, lists recent prod-* tags and prompts.
  logs [staging|prod]    Tail journald for the chosen unit (default: staging).
  status                 systemctl status for both units + last 20 deploy-log lines.
  refresh-staging-db     Re-seed staging DB from a fresh prod mysqldump (destroys staging schema).
USAGE
        exit 1
        ;;
esac
