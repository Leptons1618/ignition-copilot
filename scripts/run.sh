#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT/scripts"
DEMO_DIR="$ROOT/demo-app"
MCP_DIR="$ROOT/mcp-server"
LOG_DIR="$SCRIPTS_DIR/.logs"
PID_FILE="$SCRIPTS_DIR/.pids-linux.env"
MCP_STDIN_FIFO="$SCRIPTS_DIR/.mcp-stdio.pipe"

demo_server_pid=""
demo_client_pid=""
mcp_server_pid=""
mcp_stdin_pid=""

mkdir -p "$LOG_DIR"

usage() {
  cat <<'EOF'
Usage: scripts/run.sh <command> [options]

Commands:
  setup                     Install demo-app and mcp-server dependencies
  build                     Build demo-app frontend
  run-demo [--vite] [--rebuild]
                            Start demo backend (:3001) and optional Vite client (:3000)
  run-mcp                   Start MCP server in background
  run-all [--vite] [--rebuild|--no-rebuild] [--skip-smoke]
                            Start demo + MCP and optionally run smoke checks
  smoke                     Run demo API smoke checks
  test                      Build + smoke + mcp-server basic test
  status                    Show process and API health status
  stop                      Stop services tracked by scripts and known ports
  help                      Show this message
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

load_pids() {
  demo_server_pid=""
  demo_client_pid=""
  mcp_server_pid=""
  mcp_stdin_pid=""
  if [[ -f "$PID_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$PID_FILE"
  fi
}

save_pids() {
  cat >"$PID_FILE" <<EOF
demo_server_pid=${demo_server_pid:-}
demo_client_pid=${demo_client_pid:-}
mcp_server_pid=${mcp_server_pid:-}
mcp_stdin_pid=${mcp_stdin_pid:-}
updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

is_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

first_port_pid() {
  local port="$1"
  lsof -ti :"$port" 2>/dev/null | head -n 1 || true
}

wait_http() {
  local url="$1"
  local timeout="${2:-40}"
  local elapsed=0
  while (( elapsed < timeout )); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

stop_pid() {
  local label="$1"
  local pid="${2:-}"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$label already stopped (PID $pid not found)."
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Stopped $label (PID $pid)."
      return 0
    fi
    sleep 1
  done
  kill -9 "$pid" 2>/dev/null || true
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Force-stopped $label (PID $pid)."
  fi
}

find_venv_python() {
  local py="$MCP_DIR/.venv/bin/python"
  if [[ -x "$py" ]]; then
    echo "$py"
    return 0
  fi
  return 1
}

mcp_uses_stdio_transport() {
  [[ -f "$MCP_DIR/ignition_mcp_server.py" ]] && grep -q "stdio_server" "$MCP_DIR/ignition_mcp_server.py"
}

refresh_pid_file() {
  load_pids
  if ! is_running "${demo_server_pid:-}"; then demo_server_pid=""; fi
  if ! is_running "${demo_client_pid:-}"; then demo_client_pid=""; fi
  if ! is_running "${mcp_server_pid:-}"; then mcp_server_pid=""; fi
  if ! is_running "${mcp_stdin_pid:-}"; then mcp_stdin_pid=""; fi
  save_pids
}

cmd_setup() {
  require_cmd npm
  require_cmd python3

  echo "Installing demo-app dependencies..."
  (
    cd "$DEMO_DIR"
    npm install
    (cd client && npm install)
    (cd server && npm install)
  )

  echo "Installing mcp-server dependencies..."
  (
    cd "$MCP_DIR"
    if [[ ! -d ".venv" ]]; then
      python3 -m venv .venv
    fi
    ./.venv/bin/python -m pip install --upgrade pip
    ./.venv/bin/python -m pip install -r requirements.txt
  )

  echo "Setup complete."
}

cmd_build() {
  require_cmd npm
  npm --prefix "$DEMO_DIR" run build
}

cmd_run_demo() {
  local use_vite=0
  local rebuild=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --vite) use_vite=1 ;;
      --rebuild) rebuild=1 ;;
      *)
        echo "Unknown run-demo option: $1" >&2
        return 1
        ;;
    esac
    shift
  done

  require_cmd npm
  require_cmd curl
  require_cmd lsof

  load_pids
  if is_running "${demo_server_pid:-}"; then
    echo "Demo backend already running (PID $demo_server_pid)."
    return 1
  fi

  local owner3001
  owner3001="$(first_port_pid 3001)"
  if [[ -n "$owner3001" ]]; then
    echo "Port 3001 is already in use by PID $owner3001. Run scripts/run.sh stop first."
    return 1
  fi

  if (( use_vite )); then
    local owner3000
    owner3000="$(first_port_pid 3000)"
    if [[ -n "$owner3000" ]]; then
      echo "Port 3000 is already in use by PID $owner3000. Run scripts/run.sh stop first."
      return 1
    fi
  fi

  if (( rebuild )); then
    cmd_build
  elif [[ ! -d "$DEMO_DIR/client/dist" ]]; then
    echo "No frontend dist found. Run scripts/run.sh build or scripts/run.sh run-demo --rebuild."
    return 1
  fi

  (
    cd "$DEMO_DIR"
    nohup npm run server >"$LOG_DIR/demo-server.out.log" 2>"$LOG_DIR/demo-server.err.log" &
    demo_server_pid=$!
    if (( use_vite )); then
      nohup npm run client >"$LOG_DIR/demo-client.out.log" 2>"$LOG_DIR/demo-client.err.log" &
      demo_client_pid=$!
    else
      demo_client_pid=""
    fi
    save_pids
  )

  refresh_pid_file
  if ! wait_http "http://localhost:3001/api/health" 50; then
    echo "Demo backend did not become healthy."
    tail -n 40 "$LOG_DIR/demo-server.err.log" 2>/dev/null || true
    cmd_stop
    return 1
  fi

  if (( use_vite )) && ! wait_http "http://localhost:3000" 40; then
    echo "Vite dev server did not become healthy; backend remains available on :3001."
  fi

  echo "Demo started."
  echo "UI/API: http://localhost:3001"
  if (( use_vite )); then
    echo "Vite UI: http://localhost:3000"
  fi
}

cmd_run_mcp() {
  local py
  if ! py="$(find_venv_python)"; then
    echo "Python venv not found. Run scripts/run.sh setup first."
    return 1
  fi

  load_pids
  if is_running "${mcp_server_pid:-}"; then
    echo "MCP server already running (PID $mcp_server_pid)."
    return 1
  fi

  if mcp_uses_stdio_transport; then
    rm -f "$MCP_STDIN_FIFO"
    mkfifo "$MCP_STDIN_FIFO"
    nohup tail -f /dev/null >"$MCP_STDIN_FIFO" 2>/dev/null &
    mcp_stdin_pid=$!
    (
      cd "$MCP_DIR"
      nohup "$py" ignition_mcp_server.py <"$MCP_STDIN_FIFO" >"$LOG_DIR/mcp-server.out.log" 2>"$LOG_DIR/mcp-server.err.log" &
      mcp_server_pid=$!
      save_pids
    )
  else
    mcp_stdin_pid=""
    (
      cd "$MCP_DIR"
      nohup "$py" ignition_mcp_server.py >"$LOG_DIR/mcp-server.out.log" 2>"$LOG_DIR/mcp-server.err.log" &
      mcp_server_pid=$!
      save_pids
    )
  fi

  sleep 2
  refresh_pid_file
  if ! is_running "${mcp_server_pid:-}"; then
    echo "MCP server exited immediately."
    tail -n 40 "$LOG_DIR/mcp-server.err.log" 2>/dev/null || true
    stop_pid "MCP stdin keepalive" "${mcp_stdin_pid:-}"
    mcp_stdin_pid=""
    rm -f "$MCP_STDIN_FIFO"
    save_pids
    return 1
  fi

  echo "MCP server launched (PID: $mcp_server_pid)."
  if is_running "${mcp_stdin_pid:-}"; then
    echo "MCP stdio keepalive active (PID: $mcp_stdin_pid)."
  fi
}

cmd_smoke() {
  require_cmd curl
  local urls=(
    "http://localhost:3001/api/health"
    "http://localhost:3001/api/chat/tools"
    "http://localhost:3001/api/scenarios"
    "http://localhost:3001/api/rag/stats"
    "http://localhost:3001/api/insights/asset-health"
    "http://localhost:3001/api/insights/alarm-summary"
  )
  for url in "${urls[@]}"; do
    if curl -fsS --max-time 10 "$url" >/dev/null; then
      echo "[OK] $url"
    else
      echo "[FAIL] $url"
      return 1
    fi
  done
  echo "Smoke checks passed."
}

cmd_run_all() {
  local use_vite=0
  local rebuild=1
  local skip_smoke=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --vite) use_vite=1 ;;
      --rebuild) rebuild=1 ;;
      --no-rebuild) rebuild=0 ;;
      --skip-smoke) skip_smoke=1 ;;
      *)
        echo "Unknown run-all option: $1" >&2
        return 1
        ;;
    esac
    shift
  done

  local demo_args=()
  if (( use_vite )); then demo_args+=(--vite); fi
  if (( rebuild )); then demo_args+=(--rebuild); fi
  cmd_run_demo "${demo_args[@]}"
  if ! cmd_run_mcp; then
    echo "MCP server startup failed; continuing with demo services only."
  fi

  if (( ! skip_smoke )); then
    if ! cmd_smoke; then
      echo "Smoke checks had failures, but services remain running."
    fi
  fi
}

