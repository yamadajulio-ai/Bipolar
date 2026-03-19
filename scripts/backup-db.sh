#!/usr/bin/env bash
#
# Database backup script — pg_dump to Cloudflare R2
#
# Prerequisites:
#   1. Install rclone: https://rclone.org/install/
#   2. Configure R2 remote:
#      rclone config create r2 s3 \
#        provider=Cloudflare \
#        access_key_id=YOUR_R2_ACCESS_KEY \
#        secret_access_key=YOUR_R2_SECRET_KEY \
#        endpoint=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com \
#        acl=private
#   3. Create R2 bucket: "suporte-bipolar-backups"
#   4. Set DATABASE_URL env var (Neon connection string)
#
# Usage:
#   ./scripts/backup-db.sh
#
# Recommended: run daily via cron or Task Scheduler
#   0 4 * * * /path/to/scripts/backup-db.sh >> /var/log/backup-db.log 2>&1
#

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
BUCKET="r2:suporte-bipolar-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
BACKUP_FILE="backup-${TIMESTAMP}.sql.gz"
TEMP_DIR=$(mktemp -d)

trap 'rm -rf "${TEMP_DIR}"' EXIT

# ── Validate ───────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL not set" >&2
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  echo "[ERROR] pg_dump not found — install PostgreSQL client tools" >&2
  exit 1
fi

if ! command -v rclone &>/dev/null; then
  echo "[ERROR] rclone not found — install from https://rclone.org/install/" >&2
  exit 1
fi

# ── Dump ───────────────────────────────────────────────────────────
echo "[$(date -u +%H:%M:%S)] Starting pg_dump..."
pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  | gzip > "${TEMP_DIR}/${BACKUP_FILE}"

SIZE=$(du -h "${TEMP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "[$(date -u +%H:%M:%S)] Dump complete: ${BACKUP_FILE} (${SIZE})"

# ── Upload to R2 ──────────────────────────────────────────────────
echo "[$(date -u +%H:%M:%S)] Uploading to R2..."
rclone copyto "${TEMP_DIR}/${BACKUP_FILE}" "${BUCKET}/${BACKUP_FILE}" --progress

echo "[$(date -u +%H:%M:%S)] Upload complete"

# ── Prune old backups ─────────────────────────────────────────────
echo "[$(date -u +%H:%M:%S)] Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "${BUCKET}" --min-age "${RETENTION_DAYS}d" --verbose

echo "[$(date -u +%H:%M:%S)] Backup pipeline complete"
