# Ubuntu + PM2 + nginx deploy runbook (DCF Feedback)

Filled from `C:\Projects\docs\pm2-ubuntu-deploy-runbook.md`. Procedure matches that generic runbook. **No Docker.** Nginx terminates TLS. PM2 keeps the API on loopback and serves the built SPA.

---

## 0. Config

| Key | Value | Notes |
|---|---|---|
| `<APP_NAME>` | `dcf-feedback` | Process prefix, log files, nginx snippet |
| `<INSTALL_ROOT>` | `/var/www/dcf-feedback` | Flattened extract path |
| `<ARCHIVE_NAME>` | `dcf-feedback-linux.zip` | Zip of `dist/dcf-feedback-staging/` contents |
| `<STAGING_DIR>` | `dist/dcf-feedback-staging` | Created by `deploy/create-archive.sh` |
| `<PUBLIC_HOST>` | `client-demo.inapp.com` | Shared demo hostname |
| `<PUBLIC_SCHEME>` | `https` | |
| `<NODE_MAJOR>` | `20` | |
| `<BIND_HOST>` | `127.0.0.1` | nginx on the same host |
| `<ENV_FILE>` | `deploy/.env` | From `deploy/.env.example` on first run |
| `<SECRETS>` | `HF_API_TOKEN` | Filled by `create-archive.sh` / `start.sh` from gitignored `.env` files; optional at runtime (empty ⇒ heuristic AI) |
| `<DB>` | SQLite `<INSTALL_ROOT>/data/feedback.db` | **fork, 1 instance** |
| `<SSL_CERTIFICATE>` | `/etc/ssl/inapp/SSL/inapp.com.pem` | Shared inapp cert |
| `<SSL_CERTIFICATE_KEY>` | `/etc/ssl/inapp/SSL/inapp.com.key` | |
| `<NGINX_STRATEGY>` | `snippet` | Include into existing 443 vhost; do not replace `/` or `/fostercare/` |
| `<NGINX_SNIPPET>` | `/etc/nginx/snippets/dcf-feedback.conf` | |
| `<START_SCRIPT>` | `start.sh` | |
| `<ECOSYSTEM>` | `deploy/ecosystem.config.cjs` | |

### Processes

| PM2 name | Script | Port | URL prefix | Memory cap |
|---|---|---|---|---|
| `dcf-feedback-api` | `codebase/backend/dist/index.js` | `14020` | `/feedback/` | `512M` |

Public URL: `https://client-demo.inapp.com/feedback/`

Health URL: `http://127.0.0.1:14020/feedback/v1/health`

Port **14020** avoids Foster Care (`11101`/`11102`) and the old Docker host map (`4020`).

---

## 1. What you are installing

```text
Internet → nginx (:80/:443, TLS) → 127.0.0.1:14020 (PM2) → Express API + SPA
```

- App listens on **127.0.0.1** only.
- PM2 **fork**, **one instance** (SQLite).
- First-run may install Node, build tools, and `pm2`.

---

## 2. Repo contract

| Path | Role |
|---|---|
| `start.sh` | First-run: env, deps, build, seed, PM2, optional nginx |
| `run-production.sh` | Build + start; `--pm2` is the production path |
| `deploy/ecosystem.config.cjs` | PM2 process list; loads `deploy/.env` |
| `deploy/.env.example` | Template; no real secrets |
| `deploy/configure-nginx.sh` | Write snippet; `nginx -t`; reload |
| `README-SERVER.txt` | Copy / unzip / run |
| `.gitattributes` | `*.sh` / `*.cjs` LF |

`start.sh` flags: `--no-nginx`, `--no-seed`, `--no-build`, `--seed`, `--install-system-deps`.

---

## 3. Package on the build machine

```bash
# from repo root (Git Bash / WSL / Linux)
./deploy/create-archive.sh
```

Then zip the **contents** of `dist/dcf-feedback-staging/` (not `dist/`). Do not commit the zip. Stage script converts `*.sh` / `*.cjs` to LF.

---

## 4. First install on Ubuntu

```bash
sudo mkdir -p /var/www/dcf-feedback
sudo unzip -o dcf-feedback-linux.zip -d /var/www/dcf-feedback
cd /var/www/dcf-feedback
sudo bash start.sh
pm2 save
pm2 startup
```

```bash
pm2 status
curl -sf http://127.0.0.1:14020/feedback/v1/health
```

---

## 5. Nginx (`snippet`)

Writes `/etc/nginx/snippets/dcf-feedback.conf` (`location /feedback/` → `http://127.0.0.1:14020/feedback/`). Inserts `include` into the existing `listen 443` server for `PUBLIC_HOST` if that site file exists. Does **not** replace `location /` or `/fostercare/`.

---

## 6. Updates

```bash
pm2 delete dcf-feedback-api
sudo unzip -o dcf-feedback-linux.zip -d /var/www/dcf-feedback
cd /var/www/dcf-feedback
sudo bash start.sh --no-nginx --no-seed
pm2 save
```

| Situation | Command |
|---|---|
| Code only, keep DB and nginx | `--no-nginx --no-seed` |
| Reset demo data | `--seed` |
| Cert / host / port / path change | `start.sh` **without** `--no-nginx` |

---

## 7. Day-to-day

```bash
cd /var/www/dcf-feedback
pm2 status
pm2 logs dcf-feedback-api --lines 200
pm2 restart dcf-feedback-api
```

Demo logins (password `demo`): `admin_demo`, `supervisor_demo`, `mr_demo`.
