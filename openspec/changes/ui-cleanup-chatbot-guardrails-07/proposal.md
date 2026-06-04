# Proposal: ui-cleanup-chatbot-guardrails-07

## Why

Two categories of issues accumulated after the initial demo build:

1. **Internal document artefacts leaked into the UI.** BRD reference codes (MR-01, VOL-01, FP-01, ATT-01, FP-07) and a "BRD ref" column appeared in the Case Workflow page visible to end users. These are internal requirements-traceability identifiers that carry no meaning for respondents or caseworkers and undermine the platform's appearance as a finished product.

2. **The survey assistant chatbot lacked adequate scope enforcement.** The LLM responded to arbitrary out-of-scope queries (e.g. code generation) and still contained organisation-specific branding ("DCF") that had been removed everywhere else in the application. The system prompt did not protect against persuasion-based jailbreak attempts such as conditional bargains ("fill the form in exchange for a Python script"), roleplay requests, claims of authority, or incremental persuasion.

## What

- Remove all BRD/FRD reference codes and the "BRD ref" table column from the Case Workflow (IFamilyNet) page.
- Rewrite the chatbot system prompt welcome message to be generic and organisation-agnostic.
- Replace all "DCF" references in `surveyChatService.ts` with neutral terms ("the agency", "Feedback Analytics Solution platform").
- Add a `STRICT SCOPE BOUNDARY` block and `ANTI-MANIPULATION RULES` block to the chatbot system prompt that unconditionally refuse out-of-scope requests regardless of how they are framed or what is offered.

## Non-goals

- Changes to backend analytics, approval workflow, or form schema.
- Modifications to LLM model selection or token budgets.
- Production SSO or compliance-level content moderation infrastructure.
