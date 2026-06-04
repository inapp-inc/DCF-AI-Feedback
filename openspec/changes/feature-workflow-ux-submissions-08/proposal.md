# Proposal: feature-workflow-ux-submissions-08

## Why

Four gaps were identified after the initial approval workflow and demo build:

1. **No administrative audit view.** Admins and supervisors had no way to inspect the full history of submitted surveys — their approval stage, resolution notes, urgency, and sentiment — in one place. Without this, quality assurance and compliance review required direct database queries.

2. **Attorney workflow was legally backwards.** Attorney feedback was routed directly to the legal team before the supervisor had any awareness of it. The intended flow is supervisor-first: the supervisor reads the feedback and decides whether escalation to legal is warranted. Legal is a gated, discretionary step, not the automatic first stop.

3. **Likert scale lacked perceptual clarity.** The red-to-green colour coding built into `LIKERT_OPTIONS` was only applied when an option was selected. Before interaction the buttons appeared uniformly neutral, making it impossible to visually understand the scale at a glance.

4. **Attorney milestone buttons shared a single loading key.** Clicking "Send Survey" on either attorney legal milestone row caused both rows to show "Sending…" / "Survey sent ✓" simultaneously, because both buttons referenced the same trigger key (`att`). Similarly, while any one survey was sending, all other buttons across the platform were disabled even though they are independent operations.

## What

- Add a **Submissions History** tab (admin-only) to `AdminPage` showing all submitted surveys with approval trail, AI scores, and filter controls for user group and approval status.
- Rewire the **attorney approval workflow**: all submissions (including attorney) start at `pending_supervisor`. Supervisors can optionally flag attorney submissions for legal review (`pending_legal`). Legal resolves and returns to `pending_supervisor` for the supervisor's final approval before publishing to analytics.
- Apply **Likert color tinting** to every option at rest (subtle red/amber/green tint proportional to the option's value colour) so the scale is self-evident before any selection.
- Replace the shared `att` trigger key with **per-row trigger keys** (`att-spr`, `att-dp`) for the two attorney legal milestone rows, and update all `disabled` guards platform-wide from `sendingKey !== null` to `sendingKey === triggerKey` so each button is fully independent.

## Non-goals

- Changes to LLM model selection, token budgets, or chatbot guardrails.
- New form templates or changes to existing form schemas.
- Changes to authentication or role definitions.
- Production-grade pagination or database indexing on the submissions history view (demo SQLite scope).
