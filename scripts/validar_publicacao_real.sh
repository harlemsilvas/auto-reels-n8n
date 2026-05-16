#!/usr/bin/env bash
set -euo pipefail

# Uso rapido:
#   bash scripts/validar_publicacao_real.sh
#   bash scripts/validar_publicacao_real.sh <post-id-1> <post-id-2>
#
# O script:
# 1) valida health da API
# 2) opcionalmente reseta posts informados e limpa conflito de jobId na fila
# 3) chama enqueue-ready
# 4) aguarda processamento (timeout configuravel)
# 5) mostra consultas finais de status e eventos

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_BASE_URL="${API_BASE_URL:-http://localhost:3101}"
DB_CONTAINER="${DB_CONTAINER:-socialbot_postgres}"
DB_USER="${DB_USER:-n8n}"
DB_NAME="${DB_NAME:-n8n}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-180}"
WAIT_STEP_SEC="${WAIT_STEP_SEC:-5}"

POST_IDS=("$@")

log() {
  echo "[validacao] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

run_sql() {
  local sql="$1"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

run_sql_raw() {
  local sql="$1"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$sql"
}

build_in_clause() {
  local out=""
  local id
  for id in "${POST_IDS[@]}"; do
    if [[ -n "$out" ]]; then
      out+=","
    fi
    out+="'${id}'"
  done
  echo "$out"
}

cleanup_jobs_for_ids() {
  if [[ ${#POST_IDS[@]} -eq 0 ]]; then
    return 0
  fi

  local csv
  csv="$(printf '"%s",' "${POST_IDS[@]}")"
  csv="[${csv%,}]"

  log "Removendo jobIds antigos da fila para evitar already_exists"
  (
    cd "$ROOT_DIR/backend"
    node -e "
      const { Queue } = require('bullmq');
      const env = require('./src/config/env');
      const ids = ${csv};
      const q = new Queue(env.PUBLISH_QUEUE_NAME, {
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
        },
      });
      (async () => {
        for (const id of ids) {
          const job = await q.getJob(id);
          if (job) {
            await job.remove();
            console.log('removed', id);
          } else {
            console.log('missing', id);
          }
        }
        await q.close();
      })().catch(async (err) => {
        console.error(err?.message || err);
        try { await q.close(); } catch (_) {}
        process.exit(1);
      });
    "
  )
}

get_media_public_base_url() {
  (
    cd "$ROOT_DIR/backend"
    node -e "const env=require('./src/config/env'); console.log(env.MEDIA_PUBLIC_BASE_URL || '');"
  )
}

preflight_media_urls_for_ids() {
  if [[ ${#POST_IDS[@]} -eq 0 ]]; then
    return 0
  fi

  local media_base file_name url http_code failed
  media_base="${MEDIA_PUBLIC_BASE_URL:-$(get_media_public_base_url)}"
  media_base="${media_base%/}"

  if [[ -z "$media_base" ]]; then
    log "MEDIA_PUBLIC_BASE_URL vazio; pulando preflight de URL publica."
    return 0
  fi

  log "Preflight de midia publica em ${media_base}"
  failed=0

  local post_id
  for post_id in "${POST_IDS[@]}"; do
    file_name="$(run_sql_raw "SELECT COALESCE(u.stored_filename,'') FROM posts p LEFT JOIN uploads u ON u.id = p.upload_id WHERE p.id='${post_id}' LIMIT 1;" | tr -d '\r')"

    if [[ -z "$file_name" ]]; then
      log "Post ${post_id}: sem stored_filename no banco."
      failed=1
      continue
    fi

    url="${media_base}/${file_name}"
    http_code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"

    if [[ "$http_code" != "200" ]]; then
      log "Post ${post_id}: URL inacessivel (${http_code}) -> ${url}"
      failed=1
      continue
    fi

    log "Post ${post_id}: URL OK (200) -> ${url}"
  done

  if [[ "$failed" == "1" ]]; then
    echo
    echo "Falha no preflight de midia publica. Corrija os arquivos/URLs e rode novamente."
    exit 1
  fi
}

wait_until_finished() {
  local started elapsed active waiting
  started="$(date +%s)"

  while true; do
    local stats_json
    stats_json="$(curl -fsS "${API_BASE_URL}/api/internal/scheduler/stats")"
    active="$(echo "$stats_json" | jq -r '.active // 0')"
    waiting="$(echo "$stats_json" | jq -r '.waiting // 0')"

    log "Fila: active=${active} waiting=${waiting}"

    if [[ "$active" == "0" && "$waiting" == "0" ]]; then
      log "Fila sem jobs ativos/aguardando."
      break
    fi

    elapsed=$(( $(date +%s) - started ))
    if (( elapsed >= WAIT_TIMEOUT_SEC )); then
      log "Timeout atingido (${WAIT_TIMEOUT_SEC}s). Seguindo para consultas finais."
      break
    fi

    sleep "$WAIT_STEP_SEC"
  done
}

show_final_queries() {
  local in_clause filter
  in_clause="$(build_in_clause)"

  if [[ -n "$in_clause" ]]; then
    filter="WHERE id IN (${in_clause})"
    log "Resultado final para IDs informados"
    run_sql "SELECT id, status, meta_media_id, error_message, retry_count, updated_at FROM posts ${filter} ORDER BY updated_at DESC;"

    log "Eventos recentes para IDs informados"
    run_sql "SELECT post_id, event_type, details, created_at FROM post_events WHERE post_id IN (${in_clause}) ORDER BY created_at DESC LIMIT 40;"
  else
    log "Resultado final geral (top 10)"
    run_sql "SELECT id, status, meta_media_id, error_message, updated_at FROM posts ORDER BY updated_at DESC LIMIT 10;"

    log "Eventos recentes gerais (top 40)"
    run_sql "SELECT post_id, event_type, details, created_at FROM post_events ORDER BY created_at DESC LIMIT 40;"
  fi
}

main() {
  require_cmd curl
  require_cmd docker
  require_cmd jq

  log "Health check da API"
  curl -fsS "${API_BASE_URL}/api/health" | jq .

  if [[ ${#POST_IDS[@]} -gt 0 ]]; then
    local in_clause
    in_clause="$(build_in_clause)"

    log "Resetando posts informados para pending"
    run_sql "UPDATE posts SET status='pending', error_message=NULL, meta_media_id=NULL, updated_at=NOW() WHERE id IN (${in_clause});"

    cleanup_jobs_for_ids

    preflight_media_urls_for_ids
  fi

  log "Enfileirando posts prontos"
  curl -fsS -X POST "${API_BASE_URL}/api/internal/scheduler/enqueue-ready" -H "Content-Type: application/json" | jq .

  wait_until_finished

  log "Status final da fila"
  curl -fsS "${API_BASE_URL}/api/internal/scheduler/stats" | jq .

  show_final_queries

  log "Concluido"
}

main
