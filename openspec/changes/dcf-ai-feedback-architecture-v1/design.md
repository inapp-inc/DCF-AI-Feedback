# Design: dcf-ai-feedback-architecture-v1

## Inputs
- `DCF_AI_Feedback_System_BRD.docx.md`
- `ifamilynet.html` (annotated with BRD requirement references and trigger behavior)
- Platform governance from `system-prompts-skills/architecture-adr/`

## Architecture Overview
Adopt a modular monolith core (Node/Express + React) as the system of record for a local-first demo. Use SQLite as the primary datastore, with capability adapters for Hugging Face inference endpoints and in-page Chart.js analytics. Keep explicit domain boundaries to allow future service extraction under ADR governance.

Frontend is split into two applications sharing the same backend contract:
- `ifamilynet-app`: workflow-facing interface that mirrors the provided mockup experience.
- `dcf-admin-app`: admin interface focused on completion tracking, analytics, and form configuration.

UI implementation baseline is adapted from `/Users/mahalingam/Downloads/DCF-Intake/demo`:
- tokenized palette families (navy/teal/coral/amber/green + pale variants)
- `Outfit` typography baseline
- card/chip/input/button/nav state semantics from demo global styles

### Core Modules
- `identity-access`: static login profile mapping to role-scoped route guards for demo mode.
- `trigger-orchestrator`: iFamilyNet event ingestion, trigger window scheduling, idempotent dispatch.
- `feedback-intake`: form lifecycle, token issuance/validation, response submission constraints.
- `ai-processing-adapter`: NLP classification/sentiment/urgency calls, privilege tagging hooks, explainability payloads.
- `supervisor-actions`: queue creation, status transitions, escalation ownership.
- `reporting-governance`: aggregate metrics, export generation, local analytics projections for Chart.js widgets.
- `admin-form-config`: template versioning, question/step configuration, and publish controls for each survey group.
- `audit-compliance`: immutable event logs, SIEM export feed, PII redaction checks.

### Integration Boundaries
- iFamilyNet integration is inbound-event and reference-data read only (no write-back).
- Notification gateway handles secure link dispatch and reminders.
- AI services are consumed via Hugging Face Inference Endpoints through explicit adapter interfaces.
- Hugging Face adapter must follow demo HF runtime baseline:
  - provider default `huggingface`
  - model default `Qwen/Qwen2.5-7B-Instruct`
  - API base default `https://router.huggingface.co/v1`
  - timeout default `600000ms`
  - token fallback order `HF_API_TOKEN` then `HUGGINGFACE_API_KEY`
  - retry/backoff and health-check semantics for degraded/down states
- Dashboard analytics are computed in-app and rendered with Chart.js from aggregated read models.
- Deployment topology is deferred; design currently targets local execution first.
- Admin application consumes completion/analytics endpoints and template config endpoints only through OpenAPI contracts.

## Data and Contracts
- Canonical entities: `TriggerEvent`, `SurveyTemplate`, `SurveyInstance`, `FeedbackSubmission`, `AiInference`, `SupervisorQueueItem`, `AuditEvent`.
- Keys and linkages:
  - Mandated Reporter: `filingId`
  - Volunteer: `eventId`
  - Attorney: `caseId` + `milestoneId`
  - Foster Parent: `placementId` + milestone marker
- Privacy model:
  - PII classified at intake.
  - Aggregated analytics views redact or suppress low-cardinality slices.
  - Attorney submissions carry privilege tags before shared analytics projection.

## API Contract
OpenAPI contract is defined in `openspec/changes/dcf-ai-feedback-architecture-v1/openapi.yaml` and is the source of truth for FE/BE implementation.

## Patterns Considered
- **Architecture style considered**: Layered / Modular monolith / Microservices / Hexagonal / Clean / DDD / EDA
  - **Chosen**: Layered modular monolith + event-driven orchestration + ports/adapters for external dependencies.
  - **Rejected**: Full microservices now (premature operational overhead and schema coordination risk).
- **Integration**: OpenAPI-first / BFF / Gateway / ACL
  - **Chosen**: OpenAPI-first + ACL around iFamilyNet and Hugging Face payloads.
  - **Rejected**: Dedicated gateway as first step (not yet justified by service topology).
- **Aggregation/composition**: Aggregator
  - **Chosen**: Dashboard aggregation endpoints for supervisor/admin views.
  - **Rejected**: Client-side multi-fetch composition (would increase policy drift risk).
- **Data & consistency**: Repository/UoW / CQRS / Event sourcing / Saga / Outbox / Idempotency / Optimistic concurrency
  - **Chosen**: Repository + idempotency keys + transactional outbox for trigger dispatch and queue events.
  - **Rejected**: Event sourcing and Saga initially (unnecessary complexity for Phase 1 baseline).
- **Reliability**: Retries / Timeouts / Circuit breaker / Bulkheads / Rate limits
  - **Chosen**: Retries with jitter for external calls, strict timeout budgets, rate limiting at intake edge.
  - **Rejected**: Bulkhead/circuit breaker as explicit platform components in phase 1 (monitor first, then harden if needed).
- **Security**: RBAC/ABAC / Tenant isolation / Defense in depth
  - **Chosen**: Static role-profile auth for demo mode, defense in depth controls, fine-grained row-level authorization for restricted records.
  - **Rejected**: Full ABAC policy engine initially (can be introduced if legal/compliance requires contextual policies).

## ADR Alignment
- ADR-0001/0002: modular core with extensibility.
- ADR-0004: bounded data ownership and persistence governance.
- ADR-0005: event-driven workflows for trigger and queue lifecycle.
- ADR-0006: security, identity, and isolation controls.
- ADR-0007: observability and auditability as first-class requirements.
- ADR-0009: API-first versioned contract discipline.
- ADR-0011/0012: progressive scaling and configuration-first operational controls.
- ADR-0013: compliance, retention, and governance controls.
- ADR-0017: any deviation handled as governed exception.

## Open Risks and Clarifications
- Legal attestation modality remains unresolved (signature vs attestation statement).
- AI opt-out UX and processing path needs legal/compliance confirmation.
- Exact iFamilyNet event payload contracts and delivery guarantees are pending.
- Static credentials are demo-only and must be replaced with enterprise SSO before production.
- SQLite is suitable for demo/local validation; production persistence strategy remains to be defined.
