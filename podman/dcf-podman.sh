#!/usr/bin/env bash
# Reusable local Podman helper for Feedback Analytics (macOS / Linux / WSL).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${HERE}/.." && pwd)"
ENV_FILE="${HERE}/.env"
ENV_EXAMPLE="${HERE}/.env.example"
COMPOSE_FILE="${HERE}/compose.yml"
DOCKER_ENV="${REPO_ROOT}/docker/.env"
CONTAINER_NAME="dcf-feedback-app"
IMAGE_NAME="localhost/dcf-feedback-app:latest"
VOLUME_NAME="dcf-feedback-data"

COMMAND="${1:-help}"
shift || true

FOLLOW=0
NO_BUILD=0
NO_SMOKE=0
NO_CACHE=0
for arg in "$@"; do
  case "$arg" in
    --follow|-f) FOLLOW=1 ;;
    --no-build) NO_BUILD=1 ;;
    --no-smoke) NO_SMOKE=1 ;;
    --no-cache) NO_CACHE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log() { echo "[podman] $*"; }

need_podman() {
  command -v podman >/dev/null 2>&1 || {
    echo "ERROR: podman is not on PATH. Install Podman Desktop or the Podman CLI." >&2
    exit 1
  }
}

start_container() {
  local port
  port="$(env_value APP_HTTP_PORT 4020)"
  log "Starting ${CONTAINER_NAME} from ${IMAGE_NAME} (podman run; Compose not required)"
  podman rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  podman run -d \
    --name "${CONTAINER_NAME}" \
    --replace \
    -p "${port}:80" \
    --env-file "${ENV_FILE}" \
    -e NODE_ENV=production \
    -e PORT=8080 \
    -v "${VOLUME_NAME}:/app/backend/data" \
    --restart unless-stopped \
    "${IMAGE_NAME}"
}

stop_container() {
  local remove_volume="${1:-0}"
  podman rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  if [[ "${remove_volume}" -eq 1 ]]; then
    podman volume rm -f "${VOLUME_NAME}" >/dev/null 2>&1 || true
    log "Removed volume ${VOLUME_NAME}"
  else
    log "Stopped ${CONTAINER_NAME}. Volume ${VOLUME_NAME} was kept."
  fi
}

ensure_ready() {
  if podman info >/dev/null 2>&1; then
    return
  fi
  log "Podman engine is not ready. Trying 'podman machine start'..."
  podman machine start
}

env_value() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "${default}"
    return
  fi
  local val
  val="$(grep -E "^${key}=" "${ENV_FILE}" | head -n1 | cut -d= -f2- || true)"
  echo "${val:-${default}}"
}

ensure_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    log "Using ${ENV_FILE}"
    return
  fi
  if [[ -f "${DOCKER_ENV}" ]]; then
    cp "${DOCKER_ENV}" "${ENV_FILE}"
    log "Created podman/.env from docker/.env"
    return
  fi
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  log "Created podman/.env from .env.example"
}

hf_notice() {
  local token
  token="$(env_value HF_API_TOKEN)"
  if [[ -z "${token}" ]]; then
    token="$(env_value HUGGINGFACE_API_KEY)"
  fi
  if [[ -z "${token}" ]]; then
    echo
    echo "WARN: HF_API_TOKEN is empty in podman/.env. The UI still works; AI uses fallback heuristics."
    echo "      Add a token from https://huggingface.co/settings/tokens and rerun ./dcf-podman.sh up"
    echo
  fi
}

app_urls() {
  local port base
  port="$(env_value APP_HTTP_PORT 4020)"
  base="$(env_value APP_BASE_PATH /feedback)"
  base="${base%/}"
  UI="http://127.0.0.1:${port}${base}/"
  HEALTH="http://127.0.0.1:${port}${base}/v1/health"
  PORTAL="http://127.0.0.1:${port}${base}/portal"
}

show_urls() {
  app_urls
  echo
  echo "UI:          ${UI}"
  echo "API health:  ${HEALTH}"
  echo "Portal:      ${PORTAL}"
  echo
  echo "Demo logins (password: demo): admin_demo, supervisor_demo, mr_demo"
}

desktop_hints() {
  echo
  echo "Image is on the Podman machine. Click-to-run in Podman Desktop:"
  echo "  1. Images → dcf-feedback-app (tag latest) → Run"
  echo "  2. Container name:  dcf-feedback-app"
  echo "  3. Port mapping:    Host 4020  →  Container 80"
  echo "  4. Volume:          dcf-feedback-data  →  /app/backend/data"
  echo "  5. Optional env:    HF_API_TOKEN=hf_..."
  echo "  6. Start, then open http://127.0.0.1:4020/feedback/"
  echo
  echo "Or play the ready-made pod (ports + volume already set):"
  echo "  Kubernetes → Play YAML → ${HERE}/desktop-play.yaml"
  echo
}

