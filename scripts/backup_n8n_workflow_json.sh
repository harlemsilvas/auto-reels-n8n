#!/usr/bin/env bash
set -euo pipefail

# Backup de workflow n8n diretamente do PostgreSQL da VPS.
#
# Uso:
#   ./scripts/backup_n8n_workflow_json.sh
#   ./scripts/backup_n8n_workflow_json.sh socialbot-publish-v4
#   N8N_WORKFLOW_ID=t8bjbHSAOk7vDiJS ./scripts/backup_n8n_workflow_json.sh
#
# O script salva:
# - JSON principal do workflow_entity;
# - histórico workflow_history em JSONL;
# - registros webhook_entity associados;
# - manifest com metadados do backup.

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-socialbot_postgres}"
POSTGRES_USER="${POSTGRES_USER:-n8n}"
POSTGRES_DB="${POSTGRES_DB:-n8n}"
WEBHOOK_PATH="${1:-${N8N_WEBHOOK_PATH:-socialbot-publish-v4}}"
WORKFLOW_ID="${N8N_WORKFLOW_ID:-}"
BACKUP_ROOT="${N8N_BACKUP_DIR:-/home/socialbot/backups/n8n-workflows}"

log() {
  echo "[backup-n8n] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $cmd" >&2
    exit 1
  fi
}

psql_scalar() {
  docker exec -i "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1 "$@"
}

psql_to_file() {
  local output_file="$1"
  shift

  docker exec -i "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1 "$@" \
    > "$output_file"
}

main() {
  require_cmd docker
  require_cmd date
  require_cmd mkdir

  if [[ -z "$WORKFLOW_ID" ]]; then
    log "Localizando workflow pelo webhookPath: $WEBHOOK_PATH"
    WORKFLOW_ID="$(psql_scalar -c "SELECT \"workflowId\" FROM webhook_entity WHERE \"webhookPath\" = '$WEBHOOK_PATH' ORDER BY \"workflowId\" LIMIT 1;")"
  fi

  if [[ -z "$WORKFLOW_ID" ]]; then
    echo "Workflow nao encontrado. Informe N8N_WORKFLOW_ID ou um webhookPath valido." >&2
    exit 1
  fi

  local timestamp
  timestamp="$(date +%Y%m%d_%H%M%S)"

  local backup_dir
  backup_dir="$BACKUP_ROOT/${timestamp}_${WORKFLOW_ID}"
  mkdir -p "$backup_dir"

  log "Workflow ID: $WORKFLOW_ID"
  log "Diretorio: $backup_dir"

  psql_to_file "$backup_dir/workflow_entity.json" -c "
SELECT jsonb_pretty(
  jsonb_build_object(
    'source', 'workflow_entity',
    'id', id,
    'name', name,
    'active', active,
    'activeVersionId', \"activeVersionId\",
    'versionId', \"versionId\",
    'versionCounter', \"versionCounter\",
    'triggerCount', \"triggerCount\",
    'createdAt', \"createdAt\",
    'updatedAt', \"updatedAt\",
    'settings', settings::jsonb,
    'staticData', COALESCE(\"staticData\"::jsonb, '{}'::jsonb),
    'pinData', COALESCE(\"pinData\"::jsonb, '{}'::jsonb),
    'nodes', nodes::jsonb,
    'connections', connections::jsonb,
    'meta', COALESCE(meta::jsonb, '{}'::jsonb)
  )
)
FROM workflow_entity
WHERE id = '$WORKFLOW_ID';
"

  psql_to_file "$backup_dir/workflow_history.jsonl" -c "
SELECT jsonb_build_object(
  'source', 'workflow_history',
  'workflowId', \"workflowId\",
  'versionId', \"versionId\",
  'authors', authors,
  'createdAt', \"createdAt\",
  'updatedAt', \"updatedAt\",
  'nodes', nodes::jsonb,
  'connections', connections::jsonb
)::text
FROM workflow_history
WHERE \"workflowId\" = '$WORKFLOW_ID'
ORDER BY \"createdAt\", \"versionId\";
"

  psql_to_file "$backup_dir/webhook_entity.json" -c "
SELECT COALESCE(
  jsonb_pretty(
    jsonb_agg(
      jsonb_build_object(
        'workflowId', \"workflowId\",
        'webhookPath', \"webhookPath\",
        'method', method,
        'node', node,
        'webhookId', \"webhookId\",
        'pathLength', \"pathLength\"
      )
      ORDER BY \"webhookPath\", method, node
    )
  ),
  '[]'
)
FROM webhook_entity
WHERE \"workflowId\" = '$WORKFLOW_ID';
"

  cat > "$backup_dir/manifest.txt" <<EOF
Backup n8n workflow
===================
timestamp=$timestamp
workflow_id=$WORKFLOW_ID
webhook_path=$WEBHOOK_PATH
postgres_container=$POSTGRES_CONTAINER
postgres_db=$POSTGRES_DB

Arquivos:
- workflow_entity.json
- workflow_history.jsonl
- webhook_entity.json

Observacoes:
- Backup gerado diretamente do PostgreSQL do n8n.
- Nao inclui valores de credenciais criptografadas fora do workflow.
- Para restauracao, revisar manualmente antes de aplicar no banco.
EOF

  log "Resumo:"
  ls -lh "$backup_dir"
  log "Backup concluido."
}

main "$@"
