#!/usr/bin/env bash
# Creates a zip archive for deploying the single-container app (docker/Dockerfile.app) via Docker Compose.
#
# Usage:
#   ./scripts/package-docker.sh [output.zip]     # verbose (default)
#   ./scripts/package-docker.sh --quiet [output.zip]
#
# On the VM (default install dir /var/www/dcf-feedback):
#   ./scripts/deploy-docker.sh /path/to/dcf-feedback-docker.zip

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING="$(mktemp -d)"
trap 'rm -rf "${STAGING}"' EXIT

VERBOSE=1
ARCHIVE_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quiet|-q) VERBOSE=0; shift ;;
    -h|--help)
      echo "Usage: package-docker.sh [--quiet] [output.zip]"
      exit 0
      ;;
    *.zip) ARCHIVE_PATH="$1"; shift ;;
    *) ARCHIVE_PATH="$1"; shift ;;
  esac
done

ARCHIVE_PATH="${ARCHIVE_PATH:-"${ROOT_DIR}/dist/dcf-feedback-docker.zip"}"
OUT_DIR="$(cd "$(dirname "${ARCHIVE_PATH}")" && pwd)"
ARCHIVE_PATH="${OUT_DIR}/$(basename "${ARCHIVE_PATH}")"

VERSION="$(node -p "require('${ROOT_DIR}/codebase/backend/package.json').version" 2>/dev/null || echo 0.0.0)"
GIT_SHA="nogit"
if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --short HEAD >/dev/null 2>&1; then
  GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
fi

PKG_DIR="${STAGING}/dcf-feedback"
mkdir -p "${OUT_DIR}" "${PKG_DIR}"

log() {
  echo "[package] $*"
}

vlog() {
  if [[ "${VERBOSE}" -eq 1 ]]; then
    echo "[package] $*"
  fi
}

log_section() {
  echo ""
  echo "========== $* =========="
}

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required command: $1" >&2; exit 1; }
}

need zip
need rsync

log_section "Package metadata"
log "Source repo:  ${ROOT_DIR}"
log "Staging dir:  ${PKG_DIR}"
log "Archive path: ${ARCHIVE_PATH}"
log "Version:      ${VERSION}"
log "Git:          ${GIT_SHA}"
log "Verbose:      ${VERBOSE}"

REQUIRED=(
  "docker-compose.yml"
  "docker/.env.example"
  "docker/nginx.conf"
  "docker/nginx-app.conf.template"
  "docker/Dockerfile.app"
  "docker/start.sh"
  "codebase/backend/Dockerfile"
  "codebase/backend/package.json"
  "codebase/frontend/Dockerfile"
  "codebase/frontend/package.json"
  "scripts/deploy-docker.sh"
  "scripts/package-docker.sh"
)

log_section "Pre-flight required files"
for rel in "${REQUIRED[@]}"; do
  if [[ -f "${ROOT_DIR}/${rel}" ]]; then
    vlog "  OK   ${rel} ($(wc -c < "${ROOT_DIR}/${rel}" | tr -d ' ') bytes)"
  else
    echo "ERROR: required file missing: ${rel}" >&2
    exit 1
  fi
done

if [[ ! -f "${ROOT_DIR}/docker/.env" ]]; then
  echo "ERROR: docker/.env is required for packaging (HF token + deploy config)." >&2
  echo "  Copy docker/.env.example to docker/.env and set HF_API_TOKEN, or restore docker/.env from your secrets store." >&2
  exit 1
fi
if ! grep -qE '^HF_API_TOKEN=hf_' "${ROOT_DIR}/docker/.env" 2>/dev/null \
  && ! grep -qE '^HUGGINGFACE_API_KEY=hf_' "${ROOT_DIR}/docker/.env" 2>/dev/null; then
  echo "ERROR: docker/.env must set HF_API_TOKEN or HUGGINGFACE_API_KEY (hf_…)" >&2
  exit 1
fi
log "  OK   docker/.env (HF token present — will be bundled as .env in archive)"

copy_tree() {
  local rel="$1"
  local src="${ROOT_DIR}/${rel}"
  local dest="${PKG_DIR}/${rel}"

  if [[ ! -e "${src}" ]]; then
    log "WARN: missing ${rel}, skipping"
    return 1
  fi

  mkdir -p "$(dirname "${dest}")"

  if [[ -d "${src}" ]]; then
    local file_count
  file_count="$(find "${src}" -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    ! -name '.env' \
    ! -name '.env.local' \
    2>/dev/null | wc -l | tr -d ' ')"
  vlog "  rsync ${rel}/ (${file_count} source files, excludes: node_modules dist build .env)"

  if [[ "${VERBOSE}" -eq 1 ]]; then
    rsync -av \
      --exclude "node_modules" \
      --exclude "dist" \
      --exclude "build" \
      --exclude ".env" \
      --exclude ".env.local" \
      --exclude "data/*.db" \
      --exclude "data/*.db-*" \
      --exclude "data/notification-log" \
      --exclude "__pycache__" \
      --exclude "*.pyc" \
      --exclude ".git" \
      "${src}/" "${dest}/"
  else
    rsync -a \
      --exclude "node_modules" \
      --exclude "dist" \
      --exclude "build" \
      --exclude ".env" \
      --exclude ".env.local" \
      --exclude "data/*.db" \
      --exclude "data/*.db-*" \
      --exclude "data/notification-log" \
      --exclude "__pycache__" \
      --exclude "*.pyc" \
      --exclude ".git" \
      "${src}/" "${dest}/"
  fi
  else
    vlog "  cp ${rel}"
    cp "${src}" "${dest}"
  fi
}

