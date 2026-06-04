# Design: feature-workflow-ux-submissions-08

## Change 1 — Submissions history tab (admin)

### Files affected
- `codebase/backend/src/routes/admin.ts`
- `codebase/frontend/src/api/client.ts`
- `codebase/frontend/src/pages/AdminPage.tsx`
- `codebase/frontend/src/styles/globals.css`

### Technical approach

**Backend — new endpoint `GET /analytics/submissions-history`:**
- Access control: `requireRoles("admin", "supervisor")`.
- Accepts optional query parameters: `userGroup`, `status`, `limit` (capped at 500; defaults to 100).
- Joins `submissions` with `ai_inferences` and a correlated subquery on `submission_approvals` to produce a flat row per submission containing: `submission_id`, `user_group`, `approval_status`, `submitted_at`, `office_id`, `topic`, `sentiment_score`, `urgency`, `explainability_summary`, and a JSON array of approval history events (action, reviewer username, reviewer role, note, timestamp).
- Results are ordered by `submitted_at DESC` after applying any filters.

**Frontend — new `SubmissionHistoryItem` type in `client.ts`:**
```ts
type SubmissionHistoryItem = {
  submissionId: string;
  userGroup: string;
  approvalStatus: string;
  submittedAt: string;
  officeId?: string;
  topic?: string;
  sentimentScore: number | null;
  urgency?: string;
  explainabilitySummary?: string;
  approvalHistory: ApprovalHistoryEntry[];
};
```
New `listSubmissionsHistory(params?)` function calls the endpoint with URLSearchParams encoding.

**Frontend — "Submissions" tab in `AdminPage`:**
- Tab is visible to the `admin` role only (added to `allowedTabs` return value for admin).
- Toolbar contains a user-group filter select, an approval-status filter select, and a Refresh button. Changing either filter immediately reloads the data.
- Table columns: ID (12-char prefix), Group, Topic, Submitted, Status (colour-coded pill), Sentiment, Urgency, Stage trail.
- Stage trail is a human-readable derivation of the `approvalHistory` array: `flagged_for_legal` → `→ Legal`, `legal_resolved` → `← Legal resolved`, `supervisor_approved` → `✓ Approved`, `supervisor_rejected` / `legal_rejected` → `✗ Rejected`. Reviewer notes are rendered as a secondary line beneath the trail.
- Status pills use an inline colour map for the known status values; unknown values fall back to a neutral grey.

### Constraints
- No pagination in demo scope; limit query parameter provides a hard cap.
- TypeScript must compile clean; `SubmissionHistoryItem` must be explicitly exported from `client.ts`.

### Risks and rollback
- Risk: slow query on large datasets if `submissions` grows. Mitigation: `LIMIT` cap; acceptable for SQLite demo.
- Rollback: remove endpoint from `admin.ts`, remove tab from `AdminPage.tsx`, remove type + function from `client.ts`.

---

## Change 2 — Attorney approval workflow rewire

### Files affected
- `codebase/backend/src/services/submissionProcessor.ts`
- `codebase/backend/src/routes/approval.ts`
- `codebase/frontend/src/api/client.ts`
- `codebase/frontend/src/pages/AdminPage.tsx`
- `codebase/frontend/src/styles/globals.css`

### Technical approach

**New attorney workflow state machine:**
```
attorney submits
  └─► pending_supervisor
        ├─► supervisor_approved  (straight approval — no legal concern)
        ├─► rejected             (supervisor reject)
        └─► pending_legal        (supervisor flags for legal review)
              ├─► pending_supervisor  (legal resolves — action: legal_resolved)
              └─► rejected            (legal reject)
                    └─► supervisor acts again (approve → supervisor_approved)
```

**`submissionProcessor.ts`:**
- Remove the `attorney` special-case for `initialApprovalStatus`; all submissions now start at `pending_supervisor`.

**`approval.ts` — new endpoint `POST /approval/submissions/:id/flag-legal`:**
- Access control: `requireRoles("admin", "supervisor")`.
- Validates current `approval_status === 'pending_supervisor'` (409 otherwise).
- Sets `approval_status = 'pending_legal'`.
- Records approval history action `flagged_for_legal` via `recordApproval`.
- Writes audit entry `approval.supervisor.flagged_legal`.

**`approval.ts` — updated `POST /approval/submissions/:id/legal-approve`:**
- Semantics renamed to "resolve". Validates `approval_status === 'pending_legal'`.
- Sets `approval_status = 'pending_supervisor'` (returns to supervisor for final sign-off).
- Records action `legal_resolved`.
- Writes audit entry `approval.legal.resolved`.

**`approval.ts` — updated `GET /approval/submissions/pending-supervisor`:**
- `WHERE` clause simplified to `approval_status = 'pending_supervisor'` only. The `legal_approved` intermediate state is eliminated.
- Ordering: attorney submissions surface first (`CASE user_group WHEN 'attorney' THEN 0 ELSE 1 END`).

**`approval.ts` — updated `POST /approval/submissions/:id/supervisor-approve`:**
- Allowed state check narrowed to `pending_supervisor` only; `legal_approved` removed.

**`client.ts`:**
- New `flagForLegal(submissionId, note?)` function calling the new endpoint.

**`AdminPage.tsx` — supervisor approval cards:**
- `legalCleared` condition replaced with `legalResolved` (checks `approvalHistory` for a `legal_resolved` action).
- Attorney items (`userGroup === 'attorney'`) that have not yet been through legal show an amber "Attorney" badge and a new `⚖ Flag for legal review` button in the action row.
- Items returned from legal show a `⚖ Legal reviewed` badge for context.
- Section description updated to explain the revised two-path flow.