image_build() {
  local force_no_cache="${1:-0}"
  ensure_env
  local vite_base vite_api
  vite_base="$(env_value VITE_BASE_PATH /feedback/)"
  vite_api="$(env_value VITE_API_BASE_URL /feedback/v1)"
  local args=(
    build
    -f "${REPO_ROOT}/docker/Dockerfile.app"
    -t dcf-feedback-app:latest
    -t localhost/dcf-feedback-app:latest
    --build-arg "VITE_BASE_PATH=${vite_base}"
    --build-arg "VITE_API_BASE_URL=${vite_api}"
  )
  if [[ "${force_no_cache}" -eq 1 || "${NO_CACHE}" -eq 1 ]]; then
    args+=(--no-cache)
  fi
  args+=("${REPO_ROOT}")
  log "Building dcf-feedback-app:latest for Podman Desktop (first build can take several minutes)"
  podman "${args[@]}"
  log "Tagged: dcf-feedback-app:latest  and  localhost/dcf-feedback-app:latest"
  podman images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" dcf-feedback-app
}

wait_healthy() {
  app_urls
  log "Waiting for ${HEALTH} (up to 180s)..."
  local i
  for i in $(seq 1 36); do
    if command -v curl >/dev/null 2>&1 && curl -sf "${HEALTH}" >/dev/null; then
      log "Health check passed."
      return
    fi
    sleep 5
  done
  echo "ERROR: app did not become healthy. Check: ./dcf-podman.sh logs" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Feedback Analytics — local Podman helper

Usage:
  ./dcf-podman.sh build           Build image only (then click-to-run in Desktop)
  ./dcf-podman.sh build --no-cache
  ./dcf-podman.sh up              Build (if needed) and start with podman run
  ./dcf-podman.sh up --no-build   Start without rebuilding
  ./dcf-podman.sh up --no-smoke   Skip the health check
  ./dcf-podman.sh rebuild         Rebuild with --no-cache, then start
  ./dcf-podman.sh down            Stop containers (keeps SQLite volume)
  ./dcf-podman.sh reset           Wipe data volume and start fresh
  ./dcf-podman.sh logs            Show recent logs
  ./dcf-podman.sh logs --follow   Follow logs
  ./dcf-podman.sh status          Container / machine / image status
  ./dcf-podman.sh urls            Print local URLs
EOF
}

case "${COMMAND}" in
  help|-h|--help) usage ;;
  urls)
    ensure_env
    show_urls
    ;;
  status)
    need_podman
    ensure_ready
    podman version
    echo
    podman machine list || true
    echo
    log "images (dcf-feedback-app)"
    podman images "${IMAGE_NAME}" || true
    echo
    log "container ${CONTAINER_NAME}"
    podman ps -a --filter "name=${CONTAINER_NAME}" || true
    ;;
  build)
    need_podman
    ensure_ready
    image_build
    hf_notice
    desktop_hints
    ;;
  logs)
    need_podman
    ensure_ready
    ensure_env
    if [[ "${FOLLOW}" -eq 1 ]]; then
      podman logs -f --tail 200 "${CONTAINER_NAME}"
    else
      podman logs --tail 200 "${CONTAINER_NAME}"
    fi
    ;;
  down)
    need_podman
    ensure_ready
    ensure_env
    stop_container
    ;;
  up)
    need_podman
    ensure_ready
    ensure_env
    hf_notice
    if [[ "${NO_BUILD}" -eq 0 ]]; then
      image_build
    fi
    start_container
    if [[ "${NO_SMOKE}" -eq 0 ]]; then
      wait_healthy
    fi
    show_urls
    ;;
  rebuild)
    need_podman
    ensure_ready
    ensure_env
    hf_notice
    image_build 1
    start_container
    if [[ "${NO_SMOKE}" -eq 0 ]]; then
      wait_healthy
    fi
    show_urls
    ;;
  reset)
    need_podman
    ensure_ready
    ensure_env
    log "Removing containers and the SQLite volume (demo data will be re-seeded on start)..."
    stop_container 1
    image_build
    start_container
    if [[ "${NO_SMOKE}" -eq 0 ]]; then
      wait_healthy
    fi
    show_urls
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    usage >&2
    exit 1
    ;;
esac