log_section "Copying trees into staging"
for rel in codebase/backend codebase/frontend docker scripts; do
  log "→ ${rel}"
  copy_tree "${rel}"
done

log "→ docker-compose.yml"
cp "${ROOT_DIR}/docker-compose.yml" "${PKG_DIR}/docker-compose.yml"

log "→ .env (deployment secrets from docker/.env)"
cp "${ROOT_DIR}/docker/.env" "${PKG_DIR}/.env"

log "→ .env.example (reference only, no secrets)"
cp "${ROOT_DIR}/docker/.env.example" "${PKG_DIR}/.env.example"
cp "${ROOT_DIR}/docker/.env.example" "${PKG_DIR}/docker/.env.example"

chmod -R u+rwX "${PKG_DIR}" || true
chmod +x "${PKG_DIR}/scripts/"*.sh 2>/dev/null || true

cat > "${PKG_DIR}/DEPLOY_README.txt" <<EOF
DCF AI Feedback — Docker package
version=${VERSION} git=${GIT_SHA} built=$(date -u +%Y-%m-%dT%H:%M:%SZ)

Deploy on VM (default install directory /var/www/dcf-feedback):
  sudo mkdir -p /var/www/dcf-feedback
  sudo ./scripts/deploy-docker.sh /path/to/dcf-feedback-docker.zip

Stack: 1 container (nginx UI + Node API). Host port 4020 -> container :80.
Point your existing host nginx at http://127.0.0.1:4020/dcffeedback/

URL path prefix (relative, not a hostname):
  APP_BASE_PATH=/dcffeedback
  APP_HTTP_PORT=4020

Local smoke URLs on the VM:
  http://127.0.0.1:4020/dcffeedback/
  http://127.0.0.1:4020/dcffeedback/v1/health

This package includes .env with HF_API_TOKEN preconfigured.
EOF

log_section "Staging verification"
for rel in docker-compose.yml .env .env.example docker/.env.example docker/nginx.conf docker/nginx-app.conf.template docker/Dockerfile.app docker/start.sh; do
  if [[ -f "${PKG_DIR}/${rel}" ]]; then
    log "  OK staged ${rel}"
  else
    echo "ERROR: missing staged ${rel}" >&2
    exit 1
  fi
done

if [[ "${VERBOSE}" -eq 1 ]]; then
  log_section "Staging directory tree (top level)"
  ls -la "${PKG_DIR}"
  log_section "Staging sizes"
  du -sh "${PKG_DIR}"/* 2>/dev/null | while read -r line; do vlog "  ${line}"; done
  STAGED_FILES="$(find "${PKG_DIR}" -type f | wc -l | tr -d ' ')"
  STAGED_BYTES="$(du -sk "${PKG_DIR}" | cut -f1)"
  log "Total staged: ${STAGED_FILES} files, ~$((STAGED_BYTES)) KB"

  log_section "All staged files"
  find "${PKG_DIR}" -type f | sort | while read -r f; do
    rel="${f#${PKG_DIR}/}"
    if [[ "${rel}" == ".env" ]] || [[ "${rel}" == "docker/.env" ]]; then
      printf "  %6s  %s (secrets — not listed)\n" "$(wc -c < "$f" | tr -d ' ')" "${rel}"
    else
      printf "  %6s  %s\n" "$(wc -c < "$f" | tr -d ' ')" "${rel}"
    fi
  done
fi

log_section "Creating zip archive"
rm -f "${ARCHIVE_PATH}"
(
  cd "${STAGING}"
  if [[ "${VERBOSE}" -eq 1 ]]; then
    zip -r "${ARCHIVE_PATH}" dcf-feedback \
      -x "*/node_modules/*" \
      -x "*/dist/*" \
      -x "*/build/*" \
      -x "codebase/*/.env" \
      -x "*/.env.local" \
      -x "*/__pycache__/*"
  else
    zip -rq "${ARCHIVE_PATH}" dcf-feedback \
      -x "*/node_modules/*" \
      -x "*/dist/*" \
      -x "*/build/*" \
      -x "codebase/*/.env" \
      -x "*/.env.local" \
      -x "*/__pycache__/*"
  fi
)

ZIP_LIST="$(unzip -l "${ARCHIVE_PATH}")"
if ! grep -Fq ".env.example" <<< "${ZIP_LIST}"; then
  echo "ERROR: archive verification failed — .env.example not in zip" >&2
  exit 1
fi
if ! grep -Fq "dcf-feedback/.env" <<< "${ZIP_LIST}"; then
  echo "ERROR: archive verification failed — deployment .env not in zip" >&2
  exit 1
fi
if ! unzip -p "${ARCHIVE_PATH}" dcf-feedback/.env | grep -qE '^HF_API_TOKEN=hf_'; then
  echo "ERROR: archive .env missing HF_API_TOKEN" >&2
  exit 1
fi
log "  OK   archive contains dcf-feedback/.env with HF_API_TOKEN"

ZIP_FILES="$(echo "${ZIP_LIST}" | tail -1 | awk '{print $2}')"
ZIP_SIZE="$(ls -lh "${ARCHIVE_PATH}" | awk '{print $5}')"

log_section "Archive summary"
log "Created: ${ARCHIVE_PATH}"
log "Size:    ${ZIP_SIZE}"
log "Entries: ${ZIP_FILES} (per zip index)"

if [[ "${VERBOSE}" -eq 1 ]]; then
  log_section "Zip contents"
  echo "${ZIP_LIST}" | tail -n +4 | head -n -2
fi

log_section "Deploy command (on VM)"
log "  sudo mkdir -p /var/www/dcf-feedback"
log "  sudo ./scripts/deploy-docker.sh ${ARCHIVE_PATH}"
