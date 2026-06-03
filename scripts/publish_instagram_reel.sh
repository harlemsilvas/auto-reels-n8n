#!/usr/bin/env bash
set -euo pipefail

# Publica um Reel via Instagram Graph API com fluxo completo:
# 1) cria container
# 2) aguarda processamento
# 3) publica
#
# Uso:
#   IG_USER_ID="1784..." PAGE_TOKEN="EA..." VIDEO_URL="https://.../video.mp4" \
#   CAPTION="Legenda" bash scripts/publish_instagram_reel.sh
#
# Variaveis obrigatorias:
#   IG_USER_ID (ou IG_ACCOUNT_ID)
#   PAGE_TOKEN (ou META_TOKEN)
#   VIDEO_URL
#
# Variaveis opcionais:
#   CAPTION=""
#   SHARE_TO_FEED="true"      # true|false
#   API_VERSION="v23.0"
#   POLL_INTERVAL_SEC="5"
#   POLL_TIMEOUT_SEC="300"
#   CONNECT_TIMEOUT_SEC="15"
#   MAX_TIME_SEC="120"

SCRIPT_NAME="publish_reel"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_VERSION="${API_VERSION:-v23.0}"
GRAPH_BASE="https://graph.facebook.com/${API_VERSION}"

ENV_FILE="${ENV_FILE:-}"

IG_USER_ID="${IG_USER_ID:-}"
PAGE_TOKEN="${PAGE_TOKEN:-}"
VIDEO_URL="${VIDEO_URL:-}"
CAPTION="${CAPTION:-}"
SHARE_TO_FEED="${SHARE_TO_FEED:-true}"

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-5}"
POLL_TIMEOUT_SEC="${POLL_TIMEOUT_SEC:-300}"
CONNECT_TIMEOUT_SEC="${CONNECT_TIMEOUT_SEC:-15}"
MAX_TIME_SEC="${MAX_TIME_SEC:-120}"

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

on_error() {
  local exit_code="$1"
  local line="$2"
  log "ERRO" "Falha inesperada na linha ${line} (exit=${exit_code})."
  log "ERRO" "Revise as variaveis de ambiente e a conectividade de rede."
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'on_error $? $LINENO' ERR

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    die "Comando obrigatorio nao encontrado: ${cmd}"
  fi
}

require_env() {
  local var_name="$1"
  local var_value="$2"
  if [[ -z "${var_value}" ]]; then
    die "Variavel obrigatoria ausente: ${var_name}"
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
  local line key value current

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

      # Prioriza variaveis ja informadas no ambiente de execucao.
      current="${!key:-}"
      if [[ -n "${current}" ]]; then
        continue
      fi

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
    if [[ ! -f "${ENV_FILE}" ]]; then
      die "ENV_FILE nao encontrado: ${ENV_FILE}"
    fi
    load_env_file "${ENV_FILE}"
    return
  fi

  if [[ -f "${ROOT_DIR}/.env" ]]; then
    load_env_file "${ROOT_DIR}/.env"
  fi
  if [[ -f "${ROOT_DIR}/backend/.env" ]]; then
    load_env_file "${ROOT_DIR}/backend/.env"
  fi
}

init_runtime_config() {
  IG_USER_ID="${IG_USER_ID:-${IG_ACCOUNT_ID:-}}"
  PAGE_TOKEN="${PAGE_TOKEN:-${META_TOKEN:-}}"
  VIDEO_URL="${VIDEO_URL:-}"
  CAPTION="${CAPTION:-}"
  SHARE_TO_FEED="${SHARE_TO_FEED:-true}"
}

assert_bool() {
  local name="$1"
  local value="$2"
  if [[ "${value}" != "true" && "${value}" != "false" ]]; then
    die "${name} deve ser true ou false. Valor atual: ${value}"
  fi
}

validate_video_url() {
  if [[ ! "${VIDEO_URL}" =~ ^https?:// ]]; then
    die "VIDEO_URL invalida. Use URL publica iniciando com http:// ou https://"
  fi
}

parse_graph_error() {
  local body_file="$1"
  local msg type code subcode fbtrace

  msg="$(jq -r '.error.message // empty' "${body_file}" 2>/dev/null || true)"
  type="$(jq -r '.error.type // empty' "${body_file}" 2>/dev/null || true)"
  code="$(jq -r '.error.code // empty' "${body_file}" 2>/dev/null || true)"
  subcode="$(jq -r '.error.error_subcode // empty' "${body_file}" 2>/dev/null || true)"
  fbtrace="$(jq -r '.error.fbtrace_id // empty' "${body_file}" 2>/dev/null || true)"

  if [[ -n "${msg}" || -n "${code}" ]]; then
    log "ERRO" "Graph API retornou erro:"
    log "ERRO" "message=${msg:-n/a}"
    log "ERRO" "type=${type:-n/a} code=${code:-n/a} subcode=${subcode:-n/a} fbtrace_id=${fbtrace:-n/a}"
    return 0
  fi

  return 1
}

api_post_form() {
  local endpoint="$1"
  shift
  local body_file="$1"
  shift

  local status
  status="$({
    curl -sS -o "${body_file}" -w '%{http_code}' \
      --connect-timeout "${CONNECT_TIMEOUT_SEC}" \
      --max-time "${MAX_TIME_SEC}" \
      -X POST "${GRAPH_BASE}/${endpoint}" \
      "$@"
  } || true)"

  if [[ -z "${status}" || "${status}" == "000" ]]; then
    die "Falha de rede ao chamar POST /${endpoint}."
  fi

  echo "${status}"
}

