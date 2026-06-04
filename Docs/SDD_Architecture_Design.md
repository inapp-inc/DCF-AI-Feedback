# SDD Architecture Design Pack

## Stage Status
- Stage: Architecture and design initiated.
- Inputs reviewed: `DCF_AI_Feedback_System_BRD.docx.md`, `ifamilynet.html`.
- Requirement analysis stage intentionally skipped per direction; risk documented below.

## Risk Note (Skipped Requirement Analysis)
- Full questionnaire/FSD stage was bypassed, which may leave unresolved requirement ambiguity.
- Highest-risk unresolved items:
  - legal attestation format for attorney workflows
  - AI opt-out path and downstream processing behavior
  - exact iFamilyNet event payload guarantees and retry semantics

## Design Output Inventory
- OpenSpec source spec: `openspec/specs/feedback-platform/spec.md`
- Change proposal: `openspec/changes/dcf-ai-feedback-architecture-v1/proposal.md`
- Design detail: `openspec/changes/dcf-ai-feedback-architecture-v1/design.md`
- Execution checklist: `openspec/changes/dcf-ai-feedback-architecture-v1/tasks.md`
- Spec delta: `openspec/changes/dcf-ai-feedback-architecture-v1/specs/feedback-platform/spec.md`
- API contract: `openspec/changes/dcf-ai-feedback-architecture-v1/openapi.yaml`

## Design Summary
- Architecture baseline is modular monolith first, with explicit module boundaries and event-driven trigger orchestration.
- Demo stack baseline:
  - local-first runtime (deployment design deferred)
  - SQLite as primary datastore
  - Hugging Face Inference Endpoints for LLM/NLP inference
  - in-page analytics using Chart.js (no external BI dependency for demo)
  - static login credentials for authentication in demo mode
  - frontend includes login/logout and landing switch between iFamilyNet and Admin apps
  - admin app is a dedicated DCF experience for completion tracking, analytics, and survey form configuration
  - Hugging Face runtime defaults aligned to demo config:
    - `LLM_PROVIDER=huggingface`
    - `HF_MODEL=Qwen/Qwen2.5-7B-Instruct`
    - `HF_API_BASE=https://router.huggingface.co/v1`
    - `LLM_REQUEST_TIMEOUT_MS=600000`
    - token alias fallback via `HF_API_TOKEN` or `HUGGINGFACE_API_KEY`
- OpenAPI-first contract defines the core lifecycle:
  - trigger event ingestion
  - survey retrieval and submission
  - AI result retrieval
  - supervisor queue retrieval
  - auth login/logout/session and send-survey custom-link generation
  - admin completion status metrics and template configuration lifecycle
- Security and compliance are built into the design baseline:
  - role-scoped access derived from static demo login profiles
  - privilege tagging path for attorney inputs
  - auditable queue lifecycle
  - PII-safe aggregate reporting model

## Review Gate (SDD Hard Stop)
Design artifacts are ready for review. Per stage-gated SDD, implementation slicing and coding should start only after this design checkpoint is approved.
