# SQLite Schema and Migration Strategy

## Scope
Local demo persistence for backend-first delivery: auth sessions, form templates, trigger orchestration, dynamic links/survey dispatches, submissions, AI outputs, queue operations, analytics aggregates, admin config, and audit logs.

## Migration order
1. `0001_init.sql` core entities and indexes
2. `0002_views.sql` analytics-friendly views
3. `0003_seed_defaults.sql` runtime config defaults
4. seed execution from `db/seeds/seed_demo.sql`

## Core tables
- `demo_users`: static login identities and roles.
- `auth_sessions`: login/logout session lifecycle for demo auth.
- `form_templates`: versioned per user group.
- `trigger_events`: accepted iFamilyNet event records (idempotency on source event id).
- `form_instances`: generated instance per trigger/template.
- `dynamic_links`: single-use token metadata and consume state.
- `survey_dispatches`: send-survey records with generated custom links for textbox display.
- `submissions`: normalized submission envelopes and idempotency keys.
- `ai_inferences`: provider output per submission.
- `supervisor_queue`: operational queue entries.
- `analytics_daily`: denormalized aggregate cache per day/office/role.
- `admin_config`: key-value runtime settings.
- `audit_events`: immutable action/event stream.
- `export_jobs`: csv/pdf export state.

## Key constraints
- Unique `trigger_events.event_id` to avoid duplicate trigger processing.
- Unique `dynamic_links.token` and consumed flag.
- Unique `submissions.idempotency_key` when provided.
- Foreign-key integrity across instance/submission/inference/queue lifecycle.

## Seed strategy
- Seed static users: `admin`, `supervisor`, `mandated_reporter`, `volunteer`, `attorney`, `foster_parent`.
- Seed starter templates for MR, VOL, ATT, FP, closure workflows.
- Seed minimum config keys: trigger windows, reminder cadence, urgency threshold, AI disclosure toggle.
- Seed UI config keys for landing page switch options and `Next Steps` terminology.
- Seed baseline trigger/form/submission records for demo analytics widgets.

## Operational notes
- Use WAL mode and `synchronous = NORMAL` for better local read/write behavior.
- Treat schema changes as additive in early iterations; avoid destructive migration edits.
- Snapshot and restore with SQLite file copy before large migration changes.
