#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DIR="${1:-$ROOT_DIR/backups/$TIMESTAMP}"
DATABASE_URL="${DATABASE_URL:-postgresql://crmp:crmp@127.0.0.1:5432/crmp}"

mkdir -p "$BACKUP_DIR"

echo "Exporting PostgreSQL backup to $BACKUP_DIR/crmp.postgres.dump"
pg_dump "$DATABASE_URL" --format=custom --file="$BACKUP_DIR/crmp.postgres.dump"

echo "Packing backend config files into $BACKUP_DIR/crmp.configs.tar.gz"
CONFIG_FILES=(.env.example docker-compose.yml alembic.ini)
if [[ -f "$ROOT_DIR/.env" ]]; then
  CONFIG_FILES+=(.env)
fi
tar -czf "$BACKUP_DIR/crmp.configs.tar.gz" -C "$ROOT_DIR" "${CONFIG_FILES[@]}"

cat <<EOF
Private backup completed.
- Postgres dump: $BACKUP_DIR/crmp.postgres.dump
- Config archive: $BACKUP_DIR/crmp.configs.tar.gz

Durable CRM records, AI proposals, AI executions, and local eval runs live in Postgres.
EOF
