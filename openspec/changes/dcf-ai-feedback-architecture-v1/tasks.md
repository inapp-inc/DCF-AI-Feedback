# Tasks: dcf-ai-feedback-architecture-v1

## 1. Foundation and Contracts
- [x] Finalize OpenAPI endpoints and schemas for trigger ingestion, survey lifecycle, AI results, and supervisor actions.
- [x] Define canonical data model mapping from BRD requirement IDs to domain entities.
- [x] Confirm static demo login matrix for all four user groups and admin/supervisor personas.
- [x] Define SQLite schema and migration baseline for local demo.
- [x] Define explicit contract boundaries for two frontend apps: iFamilyNet workflow app and DCF admin app.

## 2. Integration Design
- [x] Define iFamilyNet event payload schema and idempotency strategy.
- [x] Define notification gateway interaction and secure-link token lifecycle.
- [x] Define Hugging Face inference adapter request/response envelopes with explainability metadata.
- [x] Align HF defaults to demo baseline (`LLM_PROVIDER`, `HF_MODEL`, `HF_API_BASE`, `LLM_REQUEST_TIMEOUT_MS`).
- [x] Define HF token alias resolution strategy (`HF_API_TOKEN` and `HUGGINGFACE_API_KEY`).

## 3. Compliance and Governance
- [x] Confirm legal attestation approach for attorney submissions.
- [x] Confirm data retention policy and low-cardinality suppression policy.
- [x] Define audit event taxonomy and SIEM forwarding format.

## 4. Performance and Reliability
- [x] Set SLOs per key path: intake latency, AI processing latency, dashboard query latency.
- [x] Define retry/timeout budgets and fallback behavior for external dependencies.
- [x] Define capacity assumptions for Phase 1 and growth checkpoints.
- [x] Define in-page analytics data contracts and Chart.js rendering plan.
- [x] Define completion-status aggregate contracts (completion rate, pending/overdue, by group/office).
- [x] Define AI health-check contract and degraded-mode behavior for HF inference failures.

## 5. DCF Admin Application Design
- [x] Define admin UX contract for completion monitoring dashboard.
- [x] Define form configuration lifecycle (draft/edit/publish/version rollback) per survey group.
- [x] Define admin authorization boundaries for analytics and configuration actions.

## 6. Review Gate
- [x] Conduct architecture review and approve OpenSpec change + OpenAPI baseline before SEED planning and implementation.
