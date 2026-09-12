#!/usr/bin/env bash
# Deploys this repo's backend+frontend via Docker Compose from package-docker.sh.
#
# Default install directory on VM: /var/www/dcf-feedback
# (archive contents are flattened into that path — docker-compose.yml at the root)
# Single container on host port 4020 (nginx + API). Point host nginx at 127.0.0.1:4020/feedback/
# URL base path (relative): /feedback

set -euo pipefail

ARCHIVE_PATH=""
DEPLOY_ROOT="/var/www/dcf-feedback"
SKIP_BUILD=0
RUN_SMOKE=1
ENV_FILE_OVERRIDE=""

APP_BASE_PATH_DEFAULT="/feedback"
APP_HTTP_PORT_DEFAULT="4020"

usage() {
  cat <<'EOF'
Usage: deploy-docker.sh [options] /path/to/dcf-feedback-docker.zip

Options:
  --skip-build          Skip docker compose build
  --no-smoke            Skip post-deploy smoke checks
  --install-dir DIR     Install directory (default: /var/www/dcf-feedback)
  --env-file PATH       Copy this file to <install>/.env before compose up

Environment overrides (optional):
  APP_BASE_PATH         Default /feedback
  APP_HTTP_PORT         Default 4020
  HF_API_TOKEN          Hugging Face token (optional)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-smoke) RUN_SMOKE=0; shift ;;
    --install-dir) DEPLOY_ROOT="$2"; shift 2 ;;
    --env-file) ENV_FILE_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *.zip) ARCHIVE_PATH="$1"; shift ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required command: $1" >&2; exit 1; }
}

need docker
need unzip
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose plugin required" >&2; exit 1; }

if [[ -z "${ARCHIVE_PATH}" ]] || [[ ! -f "${ARCHIVE_PATH}" ]]; then
  echo "ERROR: archive not found: ${ARCHIVE_PATH}" >&2
  usage >&2
  exit 1
fi

ARCHIVE_PATH="$(cd "$(dirname "${ARCHIVE_PATH}")" && pwd)/$(basename "${ARCHIVE_PATH}")"
mkdir -p "${DEPLOY_ROOT}"

EXTRACT_TMP="$(mktemp -d)"
trap 'rm -rf "${EXTRACT_TMP}"' EXIT
unzip -oq "${ARCHIVE_PATH}" -d "${EXTRACT_TMP}"

echo "[deploy] Install directory: ${DEPLOY_ROOT}"
echo "[deploy] Extracted archive to: ${EXTRACT_TMP}"

if [[ -f "${EXTRACT_TMP}/dcf-feedback/docker-compose.yml" ]]; then
  echo "[deploy] Flattening dcf-feedback/ → ${DEPLOY_ROOT}/"
  rsync -a "${EXTRACT_TMP}/dcf-feedback/" "${DEPLOY_ROOT}/"
elif [[ -f "${EXTRACT_TMP}/docker-compose.yml" ]]; then
  echo "[deploy] Copying archive root → ${DEPLOY_ROOT}/"
  rsync -a "${EXTRACT_TMP}/" "${DEPLOY_ROOT}/"
else
  found="$(find "${EXTRACT_TMP}" -maxdepth 3 -name docker-compose.yml -type f 2>/dev/null | head -n1 || true)"
  if [[ -n "${found}" ]]; then
    src_root="$(dirname "${found}")"
    echo "[deploy] Copying ${src_root} → ${DEPLOY_ROOT}/"
    rsync -a "${src_root}/" "${DEPLOY_ROOT}/"
  else
    echo "ERROR: docker-compose.yml not found in archive" >&2
    exit 1
  fi
fi

ROOT_DIR="${DEPLOY_ROOT}"
if [[ ! -f "${ROOT_DIR}/docker-compose.yml" ]]; then
  echo "ERROR: ${ROOT_DIR}/docker-compose.yml missing after extract" >&2
  exit 1
fi

# Legacy compose bind-mounted ./docker/nginx-app.conf → container conf.d; not used anymore.
if [[ -d "${ROOT_DIR}/docker/nginx-app.conf" ]]; then
  echo "[deploy] Removing legacy host path ${ROOT_DIR}/docker/nginx-app.conf (directory from old mount)"
  rm -rf "${ROOT_DIR}/docker/nginx-app.conf"
fi

TEMPLATE="${ROOT_DIR}/docker/nginx-app.conf.template"
ENV_FILE="${ROOT_DIR}/.env"

