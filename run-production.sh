#!/usr/bin/env bash
# DCF Feedback Analytics — bare-metal production runner (no Docker)
#
#   API+SPA  http://127.0.0.1:14020/feedback/
#
# Usage (from install root /var/www/dcf-feedback):
#   cp deploy/.env.example deploy/.env
#   chmod +x run-production.sh
#   ./run-production.sh --pm2
#   ./run-production.sh --install-system-deps
#   ./run-production.sh --no-build --no-seed
#   ./run-production.sh --seed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

HOST_PORT="${HOST_PORT:-14020}"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env}"
LOG_DIR="${LOG_DIR:-$ROOT/logs}"
BACKEND="$ROOT/codebase/backend"
FRONTEND="$ROOT/codebase/frontend"
APP_NAME="dcf-feedback-api"

INSTALL_SYSTEM=0
DO_BUILD=1
DO_SEED=auto
FORCE_SEED=0
USE_PM2=0
SERVER_PID=""

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \?//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-system-deps) INSTALL_SYSTEM=1; shift ;;
    --no-build) DO_BUILD=0; shift ;;
    --no-seed) DO_SEED=0; shift ;;
    --seed) FORCE_SEED=1; shift ;;
    --pm2) USE_PM2=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

cleanup() {
  [[ -z "$SERVER_PID" ]] && return 0
  echo ""
  echo "==> Stopping production server..."
  kill "$SERVER_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
if [[ "$USE_PM2" -eq 0 ]]; then
  trap cleanup EXIT INT TERM
fi

require_linux() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "Error: run-production.sh targets Linux (Ubuntu server)." >&2
    exit 1
  fi
}

install_system_packages() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Error: apt-get not found. Install Node.js >= 20, curl, and build-essential manually." >&2
    exit 1
  fi
  echo "==> Installing system packages (sudo may prompt)..."
  sudo apt-get update
  sudo apt-get install -y curl ca-certificates gnupg build-essential python3
  if ! command -v node >/dev/null 2>&1 || (( $(node -p "process.versions.node.split('.')[0]") < 20 )); then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
}

require_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  echo "==> Installing pm2 (npm install -g pm2)..."
  if npm install -g pm2 >/dev/null; then
    command -v pm2 >/dev/null 2>&1 && return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo npm install -g pm2 >/dev/null; then
    command -v pm2 >/dev/null 2>&1 && return 0
  fi
  echo "Error: could not install pm2. Try: sudo npm install -g pm2" >&2
  exit 1
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js >= 20 is required. Run: $0 --install-system-deps" >&2
    exit 1
  fi
  if (( $(node -p "process.versions.node.split('.')[0]") < 20 )); then
    echo "Error: Node.js >= 20 required (found $(node -v))." >&2
    exit 1
  fi
  command -v npm >/dev/null 2>&1 || { echo "Error: npm is required." >&2; exit 1; }
  command -v curl >/dev/null 2>&1 || { echo "Error: curl is required." >&2; exit 1; }
}

normalize_path() {
  local value="${1:-}"
  value="/${value#/}"
  echo "${value%/}"
}

load_env_file() {
  local file=$1
  [[ -f "$file" ]] || return 1
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      value="${value#\"}"; value="${value%\"}"
      value="${value#\'}"; value="${value%\'}"
      export "$key=$value"
    fi
  done < "$file"
  return 0
}

