#!/usr/bin/env bash
#
# Neon Database Restore Drill
#
# This script verifies that we can restore the database from:
#   1. Neon PITR (Point-in-Time Recovery) — built-in, 7-day window (Free) or 30-day (Pro)
#   2. Cloudflare R2 backup — manual pg_dump snapshots
#
# Neon PITR is the PRIMARY restore method (instant, no data loss within retention).
# R2 backups are the SECONDARY method (older snapshots, disaster recovery).
#
# ── HOW TO RESTORE (Neon PITR) ─────────────────────────────────────
#
# Via Neon Console (https://console.neon.tech):
#   1. Go to your project → Branches
#   2. Click "Create Branch"
#   3. Select "From a point in time" and pick the timestamp
#   4. This creates a NEW branch with the DB state at that time
#   5. Test the branch, then either:
#      a) Promote it to primary (replaces main branch), or
#      b) Copy specific data via pg_dump/pg_restore between branches
#
# Via Neon CLI:
#   neonctl branches create --project-id YOUR_PROJECT --name restore-test \
#     --parent main --restore-to "2026-03-28T12:00:00Z"
#
# ── HOW TO RESTORE (R2 Backup) ─────────────────────────────────────
#
# 1. Download backup from R2:
#    rclone copy r2:suporte-bipolar-backups/backup-2026-03-28T040000Z.sql.gz ./
#
# 2. Create a temporary Neon branch for testing:
#    neonctl branches create --project-id YOUR_PROJECT --name restore-from-r2
#
# 3. Restore into the test branch:
#    gunzip -c backup-*.sql.gz | psql "YOUR_BRANCH_CONNECTION_STRING"
#
# 4. Verify data, then promote or discard.
#
# ── THIS SCRIPT (Verification Only) ────────────────────────────────
#
# Runs a quick health check against the live DB to verify:
#   - Connection works
#   - All expected tables exist
#   - Row counts are non-zero for critical tables
#   - Database size is reasonable
#
# Usage:
#   npx dotenv-cli -e .env.local -- bash scripts/restore-drill.sh
#
# Or just run the node verification:
#   npx dotenv-cli -e .env.local -- node scripts/restore-drill.mjs

set -euo pipefail

echo "=== Neon Restore Drill — Verification ==="
echo ""

# Run the Node.js verification script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npx dotenv-cli -e .env.local -- node "${SCRIPT_DIR}/restore-drill.mjs"