show_state() {
  local name="$1"
  local pid="${2:-}"
  if [[ -z "$pid" ]]; then
    echo "$name: not set"
    return
  fi
  if is_running "$pid"; then
    echo "$name: running (PID $pid)"
  else
    echo "$name: stopped (PID $pid not found)"
  fi
}

cmd_status() {
  require_cmd curl
  load_pids
  show_state "Demo Server" "${demo_server_pid:-}"
  show_state "Demo Client" "${demo_client_pid:-}"
  show_state "MCP Server" "${mcp_server_pid:-}"
  if [[ -n "${mcp_stdin_pid:-}" ]]; then
    show_state "MCP Stdin Keepalive" "${mcp_stdin_pid:-}"
  fi

  if curl -fsS --max-time 3 "http://localhost:3001/api/health" >/dev/null 2>&1; then
    echo "API Health: OK"
  else
    echo "API Health: unavailable"
  fi
}

cmd_stop() {
  require_cmd lsof

  load_pids
  stop_pid "Demo Server" "${demo_server_pid:-}"
  stop_pid "Demo Client" "${demo_client_pid:-}"
  stop_pid "MCP Server" "${mcp_server_pid:-}"
  stop_pid "MCP stdin keepalive" "${mcp_stdin_pid:-}"

  local owner3001 owner3000
  owner3001="$(first_port_pid 3001)"
  owner3000="$(first_port_pid 3000)"
  if [[ -n "$owner3001" ]]; then
    stop_pid "Port 3001 process" "$owner3001"
  fi
  if [[ -n "$owner3000" ]]; then
    stop_pid "Port 3000 process" "$owner3000"
  fi

  demo_server_pid=""
  demo_client_pid=""
  mcp_server_pid=""
  mcp_stdin_pid=""
  rm -f "$MCP_STDIN_FIFO"
  rm -f "$PID_FILE"
  echo "All services stopped."
}

cmd_test() {
  cmd_build

  if ! cmd_smoke; then
    echo "Services not healthy. Attempting startup..."
    cmd_stop || true
    cmd_run_all --skip-smoke
    sleep 3
    cmd_smoke
  fi

  local py
  if py="$(find_venv_python)"; then
    (
      cd "$MCP_DIR"
      "$py" test_basic.py
    )
  else
    echo "Skipping MCP tests (.venv not found)."
  fi

  echo "All tests completed."
}

main() {
  local command="${1:-help}"
  shift || true
  case "$command" in
    setup) cmd_setup "$@" ;;
    build) cmd_build ;;
    run-demo) cmd_run_demo "$@" ;;
    run-mcp) cmd_run_mcp ;;
    run-all) cmd_run_all "$@" ;;
    smoke) cmd_smoke ;;
    test) cmd_test ;;
    status) cmd_status ;;
    stop) cmd_stop ;;
    help|-h|--help) usage ;;
    *)
      echo "Unknown command: $command" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