prepare_env() {
  echo "==> Loading production environment..."
  # shellcheck source=deploy/fill-env.sh
  source "$ROOT/deploy/fill-env.sh"
  fill_deploy_env
  load_env_file "$ENV_FILE"

  export NODE_ENV="${NODE_ENV:-production}"
  export TRUST_PROXY="${TRUST_PROXY:-1}"
  export HOST="${HOST:-127.0.0.1}"
  export HOST_PORT="${HOST_PORT:-14020}"
  export PORT="${PORT:-$HOST_PORT}"
  export APP_BASE_PATH="$(normalize_path "${APP_BASE_PATH:-/feedback}")"
  export VITE_BASE_PATH="${VITE_BASE_PATH:-${APP_BASE_PATH}/}"
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-${APP_BASE_PATH}/v1}"
  export PUBLIC_SURVEY_BASE_URL="${PUBLIC_SURVEY_BASE_URL:-${APP_BASE_PATH}/survey}"
  export CORS_ORIGIN="${CORS_ORIGIN:-*}"
  export STATIC_DIR="${STATIC_DIR:-$FRONTEND/dist}"
  export DATABASE_URL="${DATABASE_URL:-sqlite://${ROOT}/data/feedback.db}"
  if [[ "$DATABASE_URL" == sqlite://./data/* || "$DATABASE_URL" == *"/app/"* ]]; then
    export DATABASE_URL="sqlite://${ROOT}/data/feedback.db"
    echo "    Adjusted DATABASE_URL for bare-metal: $DATABASE_URL"
  fi

  mkdir -p "$LOG_DIR" "${ROOT}/data" "$BACKEND/data"

  echo "    Env file : $ENV_FILE"
  echo "    Bind     : ${HOST}:${PORT}${APP_BASE_PATH}/"
  echo "    Public   : ${PUBLIC_SCHEME:-https}://${PUBLIC_HOST:-127.0.0.1}${APP_BASE_PATH}/"
}

sqlite_binding_ok() {
  (cd "$BACKEND" && node --input-type=module -e "import Database from 'better-sqlite3'; new Database(':memory:');") >/dev/null 2>&1
}

ensure_sqlite_binding() {
  if sqlite_binding_ok; then
    return 0
  fi
  echo "==> Rebuilding better-sqlite3 for this host..."
  (cd "$BACKEND" && npm rebuild better-sqlite3)
  sqlite_binding_ok || { echo "Error: better-sqlite3 rebuild failed." >&2; exit 1; }
}

install_npm_deps() {
  echo "==> Installing npm dependencies (including build tools)..."
  if [[ -f "$BACKEND/package-lock.json" ]]; then
    (cd "$BACKEND" && npm_config_production=false npm ci --include=dev)
  else
    (cd "$BACKEND" && npm_config_production=false npm install --include=dev)
  fi
  if [[ -f "$FRONTEND/package-lock.json" ]]; then
    (cd "$FRONTEND" && npm_config_production=false npm ci --include=dev)
  else
    (cd "$FRONTEND" && npm_config_production=false npm install --include=dev)
  fi
  ensure_sqlite_binding
}

build_apps() {
  echo "==> Building backend..."
  (cd "$BACKEND" && npm run build)
  echo "==> Building frontend (VITE_BASE_PATH=${VITE_BASE_PATH})..."
  if [[ ! -x "$FRONTEND/node_modules/.bin/vite" ]]; then
    echo "Error: vite is not installed. Expected after npm ci --include=dev." >&2
    exit 1
  fi
  (cd "$FRONTEND" && VITE_BASE_PATH="$VITE_BASE_PATH" VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build)
}

ensure_built_assets() {
  if [[ "$DO_BUILD" -eq 0 ]]; then
    echo "==> Skipping build (--no-build)"
    if [[ ! -f "$BACKEND/dist/index.js" ]]; then
      echo "Error: backend dist missing. Run without --no-build." >&2
      exit 1
    fi
    if [[ ! -f "$FRONTEND/dist/index.html" ]]; then
      echo "Error: frontend dist missing. Run without --no-build." >&2
      exit 1
    fi
    return 0
  fi
  build_apps
}

seed_database() {
  local db_file="${ROOT}/data/feedback.db"
  if [[ "$DO_SEED" == "0" && "$FORCE_SEED" -eq 0 ]]; then
    echo "==> Skipping seed (--no-seed)"
    return 0
  fi
  if [[ "$FORCE_SEED" -eq 1 ]]; then
    echo "==> Seeding demo database (--seed)..."
    (cd "$BACKEND" && DATABASE_URL="$DATABASE_URL" node dist/db/seed.js)
    return 0
  fi
  if [[ ! -f "$db_file" ]]; then
    echo "==> Seeding demo database (first run)..."
    (cd "$BACKEND" && DATABASE_URL="$DATABASE_URL" node dist/db/seed.js)
  else
    echo "==> Database exists — skipping seed (use --seed to reset demo data)"
  fi
}

port_in_use() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$port" 2>/dev/null | grep -q ":$port "
    return $?
  fi
  return 1
}

