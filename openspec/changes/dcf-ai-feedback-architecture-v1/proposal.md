# Proposal: dcf-ai-feedback-architecture-v1

## Why
- The BRD defines a broad, AI-heavy centralized feedback platform but implementation boundaries and contracts are not yet normalized for execution.
- The mockup (`ifamilynet.html`) confirms concrete interaction triggers and UI behavior that need explicit backend/API contracts.
- A design baseline is required before coding to align security, AI governance, performance, and integration constraints.

## Scope
- Define target architecture for Phase 1 through Phase 4 capability growth.
- Establish API contract skeleton for trigger ingestion, survey operations, AI processing status, and supervisor action queues.
- Define module boundaries for role intake, orchestration, AI pipeline adapter, analytics, compliance, and administration.
- Capture chosen and rejected design patterns and ADR alignment.

## Out of Scope
- Building production integrations.
- Implementing model training pipelines.
- Creating final UI/UX artifacts beyond contract implications from the provided mockup.

## Risk Acknowledgment
Requirements questionnaire and FSD stage are intentionally skipped per user direction. This increases risk of latent requirement ambiguity (notably legal attestation format, opt-out flow, and iFamilyNet hook payloads) and must be resolved during design review before implementation.
