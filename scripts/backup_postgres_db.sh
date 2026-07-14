#!/usr/bin/env bash
set -euo pipefail

# Backup PostgreSQL do SocialBot via Docker.
#
# Uso padrão na VPS:
#   bash scripts/backup_postgres_db.sh
#
# Variáveis opcionais:
#   SOCIALBOT_PG_CONTAINER  Nome do container PostgreSQL. Default: socialbot_postgres
#   SOCIALBOT_PG_DATABASE   Nome do banco. Default: n8n
#   SOCIALBOT_PG_USER       Usuário do banco. Default: n8n
#   SOCIALBOT_BACKUP_DIR    Diretório base de backup. Default: $HOME/backups/socialbot-postgres
#   SOCIALBOT_BACKUP_FORMAT Formato do pg_dump: custom ou plain. Default: custom
#
# O script não lê .env e não imprime segredos.

CONTAINER_NAME="${SOCIALBOT_PG_CONTAINER:-socialbot_postgres}"
DATABASE_NAME="${SOCIALBOT_PG_DATABASE:-n8n}"
DATABASE_USER="${SOCIALBOT_PG_USER:-n8n}"
BACKUP_BASE_DIR="${SOCIALBOT_BACKUP_DIR:-$HOME/backups/socialbot-postgres}"
BACKUP_FORMAT="${SOCIALBOT_BACKUP_FORMAT:-custom}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

log() {
  echo "[backup-postgres] $*"
}

fail() {
  echo "[backup-postgres] ERRO: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Comando obrigatório não encontrado: $cmd"
  fi
}

main() {
  require_cmd docker

  if [[ "$BACKUP_FORMAT" != "custom" && "$BACKUP_FORMAT" != "plain" ]]; then
    fail "SOCIALBOT_BACKUP_FORMAT deve ser 'custom' ou 'plain'. Valor recebido: $BACKUP_FORMAT"
  fi

  if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    fail "Container PostgreSQL não encontrado: $CONTAINER_NAME"
  fi

  mkdir -p "$BACKUP_BASE_DIR"

  local extension="dump"
  local pg_dump_format="c"
  if [[ "$BACKUP_FORMAT" == "plain" ]]; then
    extension="sql"
    pg_dump_format="p"
  fi

  local backup_file="$BACKUP_BASE_DIR/${DATABASE_NAME}_${TIMESTAMP}.${extension}"
  local metadata_file="$BACKUP_BASE_DIR/${DATABASE_NAME}_${TIMESTAMP}.metadata.txt"

  log "Container: $CONTAINER_NAME"
  log "Banco: $DATABASE_NAME"
  log "Usuário: $DATABASE_USER"
  log "Formato: $BACKUP_FORMAT"
  log "Destino: $backup_file"

  docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DATABASE_USER" \
    -d "$DATABASE_NAME" \
    -F "$pg_dump_format" \
    --no-owner \
    --no-privileges \
    > "$backup_file"

  {
    echo "created_at=$(date --iso-8601=seconds)"
    echo "container=$CONTAINER_NAME"
    echo "database=$DATABASE_NAME"
    echo "user=$DATABASE_USER"
    echo "format=$BACKUP_FORMAT"
    echo "file=$backup_file"
    echo "size_bytes=$(wc -c < "$backup_file" | tr -d ' ')"
    if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "git_head=$(git rev-parse HEAD)"
      echo "git_branch=$(git rev-parse --abbrev-ref HEAD)"
    fi
    if command -v sha256sum >/dev/null 2>&1; then
      echo "sha256=$(sha256sum "$backup_file" | awk '{print $1}')"
    fi
  } > "$metadata_file"

  log "Metadados: $metadata_file"
  log "Backup concluído com sucesso."
}

main "$@"
