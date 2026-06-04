#!/bin/sh
set -e

# Alpine nginx uses http.d — never write to conf.d (old bind-mounts often leave a directory there).
APP_BASE="${APP_BASE_PATH:-/dcffeedback}"
APP_BASE="${APP_BASE%/}"
if [ -z "${APP_BASE}" ] || [ "${APP_BASE}" = "/" ]; then
  APP_BASE="/dcffeedback"
fi

# Remove legacy broken mount: host bind-mount could create default.conf as a directory.
rm -rf /etc/nginx/conf.d/default.conf 2>/dev/null || true

mkdir -p /etc/nginx/http.d
sed "s|__APP_BASE__|${APP_BASE}|g" /etc/nginx/nginx-app.conf.template > /etc/nginx/http.d/default.conf

nginx -t

cd /app/backend
node dist/db/migrate.js
node dist/db/seed.js
node dist/index.js &

exec nginx -g "daemon off;"
