# Feedback Analytics (Demo)

Local-first feedback platform with SQLite backend, React frontend, and Hugging Face inference integration.

## Quick start

### Backend

```bash
cd codebase/backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

API runs at `http://localhost:8080/v1`.

**Demo logins** (password: `demo` or seed hash):

| Username | Role |
|----------|------|
| admin_demo | admin |
| supervisor_demo | supervisor |
| mr_demo | mandated_reporter |

After login, send header `x-demo-user: <username>` on protected routes.

### Frontend

```bash
cd codebase/frontend
npm install
npm run dev
```

UI at `http://localhost:5173`. Public survey: `/survey/{token}`. Partner portal: `/portal`.

### One-command demo reset

From repo root (API must be stopped or use fresh DB file):

```bash
npm run demo:reset
```

Runs migrate, seed, foundation/processing/analytics tests, attestation check, AI smoke, and report smoke.

## Demo walkthroughs

See [Docs/HANDOVER.md](Docs/HANDOVER.md) for MR journey, FP milestone, and Admin triage scripts.

## Docker deploy (VM)

Single container (`app`): internal nginx uses **`/etc/nginx/http.d/`** (not `conf.d`). Host port **4020** → container **80**.

```bash
./scripts/package-docker.sh dist/dcf-feedback-docker.zip
# On VM:
sudo ./scripts/deploy-docker.sh dist/dcf-feedback-docker.zip
```

Point your host nginx at `http://127.0.0.1:4020/feedback/`. Details: `docker/CONFIG.md`.

## Project layout

- `codebase/backend` — Express + SQLite API
- `codebase/frontend` — React apps (staff workflow + Admin)
- `docker/` — `Dockerfile.app`, `nginx.conf`, `nginx-app.conf.template`, `start.sh`
- `openspec/` — specifications and OpenAPI contract
- `Discovery and Design/` — SEED units and SDD artifacts
- `ifamilynet.html` — reference mockup (do not edit; replicate in frontend code)
