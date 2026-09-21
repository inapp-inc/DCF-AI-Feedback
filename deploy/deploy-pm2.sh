#!/usr/bin/env bash
# DCF Feedback — bare-metal deploy with PM2 (no Docker)
#
# Usage (from install root):
#   cp deploy/.env.example deploy/.env
#   chmod +x deploy/deploy-pm2.sh
#   ./deploy/deploy-pm2.sh --install-system-deps
#   ./deploy/deploy-pm2.sh
#   ./deploy/deploy-pm2.sh --no-build --no-seed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/run-production.sh" --pm2 "$@"
