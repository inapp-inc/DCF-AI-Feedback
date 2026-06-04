# Demo Architecture Decisions (Closeout)

This document closes architecture-level pending decisions for the local demo implementation.

## Legal attestation for attorney submissions
- Attorney-role submissions require an explicit attestation checkbox at submit time.
- Attestation statement (v1): "I attest this submission is accurate to the best of my professional knowledge and complies with agency policy."
- API contract requirement: attorney submissions without attestation are rejected with `400`.
- Evidence captured: `attested=true|false`, `attestationVersion`, `submittedBy`, `submittedAt`.

## Retention and suppression policy (demo baseline)
- Raw submission payload retention: 90 days.
- AI inference metadata retention: 180 days.
- Audit logs retention: 365 days.
- Analytics suppression: values under 5 are grouped into `other` or redacted in public dashboards.
- Retention endpoint remains dry-run by default for demo safety.

## Audit taxonomy and SIEM forwarding format
- Event classes: `auth`, `survey`, `submission`, `ai_inference`, `queue`, `analytics`, `config`, `export`, `compliance`.
- Common fields: `eventId`, `eventClass`, `eventType`, `actorId`, `actorRole`, `resourceId`, `resourceType`, `timestamp`, `result`, `details`.
- Forwarding format: newline-delimited JSON (NDJSON) with UTC timestamps and stable keys.
- Transport profile (phase 1): local file sink + optional HTTPS shipper adapter.

## SLOs by key path
- Trigger intake (`/triggers/events`): p95 <= 300ms, p99 <= 600ms.
- Survey submit + route (`/surveys/{id}/submit`): p95 <= 1.8s, p99 <= 3.5s (excluding upstream provider incidents).
- AI result read (`/submissions/{id}/ai-result`): p95 <= 200ms, p99 <= 500ms.
- Dashboard KPI/trend reads (`/analytics/*`): p95 <= 400ms, p99 <= 900ms.

## Phase 1 capacity assumptions
- Daily submissions: 1,000 baseline, burst 3,000.
- Concurrent active admins: 25.
- Concurrent survey respondents: 120.
- Queue growth tolerance before alert: 500 unresolved items.
- Database size planning: 1 year demo data <= 5 GB on SQLite.

## Review gate note
- Architecture and OpenAPI reviewed against implemented backend/frontend slices and test evidence on 2026-06-02.
- Status: approved for demo execution; production hardening review remains a future gate.
