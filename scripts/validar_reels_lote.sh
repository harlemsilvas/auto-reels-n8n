#!/usr/bin/env bash
set -euo pipefail

# Valida publicacao de Reels em lote usando o script publish_instagram_reel.sh.
#
# O script:
# 1) carrega variaveis de .env (automatico ou via ENV_FILE)
# 2) le um arquivo de videos (VIDEOS_FILE)
# 3) publica cada item sequencialmente
# 4) exibe resumo de sucesso/falha
#
# Formato de VIDEOS_FILE (uma linha por item):
#   https://dominio.com/video1.mp4|Legenda opcional
#   https://dominio.com/video2.mp4
#   arquivo-local-ou-nome.mp4|Legenda
#
# Se a URL nao iniciar com http(s), e usado MEDIA_PUBLIC_BASE_URL (quando definido).
#
# Uso:
#   VIDEOS_FILE="scripts/videos_upload.txt" bash scripts/validar_reels_lote.sh
#   ENV_FILE="backend/.env" VIDEOS_FILE="scripts/videos_upload.txt" bash scripts/validar_reels_lote.sh
#
# Variaveis esperadas no env:
#   IG_USER_ID
#   PAGE_TOKEN
#
# Variaveis opcionais:
#   CAPTION_DEFAULT="Legenda padrao"
#   SHARE_TO_FEED="true"
#   STOP_ON_ERROR="false"   # true|false

SCRIPT_NAME="validar_reels_lote"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLISH_SCRIPT="${ROOT_DIR}/scripts/publish_instagram_reel.sh"

ENV_FILE="${ENV_FILE:-}"
VIDEOS_FILE="${VIDEOS_FILE:-}"
STOP_ON_ERROR="${STOP_ON_ERROR:-false}"
CAPTION_DEFAULT="${CAPTION_DEFAULT:-${CAPTION:-}}"

TMP_DIR=""

log() {
  local level="$1"
  shift
  printf '[%s] [%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${SCRIPT_NAME}" "${level}" "$*"
}

die() {
  log "ERRO" "$*"
  exit 1
}

cleanup() {
  if [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
}

trap cleanup EXIT

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    die "Comando obrigatorio nao encontrado: ${cmd}"
  fi
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ -z "${path}" ]]; then
    die "${label} nao informado."
  fi
  if [[ ! -f "${path}" ]]; then
    die "Arquivo nao encontrado (${label}): ${path}"
  fi
}

assert_bool() {
  local name="$1"
  local value="$2"
  if [[ "${value}" != "true" && "${value}" != "false" ]]; then
    die "${name} deve ser true ou false. Valor atual: ${value}"
  fi
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "${s}"
}

