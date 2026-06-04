# Docker configuration (single `app` container)

## Nginx layout (Alpine — use `http.d`, not `conf.d`)

| File | Role |
|------|------|
| `docker/nginx.conf` | Main nginx config; **only** `include /etc/nginx/http.d/*.conf;` |
| `docker/nginx-app.conf.template` | Site template; `start.sh` writes → `/etc/nginx/http.d/default.conf` at runtime |
| `docker/start.sh` | Generates `http.d/default.conf`, removes legacy `conf.d/default.conf`, starts Node + nginx |

Do **not** bind-mount nginx config from the host. Do **not** use `/etc/nginx/conf.d/` (Alpine does not use it by default; old bind-mounts left a directory there and broke nginx).

Removed obsolete files: `docker/nginx-proxy.conf.template` (old 3-container proxy).

## Path / env alignment

| Setting | Example | Used by |
|---------|---------|---------|
| `APP_BASE_PATH` | `/dcffeedback` | Host nginx → `http://127.0.0.1:4020/dcffeedback/` |
| `APP_HTTP_PORT` | `4020` | Host port → container nginx `:80` |
| `VITE_BASE_PATH` | `/dcffeedback/` | Frontend build (trailing slash) |
| `VITE_API_BASE_URL` | `/dcffeedback/v1` | Browser API calls (no trailing slash) |
| `PUBLIC_SURVEY_BASE_URL` | `/dcffeedback/survey` | Survey links from API |
| `PUBLIC_ORIGIN` | _(empty)_ | Optional absolute link prefix |

Inside the container:

- Nginx **:80** (published as host `4020`).
- Express **:8080** (internal).
- `/<base>/v1/*` → `127.0.0.1:8080/v1/*`.
- `/<base>/*` → static SPA.

## Compose

One service: `app` (build `docker/Dockerfile.app`). Volumes:

- `dcf-feedback-data` → `/app/backend/data` only.

After changing `APP_BASE_PATH`, rebuild:

```bash
docker compose build --no-cache && docker compose up -d
```

## Hugging Face

Token is in packaged `.env` (`docker/.env` on build machine). Runtime: `HF_API_TOKEN` or `HUGGINGFACE_API_KEY`.

See `docker/.env.example` for all variables.
