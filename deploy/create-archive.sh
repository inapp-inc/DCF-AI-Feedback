#!/usr/bin/env bash
# Stage a deploy folder for Ubuntu + PM2. Zip the contents yourself.
# Output: dist/dcf-feedback-staging/
# Run from repo root: ./deploy/create-archive.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING="${ROOT}/dist/dcf-feedback-staging"
INSTALL_ROOT="/var/www/dcf-feedback"

cd "${ROOT}"

echo "==> Staging files to ${STAGING}"
rm -rf "${STAGING}"
mkdir -p "${STAGING}"

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "${dest}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude 'node_modules' \
      --exclude 'dist' \
      --exclude '.env' \
      --exclude '.env.local' \
      --exclude '*.db' \
      --exclude '*.db-wal' \
      --exclude '*.db-shm' \
      --exclude 'data/*.db' \
      --exclude '.vite' \
      --exclude 'coverage' \
      --exclude 'logs' \
      "${src}/" "${dest}/"
  else
    tar -C "${src}" \
      --exclude=node_modules \
      --exclude=dist \
      --exclude=.env \
      --exclude=.env.local \
      --exclude='*.db' \
      --exclude='*.db-wal' \
      --exclude='*.db-shm' \
      --exclude=coverage \
      --exclude=logs \
      -cf - . | tar -C "${dest}" -xf -
  fi
}

copy_tree "${ROOT}/codebase/backend" "${STAGING}/codebase/backend"
copy_tree "${ROOT}/codebase/frontend" "${STAGING}/codebase/frontend"
copy_tree "${ROOT}/deploy" "${STAGING}/deploy"

cp "${ROOT}/start.sh" "${STAGING}/"
cp "${ROOT}/run-production.sh" "${STAGING}/"
cp "${ROOT}/README-SERVER.txt" "${STAGING}/"
if [[ -f "${ROOT}/Docs/DEPLOY-RUNBOOK.md" ]]; then
  mkdir -p "${STAGING}/Docs"
  cp "${ROOT}/Docs/DEPLOY-RUNBOOK.md" "${STAGING}/Docs/"
fi
if [[ -f "${ROOT}/.gitattributes" ]]; then
  cp "${ROOT}/.gitattributes" "${STAGING}/"
fi

mkdir -p "${STAGING}/data" "${STAGING}/logs" "${STAGING}/codebase/backend/data"

if [[ -f "${ROOT}/deploy/.env" ]]; then
  cp "${ROOT}/deploy/.env" "${STAGING}/deploy/.env"
else
  cp "${ROOT}/deploy/.env.example" "${STAGING}/deploy/.env"
fi
# shellcheck source=deploy/fill-env.sh
source "${ROOT}/deploy/fill-env.sh"
ENV_FILE="${STAGING}/deploy/.env" FILL_ENV_REQUIRED=1 fill_deploy_env

chmod +x \
  "${STAGING}/start.sh" \
  "${STAGING}/run-production.sh" \
  "${STAGING}/deploy/deploy-pm2.sh" \
  "${STAGING}/deploy/configure-nginx.sh" \
  "${STAGING}/deploy/create-archive.sh" \
  "${STAGING}/deploy/fill-env.sh" \
  2>/dev/null || true

echo "==> Normalizing staged shell scripts to LF"
normalize_lf() {
  local py=""
  if command -v python >/dev/null 2>&1; then
    py="python"
  elif command -v python3 >/dev/null 2>&1; then
    py="python3"
  elif command -v py >/dev/null 2>&1; then
    py="py -3"
  fi
  if [[ -z "$py" ]]; then
    echo "    Warning: python not found; shell scripts may keep CRLF" >&2
    return 0
  fi
  # shellcheck disable=SC2086
  $py - "${STAGING}" <<'PY'
import os
import sys

root = sys.argv[1]
exts = {".sh", ".bash", ".cjs"}
changed = 0
for dirpath, _, files in os.walk(root):
    for name in files:
        _, ext = os.path.splitext(name)
        if ext.lower() not in exts:
            continue
        path = os.path.join(dirpath, name)
        with open(path, "rb") as fh:
            data = fh.read()
        converted = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        if converted != data:
            with open(path, "wb") as fh:
                fh.write(converted)
            changed += 1
print(f"    converted {changed} file(s) to LF")
PY
}
normalize_lf

echo ""
echo "Done: ${STAGING}"
du -sh "${STAGING}" 2>/dev/null || ls -ld "${STAGING}"
cat <<EOF

Next steps (on your machine):
  1. Zip the contents of dist/dcf-feedback-staging/ (not the parent dist folder).
  2. Copy the zip to the Ubuntu server.

On the server:
  sudo mkdir -p ${INSTALL_ROOT}
  sudo unzip -o your-archive.zip -d ${INSTALL_ROOT}
  cd ${INSTALL_ROOT}
  sudo bash start.sh

That builds the SPA + API, seeds SQLite, fills deploy/.env (HF token from
this machine), and starts dcf-feedback-api under PM2.
See README-SERVER.txt in the staged folder.

EOF
