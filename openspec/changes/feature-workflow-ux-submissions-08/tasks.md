# Tasks: feature-workflow-ux-submissions-08

## Change 1 — Submissions history tab

### Backend
- [x] Add `GET /analytics/submissions-history` endpoint to `codebase/backend/src/routes/admin.ts` with `requireRoles("admin", "supervisor")` guard.
- [x] Implement query joining `submissions`, `ai_inferences`, and a correlated `submission_approvals` subquery returning `json_group_array` approval history.
- [x] Support `userGroup`, `status`, and `limit` (max 500) query parameters with safe parameterised SQL.
- [x] Map result rows to a typed response object including `approvalHistory` parsed from JSON.

### Frontend — API client
- [x] Add `SubmissionHistoryItem` type to `codebase/frontend/src/api/client.ts`.
- [x] Add `listSubmissionsHistory(params?)` function calling the new endpoint with URLSearchParams encoding.

### Frontend — AdminPage
- [x] Add `"submissions"` to the `Tab` union type.
- [x] Add `"submissions"` to `allowedTabs` return for `"admin"` role.
- [x] Add `{ id: "submissions", label: "Submissions" }` entry to the `allTabs` array.
- [x] Add `submissionsHistory`, `submissionsLoading`, `subHistUserGroup`, `subHistStatus` state variables.
- [x] Implement `loadSubmissionsHistory(userGroup?, status?)` async function.
- [x] Add `useEffect` to call `loadSubmissionsHistory` when `tab === "submissions"`.
- [x] Render submissions tab JSX: toolbar with group filter, status filter, and Refresh button; loading/empty states; table with ID, Group, Topic, Submitted, Status pill, Sentiment, Urgency, and Stage trail columns.
- [x] Add `.subhist-toolbar`, `.subhist-filters`, and `.subhist-table` CSS rules to `globals.css`.
- [x] Verify TypeScript compiles clean.

---

## Change 2 — Attorney approval workflow rewire

### Backend
- [x] Remove `attorney` special-case for `initialApprovalStatus` in `codebase/backend/src/services/submissionProcessor.ts`; all submissions default to `pending_supervisor`.
- [x] Add `POST /approval/submissions/:id/flag-legal` endpoint in `codebase/backend/src/routes/approval.ts`: auth guard `requireRoles("admin", "supervisor")`; validate current status is `pending_supervisor`; set status to `pending_legal`; record action `flagged_for_legal`; write audit `approval.supervisor.flagged_legal`.
- [x] Update `POST /approval/submissions/:id/legal-approve` to set `approval_status = 'pending_supervisor'` (not `legal_approved`); record action `legal_resolved`; write audit `approval.legal.resolved`.
- [x] Update `GET /approval/submissions/pending-supervisor` WHERE clause to `approval_status = 'pending_supervisor'` only; add attorney-first ordering.
- [x] Update `POST /approval/submissions/:id/supervisor-approve` allowed-states check to `pending_supervisor` only (remove `legal_approved`).

### Frontend — API client
- [x] Add `flagForLegal(submissionId, note?)` function to `codebase/frontend/src/api/client.ts`.

### Frontend — AdminPage
- [x] Import `flagForLegal` from `client.ts`.
- [x] Add `handleFlagForLegal(submissionId)` async function; calls `flagForLegal`; reloads approvals on success.
- [x] Update `handleLegalApprove` success message to reflect "returned to supervisor" semantics.
- [x] In supervisor card rendering: derive `legalResolved` from `approvalHistory` containing `legal_resolved` action; derive `isAttorney` from `userGroup`; derive `alreadyFlaggedForLegal` from `flagged_for_legal` action.
- [x] Show amber "Attorney" badge on attorney items not yet through legal.
- [x] Show `⚖ Legal reviewed` badge on items returned from legal.
- [x] Render `⚖ Flag for legal review` button for attorney items not yet through legal; bind to `handleFlagForLegal`.
- [x] Update supervisor section description text.
- [x] Update legal card approve button label to "Resolve — return to supervisor".
- [x] Add `.apv-btn-flag-legal` CSS rule to `globals.css` (amber outline, transparent background).
- [x] Verify TypeScript compiles clean.

---

## Change 3 — Likert colour coding at rest

### Frontend — SurveyFillPage
- [x] Update `.gf-likert-btn` `style` prop: apply `borderColor: ${opt.color}55` and `background: ${opt.color}0d` for unselected; `borderColor: opt.color` and `background: ${opt.color}22` for selected.
- [x] Update `.gf-likert-word` `style` prop: `color: ${opt.color}cc`, `fontWeight: 500` for unselected; `color: opt.color`, `fontWeight: 700` for selected.

### Frontend — globals.css
- [x] Change `.gf-likert-btn` base `border` to `2px solid transparent` (colour applied inline).
- [x] Change `.gf-likert-btn` base `background` to `transparent` (tint applied inline).
- [x] Update `.gf-likert-btn:hover` to use `filter: brightness(1.08)` instead of hardcoded colour overrides.
- [x] Verify no colour conflict with `.gf-likert-btn--selected` specificity.

---

## Change 4 — Core platform per-button state isolation

### Frontend — IFamilyNetPage
- [x] Remove the `att` key from `TRIGGERS`.
- [x] Add `att-spr` entry: `templateId: "tpl_att_v1"`, `userGroup: "attorney"`, `triggerRef: "MA-2026-1182-spr"`.
- [x] Add `att-dp` entry: `templateId: "tpl_att_v1"`, `userGroup: "attorney"`, `triggerRef: "MA-2026-1182-dp"`.
- [x] Update attorney legal milestone table rows to carry a `key` field (`"att-spr"` / `"att-dp"`); pass `row.key` to `handleSendSurvey`, `isSurveyDispatched`, `dispatchedKeys.has`, and the `disabled` prop.
- [x] Update `renderTriggerCard` button `disabled` guard from `sendingKey !== null` to `sendingKey === triggerKey`.
- [x] Update foster parent placement milestone button `disabled` guard from `sendingKey !== null` to `sendingKey === "fp"`.
- [x] Update attorney table button `disabled` guard to `sendingKey === row.key`.
- [x] Update closure section card button `disabled` guard from `sendingKey !== null` to `sendingKey === key`.
- [x] Verify TypeScript compiles clean.
