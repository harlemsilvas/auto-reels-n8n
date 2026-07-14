#!/usr/bin/env bash
set -euo pipefail

# Deploy frontend para Hostinger com variaveis fixas.
# Uso:
#   bash scripts/deploy_frontend_hostinger.sh

FRONTEND_DIR="/home/socialbot/apps/auto-reels-n8n/dashboard"
WEB_ROOT="/var/www/dashboard.hrmmotos.com.br"
NGINX_SITE="/etc/nginx/sites-enabled/000-dashboard.hrmmotos.com.br"
PUBLIC_URL="https://dashboard.hrmmotos.com.br"

log() {
  echo "[deploy-hostinger] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

main() {
  require_cmd npm
  require_cmd rsync
  require_cmd nginx
  require_cmd curl

  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo "Diretorio do frontend nao encontrado: $FRONTEND_DIR"
    exit 1
  fi

  log "Frontend dir: $FRONTEND_DIR"
  log "Web root: $WEB_ROOT"
  log "Nginx site esperado: $NGINX_SITE"
  log "A validacao real do Nginx sera feita via: sudo nginx -t"

  cd "$FRONTEND_DIR"

  log "Instalando dependencias"
  npm ci

  log "Gerando build"
  npm run build

  if [[ ! -d "$FRONTEND_DIR/dist" ]]; then
    echo "Build nao gerou pasta dist."
    exit 1
  fi

  log "Publicando build"
  sudo mkdir -p "$WEB_ROOT"
  sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$WEB_ROOT/"

  log "Ajustando permissoes"
  sudo chown -R www-data:www-data "$WEB_ROOT"

  log "Validando e recarregando Nginx"
  sudo nginx -t
  sudo systemctl reload nginx

  log "Teste rapido"
  curl -I "$PUBLIC_URL"

  log "Deploy concluido"
}

main
