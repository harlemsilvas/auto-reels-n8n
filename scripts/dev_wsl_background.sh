#!/usr/bin/env bash
set -euo pipefail

# Sobe/para serviços locais de desenvolvimento no WSL em background.
#
# Uso:
#   bash scripts/dev_wsl_background.sh start
#   bash scripts/dev_wsl_background.sh start --with-worker
#   bash scripts/dev_wsl_background.sh restart
#   bash scripts/dev_wsl_background.sh restart --with-worker
#   bash scripts/dev_wsl_background.sh status
#   bash scripts/dev_wsl_background.sh logs
#   bash scripts/dev_wsl_background.sh logs backend
#   bash scripts/dev_wsl_background.sh stop

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev-run"
LOG_DIR="$RUN_DIR/logs"

BACKEND_DIR="$ROOT_DIR/backend"
DASHBOARD_DIR="$ROOT_DIR/dashboard"

BACKEND_PORT="3101"
DASHBOARD_PORT="5181"

BACKEND_PID="$RUN_DIR/backend.pid"
DASHBOARD_PID="$RUN_DIR/dashboard.pid"
WORKER_PID="$RUN_DIR/worker.pid"

log() {
  echo "[dev-wsl] $*"
}

ensure_dirs() {
  mkdir -p "$RUN_DIR" "$LOG_DIR"
}

pid_is_running() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    return 1
  fi

  kill -0 "$pid" >/dev/null 2>&1
}

kill_matching_processes() {
  local name="$1"
  local pattern="$2"

  if ! command -v pgrep >/dev/null 2>&1; then
    return
  fi

  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"

  if [[ -z "$pids" ]]; then
    return
  fi

  log "Encerrando processos órfãos de $name"
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    [[ "$pid" != "$$" ]] || continue
    kill "$pid" >/dev/null 2>&1 || true
  done <<<"$pids"

  sleep 0.5
}

start_service() {
  local name="$1"
  local dir="$2"
  local pid_file="$3"
  shift 3

  if pid_is_running "$pid_file"; then
    log "$name já está rodando (pid $(cat "$pid_file"))."
    return
  fi

  log "Iniciando $name"
  (
    cd "$dir"
    nohup setsid "$@" >"$LOG_DIR/$name.log" 2>&1 &
    echo $! >"$pid_file"
  )
  log "$name iniciado (pid $(cat "$pid_file")). Log: $LOG_DIR/$name.log"
}

stop_service() {
  local name="$1"
  local pid_file="$2"

  if ! pid_is_running "$pid_file"; then
    log "$name não está rodando."
    rm -f "$pid_file"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  log "Parando $name (pid $pid)"

  if kill -0 "-$pid" >/dev/null 2>&1; then
    kill "-$pid" >/dev/null 2>&1 || true
  else
    kill "$pid" >/dev/null 2>&1 || true
  fi

  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pid_file"
      log "$name parado."
      return
    fi
    sleep 0.2
  done

  log "$name não encerrou com SIGTERM; forçando."
  if kill -0 "-$pid" >/dev/null 2>&1; then
    kill -9 "-$pid" >/dev/null 2>&1 || true
  else
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
}

release_port() {
  local name="$1"
  local port="$2"

  if command -v fuser >/dev/null 2>&1; then
    if fuser -s "$port/tcp" >/dev/null 2>&1; then
      log "Liberando porta $port usada por $name"
      fuser -k "$port/tcp" >/dev/null 2>&1 || true
      sleep 0.5
    fi
    return
  fi

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"

    if [[ -n "$pids" ]]; then
      log "Liberando porta $port usada por $name"
      while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue
        kill "$pid" >/dev/null 2>&1 || true
      done <<<"$pids"
      sleep 0.5
    fi
    return
  fi

  log "Não foi possível verificar a porta $port: instale fuser ou lsof se o problema persistir."
}

