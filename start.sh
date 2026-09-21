#!/usr/bin/env bash
# Unzip-and-run entry for the DCF Feedback zip (PM2, no Docker).
#
#   sudo unzip -o dcf-feedback-linux.zip -d /var/www/dcf-feedback
#   cd /var/www/dcf-feedback
#   bash start.sh
#
#   bash start.sh --no-seed
#   bash start.sh --seed
#   bash start.sh --no-nginx
#   bash start.sh --no-build --no-seed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env}"

chmod +x "$ROOT/run-production.sh" "$ROOT/deploy/deploy-pm2.sh" "$ROOT/deploy/configure-nginx.sh" 2>/dev/null || true

# shellcheck source=deploy/fill-env.sh
source "$ROOT/deploy/fill-env.sh"

bootstrap_env() {
  mkdir -p "$ROOT/deploy" "$ROOT/data" "$ROOT/logs"
  fill_deploy_env
}

needs_system_deps() {
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  if (( $(node -p "process.versions.node.split('.')[0]") < 20 )); then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

bootstrap_env

CONFIGURE_NGINX=1
PASSTHRU=()
for arg in "$@"; do
  case "$arg" in
    --no-nginx) CONFIGURE_NGINX=0 ;;
    *) PASSTHRU+=("$arg") ;;
  esac
done

ARGS=(--pm2)
if needs_system_deps; then
  ARGS+=(--install-system-deps)
fi
if [[ ${#PASSTHRU[@]} -gt 0 ]]; then
  ARGS+=("${PASSTHRU[@]}")
fi

echo "==> Starting DCF Feedback with PM2"
"$ROOT/run-production.sh" "${ARGS[@]}"

if [[ "$CONFIGURE_NGINX" -eq 1 ]]; then
  echo "==> Configuring nginx reverse proxy..."
  bash "$ROOT/deploy/configure-nginx.sh"
fi
