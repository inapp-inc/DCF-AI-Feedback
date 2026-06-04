# AI Wiring Evidence Checklist

## Backend checks
- `cd codebase/backend && npm run migrate`
- `cd codebase/backend && npm run seed`
- `cd codebase/backend && npm run build`
- `cd codebase/backend && npm run test:all`
- `cd codebase/backend && npm run verify:ai`

Expected outputs:
- submission is created and processed
- AI result includes `confidence`, `latencyMs`, `fallbackUsed`, and `recommendedRoute`
- legal-sensitive text routes to policy/supervisor queue
- `/v1/ai/health` returns `up|degraded|down`

## Frontend checks
- `cd codebase/frontend && npm run build`
- `cd codebase/frontend && npm run test:e2e`

Manual flow checks:
1. Login -> landing page switcher works.
2. iFamilyNet:
   - `Send Survey` generates custom links for trigger cards.
   - `Submit Demo Response` shows lifecycle (`queued`, `inferencing`, `ready|degraded|failed`).
   - AI result card shows explainability, confidence, model, fallback indicator.
3. Admin:
   - KPI cards load.
   - anomaly workbench list appears.
   - model health panel appears.
   - queue actions and config update actions return notices.

## Contract checks
- Ensure updated payload fields from API are consumed by UI:
  - `GET /submissions/{id}/ai-result`
  - `GET /ai/health`
  - `GET /ai/ops/health`
  - `GET /analytics/anomalies`

## Latest run evidence (2026-06-02)
- `npm run test:foundation` -> passed
- `npm run test:processing` -> passed
- `npm run test:analytics` -> passed
- `npm run verify:ai` -> route `legal_policy_queue`, fallback recorded, health surfaced as `down` during endpoint outage simulation
- `npm run test:e2e` -> 2/2 passed (login -> landing -> iFamilyNet, login -> landing -> admin)