find_env_example() {
  local root="$1"
  local candidate
  for candidate in \
    "${root}/docker/.env.example" \
    "${root}/.env.example" \
    "${root}/codebase/backend/.env.example"; do
    if [[ -f "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

write_minimal_env() {
  local dest="$1"
  cat > "${dest}" <<'EOF'
APP_BASE_PATH=/feedback
APP_HTTP_PORT=4020
PORT=8080
NODE_ENV=production
DATABASE_URL=sqlite://./data/feedback.db
CORS_ORIGIN=*
PUBLIC_SURVEY_BASE_URL=/feedback/survey
VITE_BASE_PATH=/feedback/
VITE_API_BASE_URL=/feedback/v1
DEMO_FAST_TRIGGERS=true
LLM_PROVIDER=huggingface
HF_MODEL=Qwen/Qwen2.5-7B-Instruct:featherless-ai
HF_API_BASE=https://router.huggingface.co/v1
HF_API_TOKEN=
HUGGINGFACE_API_KEY=
LLM_REQUEST_TIMEOUT_MS=600000
LLM_MAX_RETRIES=2
LLM_RETRY_BASE_DELAY_MS=1200
EOF
}

hf_token_from_env() {
  local f="$1"
  local t
  t="$(get_env_value HF_API_TOKEN "${f}")"
  if [[ -n "${t}" ]]; then
    echo "${t}"
    return
  fi
  get_env_value HUGGINGFACE_API_KEY "${f}"
}

if [[ -f "${ENV_FILE}" ]]; then
  echo "[deploy] Using packaged ${ENV_FILE} (includes HF token if present in archive)"
elif [[ -n "${ENV_FILE_OVERRIDE}" ]] && [[ -f "${ENV_FILE_OVERRIDE}" ]]; then
  cp "${ENV_FILE_OVERRIDE}" "${ENV_FILE}"
  echo "[deploy] Using env file from --env-file: ${ENV_FILE_OVERRIDE}"
elif ENV_EXAMPLE="$(find_env_example "${ROOT_DIR}")"; then
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "[deploy] Created ${ENV_FILE} from ${ENV_EXAMPLE} (no packaged .env — set HF_API_TOKEN)"
else
  echo "WARN: no .env in package; writing minimal ${ENV_FILE}" >&2
  write_minimal_env "${ENV_FILE}"
fi

get_env_value() {
  local key="$1"
  local f="$2"
  grep -E "^${key}=" "${f}" 2>/dev/null | head -n1 | cut -d= -f2- || true
}

set_env_value() {
  local key="$1"
  local val="$2"
  local f="$3"
  if sed --version >/dev/null 2>&1; then
    sed -i -E "s|^${key}=.*|${key}=${val}|g" "${f}" 2>/dev/null || true
  else
    sed -i '' -E "s|^${key}=.*|${key}=${val}|g" "${f}" 2>/dev/null || true
  fi
  if ! grep -qE "^${key}=" "${f}"; then
    echo "${key}=${val}" >> "${f}"
  fi
}

APP_BASE_PATH="${APP_BASE_PATH:-$(get_env_value APP_BASE_PATH "${ENV_FILE}")}"
APP_BASE_PATH="${APP_BASE_PATH:-${APP_BASE_PATH_DEFAULT}}"
APP_BASE_PATH="${APP_BASE_PATH%/}"

APP_HTTP_PORT="${APP_HTTP_PORT:-$(get_env_value APP_HTTP_PORT "${ENV_FILE}")}"
APP_HTTP_PORT="${APP_HTTP_PORT:-${APP_HTTP_PORT_DEFAULT}}"

PUBLIC_SURVEY_BASE_URL="$(get_env_value PUBLIC_SURVEY_BASE_URL "${ENV_FILE}")"
PUBLIC_SURVEY_BASE_URL="${PUBLIC_SURVEY_BASE_URL:-${APP_BASE_PATH}/survey}"

set_env_value "APP_BASE_PATH" "${APP_BASE_PATH}" "${ENV_FILE}"
set_env_value "APP_HTTP_PORT" "${APP_HTTP_PORT}" "${ENV_FILE}"
set_env_value "PUBLIC_SURVEY_BASE_URL" "${PUBLIC_SURVEY_BASE_URL}" "${ENV_FILE}"
set_env_value "VITE_BASE_PATH" "${APP_BASE_PATH}/" "${ENV_FILE}"
set_env_value "VITE_API_BASE_URL" "${APP_BASE_PATH}/v1" "${ENV_FILE}"
if [[ -z "$(get_env_value CORS_ORIGIN "${ENV_FILE}")" ]]; then
  set_env_value "CORS_ORIGIN" "*" "${ENV_FILE}"
fi
set_env_value "NODE_ENV" "production" "${ENV_FILE}"
set_env_value "PORT" "8080" "${ENV_FILE}"

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "ERROR: nginx template missing: ${TEMPLATE}" >&2
  exit 1
fi
echo "[deploy] Nginx config will be generated inside the container from APP_BASE_PATH=${APP_BASE_PATH}"

chmod +x "${ROOT_DIR}/scripts/"*.sh 2>/dev/null || true

HF_TOKEN="$(hf_token_from_env "${ENV_FILE}")"
if [[ -z "${HF_TOKEN}" ]]; then
  echo ""
  echo "WARN: HF_API_TOKEN / HUGGINGFACE_API_KEY is not set in ${ENV_FILE}"
  echo "      AI will use fallback heuristics until you add a token and restart:"
  echo "        HF_API_TOKEN=hf_xxxxxxxx"
  echo "        docker compose up -d --force-recreate"
  echo ""
else
  echo "[deploy] Hugging Face token: configured"
fi

cd "${ROOT_DIR}"
export DOCKER_BUILDKIT=1

# Compose reads APP_HTTP_PORT / APP_BASE_PATH from shell for build args and port mapping.
set -a
# shellcheck disable=SC1091
source "${ENV_FILE}"
set +a
export APP_HTTP_PORT APP_BASE_PATH

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  docker compose build
fi

docker compose up -d

if [[ "${RUN_SMOKE}" -eq 1 ]]; then
  need curl
  echo "Waiting for backend health (up to 180s)…"
  for _ in $(seq 1 36); do
    if curl -sf "http://127.0.0.1:${APP_HTTP_PORT}${APP_BASE_PATH}/v1/health" >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done

  echo "Smoke-check UI…"
  curl -sf "http://127.0.0.1:${APP_HTTP_PORT}${APP_BASE_PATH}/" >/dev/null
fi

cat <<EOF

Deployed dcf-feedback
Install dir: ${ROOT_DIR}
Env file:    ${ENV_FILE}

UI:          http://127.0.0.1:${APP_HTTP_PORT}${APP_BASE_PATH}/
API health:  http://127.0.0.1:${APP_HTTP_PORT}${APP_BASE_PATH}/v1/health

Point host nginx at: http://127.0.0.1:${APP_HTTP_PORT}${APP_BASE_PATH}/
EOF