free_port() {
  local port=$1
  if ! port_in_use "$port"; then
    return 0
  fi
  echo "==> Port $port in use — stopping listeners..."
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -TERM "$port/tcp" 2>/dev/null || true
    sleep 0.5
    fuser -k -KILL "$port/tcp" 2>/dev/null || true
    sleep 0.2
  fi
  if port_in_use "$port"; then
    echo "Error: port $port is still in use." >&2
    exit 1
  fi
}

wait_for_url() {
  local url=$1 label=$2
  local attempts=0
  while (( attempts < 60 )); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "    $label ready"
      return 0
    fi
    sleep 0.5
    attempts=$((attempts + 1))
  done
  echo "Timed out waiting for $label ($url)" >&2
  return 1
}

print_urls() {
  echo ""
  echo "Production stack running (bare metal):"
  echo "  UI      : http://127.0.0.1:${PORT}${APP_BASE_PATH}/"
  echo "  Health  : http://127.0.0.1:${PORT}${APP_BASE_PATH}/v1/health"
  if [[ -n "${PUBLIC_HOST:-}" ]]; then
    echo "Public URL (via nginx):"
    echo "  ${PUBLIC_SCHEME:-https}://${PUBLIC_HOST}${APP_BASE_PATH}/"
  fi
}

start_with_pm2() {
  require_pm2
  local ecosystem="$ROOT/deploy/ecosystem.config.cjs"
  echo "==> Starting ${APP_NAME} with PM2..."
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  free_port "$PORT"
  mkdir -p "$ROOT/logs"
  pm2 start "$ecosystem"
  if ! wait_for_url "http://127.0.0.1:${PORT}${APP_BASE_PATH}/v1/health" "API"; then
    pm2 logs "$APP_NAME" --lines 40 --nostream >&2 || true
    exit 1
  fi
  pm2 status
  print_urls
  echo "  Logs    : $ROOT/logs  (also: pm2 logs ${APP_NAME})"
  echo ""
  echo "PM2 commands:"
  echo "  pm2 logs ${APP_NAME}"
  echo "  pm2 restart ${APP_NAME}"
  echo "  pm2 save && pm2 startup    # persist after reboot"
}

start_foreground() {
  free_port "$PORT"
  echo "==> Starting API on ${HOST}:${PORT} (Ctrl+C to stop)..."
  (
    cd "$BACKEND"
    exec env NODE_ENV=production HOST="$HOST" PORT="$PORT" APP_BASE_PATH="$APP_BASE_PATH" \
      STATIC_DIR="$STATIC_DIR" DATABASE_URL="$DATABASE_URL" CORS_ORIGIN="$CORS_ORIGIN" \
      PUBLIC_SURVEY_BASE_URL="$PUBLIC_SURVEY_BASE_URL" \
      node dist/index.js
  ) &
  SERVER_PID=$!
  wait_for_url "http://127.0.0.1:${PORT}${APP_BASE_PATH}/v1/health" "API" || {
    wait "$SERVER_PID" 2>/dev/null || true
    exit 1
  }
  print_urls
  wait "$SERVER_PID"
}

main() {
  require_linux
  [[ "$INSTALL_SYSTEM" -eq 1 ]] && install_system_packages
  require_node
  [[ "$USE_PM2" -eq 1 ]] && require_pm2
  prepare_env
  install_npm_deps
  ensure_built_assets
  seed_database
  if [[ "$USE_PM2" -eq 1 ]]; then
    start_with_pm2
  else
    start_foreground
  fi
}

main "$@"