prepare_local_ports() {
  log "Preparando portas locais"
  stop_service "dashboard" "$DASHBOARD_PID"
  stop_service "backend" "$BACKEND_PID"
  kill_matching_processes "dashboard" "$DASHBOARD_DIR/node_modules/.bin/vite"
  kill_matching_processes "backend" "$BACKEND_DIR/node_modules/.bin/nodemon src/server.js"
  release_port "dashboard" "$DASHBOARD_PORT"
  release_port "backend" "$BACKEND_PORT"
}

status_service() {
  local name="$1"
  local pid_file="$2"
  local url="${3:-}"

  if pid_is_running "$pid_file"; then
    if [[ -n "$url" ]]; then
      log "$name: rodando (pid $(cat "$pid_file")) - $url"
    else
      log "$name: rodando (pid $(cat "$pid_file"))"
    fi
  else
    log "$name: parado"
  fi
}

start_all() {
  local with_worker="false"

  for arg in "$@"; do
    case "$arg" in
      --with-worker)
        with_worker="true"
        ;;
      *)
        echo "Argumento inválido para start: $arg"
        exit 1
        ;;
    esac
  done

  ensure_dirs
  prepare_local_ports

  start_service "backend" "$BACKEND_DIR" "$BACKEND_PID" npm run dev
  start_service "dashboard" "$DASHBOARD_DIR" "$DASHBOARD_PID" npm run dev -- --host 0.0.0.0 --strictPort

  if [[ "$with_worker" == "true" ]]; then
    start_service "worker" "$BACKEND_DIR" "$WORKER_PID" npm run worker
  fi

  log "Backend:   http://localhost:$BACKEND_PORT"
  log "Dashboard: http://localhost:$DASHBOARD_PORT"
  log "Logs:      bash scripts/dev_wsl_background.sh logs"
}

stop_all() {
  ensure_dirs
  stop_service "worker" "$WORKER_PID"
  stop_service "dashboard" "$DASHBOARD_PID"
  stop_service "backend" "$BACKEND_PID"
}

status_all() {
  ensure_dirs
  status_service "backend" "$BACKEND_PID" "http://localhost:$BACKEND_PORT"
  status_service "dashboard" "$DASHBOARD_PID" "http://localhost:$DASHBOARD_PORT"
  status_service "worker" "$WORKER_PID"
}

show_logs() {
  ensure_dirs

  local service="${1:-all}"
  case "$service" in
    backend|dashboard|worker)
      touch "$LOG_DIR/$service.log"
      tail -n 120 -f "$LOG_DIR/$service.log"
      ;;
    all)
      touch "$LOG_DIR/backend.log" "$LOG_DIR/dashboard.log" "$LOG_DIR/worker.log"
      tail -n 80 -f "$LOG_DIR/backend.log" "$LOG_DIR/dashboard.log" "$LOG_DIR/worker.log"
      ;;
    *)
      echo "Serviço inválido para logs: $service"
      echo "Use: backend, dashboard, worker ou all"
      exit 1
      ;;
  esac
}

main() {
  local command="${1:-}"
  shift || true

  case "$command" in
    start)
      start_all "$@"
      ;;
    stop)
      stop_all
      ;;
    restart)
      stop_all
      start_all "$@"
      ;;
    status)
      status_all
      ;;
    logs)
      show_logs "${1:-all}"
      ;;
    *)
      cat <<'USAGE'
Uso:
  bash scripts/dev_wsl_background.sh start
  bash scripts/dev_wsl_background.sh start --with-worker
  bash scripts/dev_wsl_background.sh restart
  bash scripts/dev_wsl_background.sh restart --with-worker
  bash scripts/dev_wsl_background.sh status
  bash scripts/dev_wsl_background.sh logs
  bash scripts/dev_wsl_background.sh logs backend
  bash scripts/dev_wsl_background.sh logs dashboard
  bash scripts/dev_wsl_background.sh logs worker
  bash scripts/dev_wsl_background.sh stop
USAGE
      exit 1
      ;;
  esac
}

main "$@"
