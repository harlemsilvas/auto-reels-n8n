#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   bash scripts/create-user.sh local
#   bash scripts/create-user.sh vps
#
# Variaveis opcionais:
#   APP_USER=socialbot
#   APP_HOME=/home/socialbot
#   MEDIA_ROOT=/home/socialbot/media
#   SET_PASSWORD=true|false   (apenas vps)

MODE="${1:-local}"
APP_USER="${APP_USER:-socialbot}"
APP_HOME="${APP_HOME:-/home/${APP_USER}}"
MEDIA_ROOT="${MEDIA_ROOT:-/home/socialbot/media}"
SET_PASSWORD="${SET_PASSWORD:-false}"

if [[ "${MODE}" != "local" && "${MODE}" != "vps" ]]; then
  echo "Modo invalido: ${MODE}. Use: local ou vps."
  exit 1
fi

if [[ ${EUID} -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

log() {
  echo "[setup] $*"
}

ensure_dir() {
  local dir_path="$1"
  ${SUDO} mkdir -p "${dir_path}"
}

log "Iniciando setup (${MODE})"
log "APP_USER=${APP_USER}"
log "APP_HOME=${APP_HOME}"
log "MEDIA_ROOT=${MEDIA_ROOT}"

if [[ "${MODE}" == "vps" ]]; then
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    log "Usuario ${APP_USER} ja existe."
  else
    log "Criando usuario ${APP_USER}..."
    ${SUDO} adduser --disabled-password --gecos "" "${APP_USER}"

    if [[ "${SET_PASSWORD}" == "true" ]]; then
      log "Defina a senha do usuario ${APP_USER}:"
      ${SUDO} passwd "${APP_USER}"
    fi
  fi

  if getent group docker >/dev/null 2>&1; then
    log "Adicionando ${APP_USER} ao grupo docker..."
    ${SUDO} usermod -aG docker "${APP_USER}"
  else
    log "Grupo docker nao encontrado. Pulei usermod -aG docker."
  fi

  ensure_dir "${APP_HOME}/apps"
  ensure_dir "${APP_HOME}/docker"
  ensure_dir "${APP_HOME}/backups"
  ensure_dir "${APP_HOME}/logs"
  ensure_dir "${APP_HOME}/scripts"
fi

# Estrutura usada no projeto atual (local e vps)
ensure_dir "${MEDIA_ROOT}/reels/pending"
ensure_dir "${MEDIA_ROOT}/reels/published"
ensure_dir "${MEDIA_ROOT}/reels/error"

# Arquivo .env de apoio no modo vps
if [[ "${MODE}" == "vps" ]]; then
  ensure_dir "${APP_HOME}/docker"
  ${SUDO} touch "${APP_HOME}/docker/.env"
fi

# Ajusta ownership quando o usuario alvo existe
if id -u "${APP_USER}" >/dev/null 2>&1; then
  log "Ajustando ownership para ${APP_USER}:${APP_USER}"
  ${SUDO} chown -R "${APP_USER}:${APP_USER}" "${MEDIA_ROOT}" || true

  if [[ "${MODE}" == "vps" ]]; then
    ${SUDO} chown -R "${APP_USER}:${APP_USER}" "${APP_HOME}" || true
  fi
fi

log "Setup finalizado."

echo
echo "Resumo:"
echo "- Modo: ${MODE}"
echo "- Media: ${MEDIA_ROOT}/reels/{pending,published,error}"

if [[ "${MODE}" == "vps" ]]; then
  echo "- Home app: ${APP_HOME}"
  echo "- Proximo passo: su - ${APP_USER}"
fi