api_get() {
  local endpoint_with_query="$1"
  local body_file="$2"

  local status
  status="$({
    curl -sS -o "${body_file}" -w '%{http_code}' \
      --connect-timeout "${CONNECT_TIMEOUT_SEC}" \
      --max-time "${MAX_TIME_SEC}" \
      "${GRAPH_BASE}/${endpoint_with_query}"
  } || true)"

  if [[ -z "${status}" || "${status}" == "000" ]]; then
    die "Falha de rede ao chamar GET ${endpoint_with_query}."
  fi

  echo "${status}"
}

main() {
  require_cmd curl
  require_cmd jq

  load_envs
  init_runtime_config

  require_env "IG_USER_ID (ou IG_ACCOUNT_ID)" "${IG_USER_ID}"
  require_env "PAGE_TOKEN (ou META_TOKEN)" "${PAGE_TOKEN}"
  require_env "VIDEO_URL" "${VIDEO_URL}"

  assert_bool "SHARE_TO_FEED" "${SHARE_TO_FEED}"
  validate_video_url

  TMP_DIR="$(mktemp -d)"
  local create_body status_body publish_body
  create_body="${TMP_DIR}/create.json"
  status_body="${TMP_DIR}/status.json"
  publish_body="${TMP_DIR}/publish.json"

  log "INFO" "Iniciando publicacao de Reel no Instagram."
  log "INFO" "IG_USER_ID=${IG_USER_ID} API_VERSION=${API_VERSION}"

  log "INFO" "Passo 1/3: criando container de midia (REELS)."
  local create_status
  create_status="$(api_post_form "${IG_USER_ID}/media" "${create_body}" \
    -d "media_type=REELS" \
    -d "video_url=${VIDEO_URL}" \
    -d "caption=${CAPTION}" \
    -d "share_to_feed=${SHARE_TO_FEED}" \
    -d "access_token=${PAGE_TOKEN}")"

  if [[ "${create_status}" -lt 200 || "${create_status}" -ge 300 ]]; then
    parse_graph_error "${create_body}" || log "ERRO" "Resposta inesperada: $(cat "${create_body}")"
    die "Falha ao criar container. HTTP ${create_status}."
  fi

  local creation_id
  creation_id="$(jq -r '.id // empty' "${create_body}")"
  if [[ -z "${creation_id}" ]]; then
    log "ERRO" "Resposta sem id de container: $(cat "${create_body}")"
    die "Container criado sem id retornado."
  fi

  log "INFO" "Container criado com sucesso. creation_id=${creation_id}"

  log "INFO" "Passo 2/3: aguardando processamento do container."
  local start_ts now elapsed
  start_ts="$(date +%s)"

  while true; do
    local qs status_http status_code status_text
    # Alguns contextos/v23 nao expõem error_message neste node; mantenha somente campos amplamente suportados.
    qs="${creation_id}?fields=status_code,status&access_token=${PAGE_TOKEN}"
    status_http="$(api_get "${qs}" "${status_body}")"

    if [[ "${status_http}" -lt 200 || "${status_http}" -ge 300 ]]; then
      parse_graph_error "${status_body}" || log "ERRO" "Resposta inesperada: $(cat "${status_body}")"
      die "Falha ao consultar status do container. HTTP ${status_http}."
    fi

    status_code="$(jq -r '.status_code // empty' "${status_body}")"
    status_text="$(jq -r '.status // empty' "${status_body}")"

    log "INFO" "Status container: status_code=${status_code:-n/a} status=${status_text:-n/a}"

    if [[ "${status_code}" == "FINISHED" ]]; then
      break
    fi

    if [[ "${status_code}" == "ERROR" || "${status_code}" == "EXPIRED" ]]; then
      die "Container terminou com ${status_code}."
    fi

    now="$(date +%s)"
    elapsed=$(( now - start_ts ))
    if (( elapsed >= POLL_TIMEOUT_SEC )); then
      die "Timeout aguardando container (${POLL_TIMEOUT_SEC}s)."
    fi

    sleep "${POLL_INTERVAL_SEC}"
  done

  log "INFO" "Passo 3/3: publicando Reel."
  local publish_status
  publish_status="$(api_post_form "${IG_USER_ID}/media_publish" "${publish_body}" \
    -d "creation_id=${creation_id}" \
    -d "access_token=${PAGE_TOKEN}")"

  if [[ "${publish_status}" -lt 200 || "${publish_status}" -ge 300 ]]; then
    parse_graph_error "${publish_body}" || log "ERRO" "Resposta inesperada: $(cat "${publish_body}")"
    die "Falha ao publicar Reel. HTTP ${publish_status}."
  fi

  local media_id
  media_id="$(jq -r '.id // empty' "${publish_body}")"
  if [[ -z "${media_id}" ]]; then
    log "ERRO" "Resposta sem id publicado: $(cat "${publish_body}")"
    die "Publicacao concluida sem media_id retornado."
  fi

  log "INFO" "Reel publicado com sucesso. media_id=${media_id}"

  cat <<EOF

Resumo da publicacao:
- ig_user_id: ${IG_USER_ID}
- creation_id: ${creation_id}
- media_id: ${media_id}

Proximos checks em caso de erro:
1) Verifique se VIDEO_URL e publica e acessivel sem autenticacao.
2) Confirme permissoes do token (pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish).
3) Confirme que a conta e do tipo Business e esta vinculada a pagina correta.
EOF
}

main "$@"
