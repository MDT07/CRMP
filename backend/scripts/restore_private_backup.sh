#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$1"
DATABASE_URL="${DATABASE_URL:-postgresql://crmp:crmp@127.0.0.1:5432/crmp}"

if [[ ! -f "$BACKUP_DIR/crmp.postgres.dump" ]]; then
  echo "Missing Postgres dump in $BACKUP_DIR" >&2
  exit 1
fi

echo "Restoring PostgreSQL backup from $BACKUP_DIR/crmp.postgres.dump"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="$DATABASE_URL" \
  "$BACKUP_DIR/crmp.postgres.dump"

if [[ -f "$BACKUP_DIR/crmp.configs.tar.gz" ]]; then
  echo "Restoring backend config archive into $ROOT_DIR"
  tar -xzf "$BACKUP_DIR/crmp.configs.tar.gz" -C "$ROOT_DIR"
fi

cat <<EOF
Private restore completed.

If Redis is running, restart it after restore so cached state can rebuild from Postgres.
EOF
