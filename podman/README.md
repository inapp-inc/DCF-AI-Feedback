# Local Podman deploy

Reusable local stack for this repo. It builds the same single container as `docker/Dockerfile.app`: nginx serves the React UI on port 80, Express listens on 8080 inside the container, SQLite lives on a named volume.

Default URL: **http://127.0.0.1:4020/feedback/**

## Build once, click-to-run later (Podman Desktop)

This is the intended local loop: build a named image onto the Podman machine, then start it from the Desktop UI whenever you want.

```powershell
cd C:\Projects\DCF-AI-Feedback\podman
.\dcf-podman.cmd build
```

`dcf-podman.cmd` runs the PowerShell helper with `-ExecutionPolicy Bypass` for this script only. If you prefer the `.ps1` directly and Windows blocks it, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dcf-podman.ps1 build
```

That creates **`dcf-feedback-app:latest`** (also tagged `localhost/dcf-feedback-app:latest`). It does not start a container.

**Images → Run**

1. Open Podman Desktop (machine must be running).
2. **Images** → `dcf-feedback-app` → **Run**.
3. Set:
   - Container name: `dcf-feedback-app`
   - Port: host **4020** → container **80**
   - Volume: `dcf-feedback-data` → `/app/backend/data`
   - Optional env: `HF_API_TOKEN=hf_...`
4. Start. Open http://127.0.0.1:4020/feedback/

The image already has working defaults (`APP_BASE_PATH=/feedback`, SQLite path, demo scheduler). A Run with only the port mapping is enough for a first demo; the volume keeps the DB across container deletes.

**Play YAML (ports + volume pre-filled)**

1. `.\dcf-podman.cmd build`
2. Podman Desktop → **Kubernetes** → **Play YAML** → `podman/desktop-play.yaml` → Play.

Do not click Run on a half-built image. Wait until `.\dcf-podman.ps1 build` finishes and `.\dcf-podman.ps1 status` lists `dcf-feedback-app`.

## Prerequisites (Windows)

1. Install [Podman Desktop](https://podman-desktop.io/). This repo already sees `podman` 6.x on PATH.
2. Start the WSL machine (it may exist but never have been started):

   ```powershell
   podman machine start
   ```

   Or use the Podman Desktop **Start** button. `podman compose` will not work until the machine is up.
3. First image build needs outbound network access (npm + Alpine packages). The default machine is 2 GiB RAM; if the build is killed while compiling `better-sqlite3`, raise memory in Podman Desktop → Settings → Resources, then `podman machine stop` / `start`.

Optional: a Hugging Face token if you want live LLM classification/reports. Without it the app still runs and uses fallback heuristics.

## First run

From PowerShell:

```powershell
cd C:\Projects\DCF-AI-Feedback\podman
.\dcf-podman.ps1 up
```

What that does:

1. Starts the Podman machine if it is not running.
2. Creates `podman/.env` from `docker/.env` when that file exists, otherwise from `.env.example`.
3. Builds `dcf-feedback-app:latest` from `docker/Dockerfile.app` (same image Desktop can Run).
4. Starts `dcf-feedback-app` on host port **4020**.
5. Waits for `GET /feedback/v1/health`.

Edit `podman/.env` after the first copy if you need to add `HF_API_TOKEN`. Then run `.\dcf-podman.ps1 up` again (no rebuild needed for token-only changes).

macOS / Linux / WSL:

```bash
cd podman
chmod +x dcf-podman.sh
./dcf-podman.sh up
```

## Daily commands

| Task | Windows | Unix |
|------|---------|------|
| Build image only (Desktop click-to-run) | `.\dcf-podman.cmd build` | `./dcf-podman.sh build` |
| Start (build if needed) | `.\dcf-podman.cmd up` | `./dcf-podman.sh up` |
| Start without rebuild | `.\dcf-podman.cmd up -NoBuild` | `./dcf-podman.sh up --no-build` |
| Stop (keep SQLite) | `.\dcf-podman.cmd down` | `./dcf-podman.sh down` |
| Follow logs | `.\dcf-podman.cmd logs -Follow` | `./dcf-podman.sh logs --follow` |
| Status | `.\dcf-podman.cmd status` | `./dcf-podman.sh status` |
| Rebuild image | `.\dcf-podman.cmd rebuild` | `./dcf-podman.sh rebuild` |
| Wipe DB and re-seed | `.\dcf-podman.cmd reset` | `./dcf-podman.sh reset` |

Equivalent raw run (from this folder; Compose is not required):

```powershell
podman run -d --name dcf-feedback-app --replace -p 4020:80 --env-file .env -v dcf-feedback-data:/app/backend/data --restart unless-stopped localhost/dcf-feedback-app:latest
podman rm -f dcf-feedback-app
```

## URLs and demo logins

| Surface | URL |
|---------|-----|
| UI | http://127.0.0.1:4020/feedback/ |
| API health | http://127.0.0.1:4020/feedback/v1/health |
| Partner portal | http://127.0.0.1:4020/feedback/portal |

Password for seeded users: `demo`

| Username | Role |
|----------|------|
| `admin_demo` | admin |
| `supervisor_demo` | supervisor |
| `mr_demo` | mandated_reporter |

On first container start, `docker/start.sh` runs migrate + seed against the SQLite volume.

## Configuration

All runtime keys live in `podman/.env` (gitignored). Template: `.env.example`.

| Key | Purpose |
|-----|---------|
| `APP_HTTP_PORT` | Host port (default `4020`) |
| `APP_BASE_PATH` | URL prefix (`/feedback`) |
| `VITE_BASE_PATH` / `VITE_API_BASE_URL` | Baked into the frontend **at image build time** |
| `DATABASE_URL` | SQLite path inside the container |
| `HF_API_TOKEN` or `HUGGINGFACE_API_KEY` | Live Hugging Face inference |

After changing `APP_BASE_PATH` or any `VITE_*` value, keep the four path keys in sync and rebuild:

```
APP_BASE_PATH=/feedback
VITE_BASE_PATH=/feedback/
VITE_API_BASE_URL=/feedback/v1
PUBLIC_SURVEY_BASE_URL=/feedback/survey
```

```powershell
.\dcf-podman.ps1 rebuild
```

Nginx / path rules are documented in `docker/CONFIG.md`. Do not bind-mount nginx config from the host.

## What is reused vs what is local

| Item | Location |
|------|----------|
| Image build | `docker/Dockerfile.app` |
| Nginx + start | `docker/nginx.conf`, `docker/nginx-app.conf.template`, `docker/start.sh` |
| Image tags | `dcf-feedback-app:latest`, `localhost/dcf-feedback-app:latest` |
| Desktop Play YAML | `desktop-play.yaml` |
| Local Compose + helpers | this folder |
| Persistent SQLite | volume `dcf-feedback-data` → `/app/backend/data` |

This folder does **not** replace the VM zip flow (`scripts/package-docker.sh` + `scripts/deploy-docker.sh`). Use that for the packaged Docker deploy; use this folder for a repeatable local Podman run from the repo.

## Troubleshooting

**`running scripts is disabled on this system`**  
Windows ExecutionPolicy is blocking `.ps1` files. Use `.\dcf-podman.cmd build` (does not change the policy), or:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dcf-podman.ps1 build
```

