#!/usr/bin/env bash
set -euo pipefail

# Prepara o banco da VPS para autenticação sem ativar a feature flag, reiniciar
# processos ou alterar o .env. Executar somente depois do git pull.

REPO_DIR="${REPO_DIR:-/home/socialbot/apps/auto-reels-n8n}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-socialbot_postgres}"
POSTGRES_USER="${POSTGRES_USER:-n8n}"
POSTGRES_DB="${POSTGRES_DB:-n8n}"
BACKUP_DIR="${BACKUP_DIR:-/home/socialbot/backups/socialbot}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/before_auth_${TIMESTAMP}.dump"

log() {
  echo "[prepare-auth-vps] $*"
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Arquivo obrigatório não encontrado: $1" >&2
    exit 1
  fi
}

main() {
  command -v docker >/dev/null 2>&1 || {
    echo "Docker não encontrado." >&2
    exit 1
  }

  require_file "$REPO_DIR/backend/sql/007-auth-users-foundation.sql"
  require_file "$REPO_DIR/backend/sql/007-auth-users-foundation-verify.sql"
  require_file "$REPO_DIR/backend/sql/008-meta-oauth-state.sql"
  require_file "$REPO_DIR/backend/sql/008-meta-oauth-state-verify.sql"

  if grep -Eq '^ADMIN_AUTH_ENABLED=true$' "$REPO_DIR/backend/.env"; then
    echo "ADMIN_AUTH_ENABLED já está true. Desative antes da preparação." >&2
    exit 1
  fi

  docker inspect "$POSTGRES_CONTAINER" >/dev/null
  mkdir -p "$BACKUP_DIR"

  log "Criando backup em $BACKUP_FILE"
  docker exec "$POSTGRES_CONTAINER" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Fc >"$BACKUP_FILE"

  if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "Backup vazio; migrations não serão aplicadas." >&2
    exit 1
  fi

  log "Validando arquivo de backup"
  docker exec -i "$POSTGRES_CONTAINER" pg_restore -l \
    <"$BACKUP_FILE" >/dev/null

  log "Aplicando migration 007"
  docker exec -i "$POSTGRES_CONTAINER" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    <"$REPO_DIR/backend/sql/007-auth-users-foundation.sql"

  log "Verificando migration 007"
  docker exec -i "$POSTGRES_CONTAINER" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    <"$REPO_DIR/backend/sql/007-auth-users-foundation-verify.sql"

  log "Aplicando migration 008"
  docker exec -i "$POSTGRES_CONTAINER" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    <"$REPO_DIR/backend/sql/008-meta-oauth-state.sql"

  log "Verificando migration 008"
  docker exec -i "$POSTGRES_CONTAINER" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    <"$REPO_DIR/backend/sql/008-meta-oauth-state-verify.sql"

  log "Preparação concluída. Autenticação continua desativada."
  log "Backup: $BACKUP_FILE"
}

main "$@"
