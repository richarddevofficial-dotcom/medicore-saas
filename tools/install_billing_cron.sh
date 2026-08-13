#!/usr/bin/env bash
#
# Install MediCore SaaS billing cron jobs on the VPS.
#
# Usage (on the VPS, from the repo root):
#   bash tools/install_billing_cron.sh
#
# This schedules the Django management commands that drive the
# subscription lifecycle (trial expiry, renewal invoicing, overdue
# handling, grace -> suspension and scheduled plan changes).
#
# All jobs run inside the existing `backend` Docker container.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/medicore-saas}"
COMPOSE="docker compose"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

# Use `docker compose` (v2) if available, otherwise fall back to
# `docker-compose` (v1).
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

run_backend() {
  # Run a management command inside the backend container.
  # -T disables TTY allocation so cron does not complain.
  cd "$PROJECT_DIR"
  $COMPOSE exec -T backend python manage.py "$@"
}

CRON_MARKER="# medicore-saas-billing"
CRON_FILE="$(mktemp)"

# Legacy commands that no longer exist as standalone management commands
# (their behaviour is now handled by process_daily_billing). Any cron
# entries referencing them are stale and are removed below.
LEGACY_COMMANDS_PATTERN='send_trial_reminders|send_billing_reminders|process_subscription_status'

# Commands this script manages. Any existing entry (marked or not) that
# references one of these is removed first so re-running the installer
# never creates duplicates.
MANAGED_COMMANDS_PATTERN='process_daily_billing|update_subscription_statuses|apply_scheduled_plan_changes|run_monthly_billing'

# Preserve existing cron entries, but drop:
#   - previous MediCore billing jobs installed by this script,
#   - any other entry already running one of the managed commands, and
#   - stale entries pointing at removed management commands.
crontab -l 2>/dev/null \
  | grep -v "$CRON_MARKER" \
  | grep -vE "$LEGACY_COMMANDS_PATTERN" \
  | grep -vE "$MANAGED_COMMANDS_PATTERN" \
  > "$CRON_FILE" || true

cat >> "$CRON_FILE" <<EOF
# ---- MediCore SaaS billing jobs ---- $CRON_MARKER
# Daily billing processor: trial expiry, renewal invoices, overdue,
# grace period transitions, suspension and reminder emails.
15 1 * * * cd $PROJECT_DIR && $COMPOSE exec -T backend python manage.py process_daily_billing >> $LOG_DIR/billing-daily.log 2>&1 $CRON_MARKER

# Refresh subscription statuses (active -> expiring_soon -> grace -> suspended).
30 1 * * * cd $PROJECT_DIR && $COMPOSE exec -T backend python manage.py update_subscription_statuses >> $LOG_DIR/billing-statuses.log 2>&1 $CRON_MARKER

# Apply scheduled plan downgrades whose effective date has arrived.
45 1 * * * cd $PROJECT_DIR && $COMPOSE exec -T backend python manage.py apply_scheduled_plan_changes >> $LOG_DIR/billing-plan-changes.log 2>&1 $CRON_MARKER

# Monthly recurring invoice generation on the 1st of each month.
0 2 1 * * cd $PROJECT_DIR && $COMPOSE exec -T backend python manage.py run_monthly_billing >> $LOG_DIR/billing-monthly.log 2>&1 $CRON_MARKER
EOF

crontab "$CRON_FILE"
rm -f "$CRON_FILE"

echo "MediCore billing cron jobs installed."
echo ""
echo "Current crontab:"
crontab -l | grep "$CRON_MARKER" | sed 's/ # medicore-saas-billing//'
echo ""
echo "Logs will be written to: $LOG_DIR"
