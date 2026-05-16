#!/usr/bin/env bash
set -euo pipefail

# Deploy do frontend (dashboard) para VPS.
#
# Uso:
#   bash scripts/deploy_frontend_vps.sh
#   FRONTEND_DIR=/home/socialbot/apps/auto-reels-n8n/dashboard \
#   WEB_ROOT=/var/www/dashboard.hrmmotos.com.br \
#   NGINX_SITE=/etc/nginx/sites-enabled/000-dashboard.hrmmotos.com.br \
#   bash scripts/deploy_frontend_vps.sh
#
# Tambem aceita:
#   DASHBOARD_DOMAIN=dashboard.hrmmotos.com.br bash scripts/deploy_frontend_vps.sh

FRONTEND_DIR="${FRONTEND_DIR:-/home/socialbot/apps/auto-reels-n8n/dashboard}"
DASHBOARD_DOMAIN="${DASHBOARD_DOMAIN:-dashboard.hrmmotos.com.br}"
WEB_ROOT="${WEB_ROOT:-}"
NGINX_SITE="${NGINX_SITE:-}"

log() {
  echo "[deploy-frontend] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

detect_nginx_site() {
  local candidates=()
  local found=""

  while IFS= read -r path; do
    candidates+=("$path")
  done < <(sudo grep -Rsl "server_name[[:space:]]\+${DASHBOARD_DOMAIN}" \
    /etc/nginx/sites-enabled /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null || true)

  if [[ ${#candidates[@]} -gt 0 ]]; then
    found="${candidates[0]}"
  fi

  echo "$found"
}

extract_web_root() {
  local site_path="$1"
  local root_line

  root_line="$(sudo awk '/^[[:space:]]*root[[:space:]]+/ {print $2; exit}' "$site_path" 2>/dev/null || true)"
  root_line="${root_line%;}"

  echo "$root_line"
}

main() {
  require_cmd npm
  require_cmd rsync
  require_cmd nginx

  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo "Diretorio do frontend nao encontrado: $FRONTEND_DIR"
    exit 1
  fi

  if [[ -z "$NGINX_SITE" ]]; then
    NGINX_SITE="$(detect_nginx_site)"
  fi

  if [[ -z "$NGINX_SITE" || ! -f "$NGINX_SITE" ]]; then
    echo "Arquivo de site do Nginx nao encontrado automaticamente para ${DASHBOARD_DOMAIN}."
    echo "Defina NGINX_SITE manualmente, por exemplo:"
    echo "NGINX_SITE=/etc/nginx/sites-enabled/SEU_ARQUIVO bash scripts/deploy_frontend_vps.sh"
    exit 1
  fi

  if [[ -z "$WEB_ROOT" ]]; then
    WEB_ROOT="$(extract_web_root "$NGINX_SITE")"
  fi

  if [[ -z "$WEB_ROOT" ]]; then
    echo "Nao foi possivel determinar WEB_ROOT a partir de $NGINX_SITE"
    echo "Defina WEB_ROOT manualmente, por exemplo:"
    echo "WEB_ROOT=/var/www/dashboard.hrmmotos.com.br bash scripts/deploy_frontend_vps.sh"
    exit 1
  fi

  log "Frontend dir: $FRONTEND_DIR"
  log "Web root: $WEB_ROOT"
  log "Nginx site: $NGINX_SITE"

  log "Instalando dependencias"
  cd "$FRONTEND_DIR"
  npm ci

  log "Gerando build"
  npm run build

  if [[ ! -d "$FRONTEND_DIR/dist" ]]; then
    echo "Build nao gerou pasta dist."
    exit 1
  fi

  log "Publicando build em $WEB_ROOT"
  sudo mkdir -p "$WEB_ROOT"
  sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$WEB_ROOT/"

  log "Ajustando permissoes"
  sudo chown -R www-data:www-data "$WEB_ROOT"

  log "Validando configuracao Nginx"
  sudo nginx -t

  log "Recarregando Nginx"
  sudo systemctl reload nginx

  log "Deploy concluido"
  echo
  echo "Validacao sugerida:"
  echo "curl -I https://dashboard.hrmmotos.com.br"
}

main