load_env_file() {
  local env_path="$1"
  local line key value

  log "INFO" "Carregando env: ${env_path}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="$(trim "${line}")"

    if [[ -z "${line}" || "${line:0:1}" == "#" ]]; then
      continue
    fi

    if [[ "${line}" =~ ^(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      key="${BASH_REMATCH[2]}"
      value="${BASH_REMATCH[3]}"
      value="$(trim "${value}")"

      if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "${value}" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      printf -v "${key}" '%s' "${value}"
      export "${key}"
    fi
  done < "${env_path}"
}

load_envs() {
  if [[ -n "${ENV_FILE}" ]]; then
    require_file "${ENV_FILE}" "ENV_FILE"
    load_env_file "${ENV_FILE}"
    return
  fi

  local loaded=0
  if [[ -f "${ROOT_DIR}/.env" ]]; then
    load_env_file "${ROOT_DIR}/.env"
    loaded=1
  fi
  if [[ -f "${ROOT_DIR}/backend/.env" ]]; then
    load_env_file "${ROOT_DIR}/backend/.env"
    loaded=1
  fi

  if [[ "${loaded}" == "0" ]]; then
    log "INFO" "Nenhum .env encontrado em ${ROOT_DIR}/.env ou ${ROOT_DIR}/backend/.env"
  fi
}

resolve_video_url() {
  local input="$1"
  local base

  if [[ "${input}" =~ ^https?:// ]]; then
    printf '%s' "${input}"
    return
  fi

  base="${MEDIA_PUBLIC_BASE_URL:-}"
  base="${base%/}"
  input="${input#/}"

  if [[ -z "${base}" ]]; then
    printf '%s' "${input}"
    return
  fi

  printf '%s' "${base}/${input}"
}

publish_one() {
  local item_url="$1"
  local item_caption="$2"

  IG_USER_ID="${IG_USER_ID}" \
  PAGE_TOKEN="${PAGE_TOKEN}" \
  VIDEO_URL="${item_url}" \
  CAPTION="${item_caption}" \
  SHARE_TO_FEED="${SHARE_TO_FEED:-true}" \
  API_VERSION="${API_VERSION:-v23.0}" \
  POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-5}" \
  POLL_TIMEOUT_SEC="${POLL_TIMEOUT_SEC:-300}" \
  CONNECT_TIMEOUT_SEC="${CONNECT_TIMEOUT_SEC:-15}" \
  MAX_TIME_SEC="${MAX_TIME_SEC:-120}" \
  bash "${PUBLISH_SCRIPT}"
}

main() {
  require_cmd bash
  require_cmd awk

  assert_bool "STOP_ON_ERROR" "${STOP_ON_ERROR}"
  [[ -x "${PUBLISH_SCRIPT}" ]] || die "Script de publicacao nao encontrado/executavel: ${PUBLISH_SCRIPT}"

  load_envs

  require_file "${VIDEOS_FILE}" "VIDEOS_FILE"
  [[ -n "${IG_USER_ID:-}" ]] || die "IG_USER_ID ausente (defina no .env ou no ambiente)."
  [[ -n "${PAGE_TOKEN:-}" ]] || die "PAGE_TOKEN ausente (defina no .env ou no ambiente)."

  TMP_DIR="$(mktemp -d)"
  local ok_file fail_file
  ok_file="${TMP_DIR}/ok.txt"
  fail_file="${TMP_DIR}/fail.txt"
  : > "${ok_file}"
  : > "${fail_file}"

  log "INFO" "Iniciando lote com arquivo: ${VIDEOS_FILE}"

  local raw line url caption resolved total
  total=0

  while IFS= read -r raw || [[ -n "${raw}" ]]; do
    line="$(trim "${raw}")"

    if [[ -z "${line}" || "${line:0:1}" == "#" ]]; then
      continue
    fi

    total=$((total + 1))
    url="${line%%|*}"
    caption=""

    if [[ "${line}" == *"|"* ]]; then
      caption="${line#*|}"
    fi

    url="$(trim "${url}")"
    caption="$(trim "${caption}")"

    if [[ -z "${caption}" ]]; then
      caption="${CAPTION_DEFAULT}"
    fi

    resolved="$(resolve_video_url "${url}")"

    log "INFO" "[${total}] Publicando: ${resolved}"
    if publish_one "${resolved}" "${caption}"; then
      echo "${resolved}" >> "${ok_file}"
      log "INFO" "[${total}] OK"
    else
      echo "${resolved}" >> "${fail_file}"
      log "ERRO" "[${total}] FALHA"
      if [[ "${STOP_ON_ERROR}" == "true" ]]; then
        break
      fi
    fi
  done < "${VIDEOS_FILE}"

  local ok_count fail_count
  ok_count="$(wc -l < "${ok_file}" | tr -d ' ')"
  fail_count="$(wc -l < "${fail_file}" | tr -d ' ')"

  echo
  echo "Resumo do lote:"
  echo "- sucesso: ${ok_count}"
  echo "- falhas: ${fail_count}"

  if [[ "${fail_count}" -gt 0 ]]; then
    echo
    echo "Itens com falha:"
    cat "${fail_file}"
    exit 1
  fi
}

main "$@"