**`AdminPage.tsx` — legal review cards:**
- Approve button relabelled "Resolve — return to supervisor".

**`globals.css`:**
- New `.apv-btn-flag-legal` style: transparent background, amber (`#92400e`) text, amber-toned border. Matches pill family of approval buttons without conflating it with approve (green) or reject (red).

### Constraints
- The `legal_approved` approval status value is no longer written. Existing rows in the demo database with `legal_approved` status will remain but will not appear in the supervisor pending list; they should be manually updated or are harmless for demo purposes.
- TypeScript compilation must remain error-free.

### Risks and rollback
- Risk: existing in-flight attorney submissions in `legal_approved` state will be orphaned (not visible in any pending queue). Mitigation: acceptable for demo; a migration script is out of scope.
- Rollback: revert `submissionProcessor.ts`, `approval.ts`, `AdminPage.tsx`, `client.ts` to prior versions.

---

## Change 3 — Likert scale colour coding at rest

### Files affected
- `codebase/frontend/src/pages/SurveyFillPage.tsx`
- `codebase/frontend/src/styles/globals.css`

### Technical approach

`LIKERT_OPTIONS` already defines a `color` hex per option (red → orange → yellow → light green → dark green). Previously these colours were applied only when an option was selected.

**`SurveyFillPage.tsx` — `renderQuestion` for `likert` type:**
The `style` prop on each `.gf-likert-btn` is changed from:
```tsx
style={sel ? { borderColor: opt.color, background: `${opt.color}14` } : {}}
```
to:
```tsx
style={{
  borderColor: sel ? opt.color : `${opt.color}55`,
  background:  sel ? `${opt.color}22` : `${opt.color}0d`,
}}
```
The `.gf-likert-word` colour and weight:
```tsx
style={{ color: sel ? opt.color : `${opt.color}cc`, fontWeight: sel ? 700 : 500 }}
```

Effect: unselected buttons show a very faint tinted background (~5% opacity), a semi-transparent coloured border (33% opacity), and a muted coloured label (80% opacity). Selected buttons brighten to ~13% background, full-opacity border, and full-colour bold label. The gradient is perceptible at rest without overwhelming the question content.

**`globals.css` — `.gf-likert-btn` base style:**
- `border: 2px solid #e0e4ea` removed in favour of `border: 2px solid transparent` (inline style now controls all border colour).
- `background: #fafbfc` removed in favour of `background: transparent` (inline style now controls tint).
- Hover effect updated to use `filter: brightness(1.08)` instead of hardcoded border/background overrides to remain colour-agnostic.

### Constraints
- Must not conflict with any existing CSS specificity on `.gf-likert-btn--selected`.
- WCAG AA contrast: the coloured label text at 80% opacity passes against the faint tinted background for all five option colours at the sizes used (≥ 11.5 px bold).

### Risks and rollback
- Risk: faint tinting may be imperceptible on very bright displays. Mitigation: opacity levels are tunable in a single line.
- Rollback: revert `SurveyFillPage.tsx` inline styles and `globals.css` base class.

---

## Change 4 — Core platform per-button state isolation

### Files affected
- `codebase/frontend/src/pages/IFamilyNetPage.tsx`

### Technical approach

**Root cause:** Both attorney legal milestone rows called `handleSendSurvey("att")` and checked `isSurveyDispatched("att")` / `dispatchedKeys.has("att")`. Because they shared one key, the first sent row made the second appear dispatched. Additionally, the `disabled` guard `sendingKey !== null` blocked all buttons across the platform while any one survey was sending.

**Fix — split `att` into two distinct trigger keys:**
Add two new entries to the `TRIGGERS` constant replacing the single `att` entry:
```ts
"att-spr": {
  key: "att-spr",
  title: "Service plan review survey",
  subtitle: "Attorney · Service plan review",
  templateId: "tpl_att_v1",
  userGroup: "attorney",
  triggerRef: "MA-2026-1182-spr",
},
"att-dp": {
  key: "att-dp",
  title: "Document production survey",
  subtitle: "Attorney · Document production",
  templateId: "tpl_att_v1",
  userGroup: "attorney",
  triggerRef: "MA-2026-1182-dp",
},
```

The attorney legal milestone table rows are updated to pass `row.key` (`"att-spr"` and `"att-dp"` respectively) to `handleSendSurvey`, `isSurveyDispatched`, and `dispatchedKeys.has`.

**Fix — per-button disabled guard:**
All `disabled` props that previously used `sendingKey !== null || dispatched` are updated to `sendingKey === triggerKey || dispatched`. This applies to:
- The shared `renderTriggerCard` component.
- The foster parent placement milestone button.
- The attorney legal milestone table buttons.
- The closure section card buttons.

Since `handleSendSurvey` already uses `setSendingKey(triggerKey)` and clears it in `finally`, each button is now independently lockable for the duration of its own network request only.

### Constraints
- The old `att` key is removed from `TRIGGERS` to avoid dead code. Any existing dispatched state stored under `att` in `dispatchedKeys` (from earlier in the same session) is harmless — it will simply never match any active button key.
- TypeScript compilation must remain error-free.

### Risks and rollback
- Risk: each attorney milestone now dispatches a distinct `triggerRef`, meaning both can be sent independently; this is the desired behaviour, not a risk.
- Rollback: revert `IFamilyNetPage.tsx` trigger map and disabled guard changes.