To allow local scripts for your user account only: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**`podman` is not recognized**  
Install Podman Desktop, then open a new terminal. `podman --version` must work.

**`./start.sh not found`**  
The image was built on Windows with CRLF in `docker/start.sh`. Alpine reports that as "not found". Rebuild after the Dockerfile fix (`ENTRYPOINT ["/bin/sh", "/start.sh"]` plus strip `\\r`):

```powershell
.\dcf-podman.cmd build
.\dcf-podman.cmd up -NoBuild
```

In Podman Desktop Run, leave **Command** empty so the image entrypoint is used. Do not set `./start.sh`.

**`looking up compose provider failed`**  
You do not need Compose. `.\dcf-podman.cmd up -NoBuild` uses `podman run` on `localhost/dcf-feedback-app:latest`. `compose.yml` is optional if you later install the Compose plugin in Podman Desktop.

**Machine not running / `Cannot connect to Podman socket`**  
`podman-machine-default` is a WSL VM. Start it with `podman machine start` or the Desktop UI. `.\dcf-podman.ps1 up` tries this automatically. Confirm with `podman machine list` (`LAST UP` should be a timestamp, not `Never`).

**Port 4020 already in use**  
Change `APP_HTTP_PORT` in `podman/.env` and run `.\dcf-podman.ps1 up -NoBuild`.

**UI 404 at `/` but works at `/feedback/`**  
Expected. The production-like prefix is `/feedback`. Open the URL printed by `.\dcf-podman.ps1 urls`.

**AI features look canned**  
`HF_API_TOKEN` is empty or the provider is unreachable. The API health endpoint stays `ok`; check `/feedback/v1/ai/health` after login-backed admin calls, or add a token and recreate:

```powershell
.\dcf-podman.ps1 up -NoBuild
```

**Need a clean demo database**  
`.\dcf-podman.ps1 reset` deletes the named volume. Start.sh will migrate and seed again.

**Build is slow the first time**  
`better-sqlite3` compiles native code in Alpine. Later `build` / `up` / Desktop Run reuse `dcf-feedback-app:latest`.

**Image missing in Podman Desktop**  
The Desktop UI lists images on the running machine. Start the machine, then `.\dcf-podman.ps1 build`. Refresh the Images view.
