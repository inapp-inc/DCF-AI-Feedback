# Frontend Track A Plan: iFamilyNet Emulation

## Goal
Build a frontend implementation that replicates the look and feel of `ifamilynet.html` (without editing the mockup file) and is backed by real APIs for trigger-driven form operations.

## Dependency on backend
- `GET /surveys/{surveyInstanceId}`
- `POST /surveys/{surveyInstanceId}/submit`
- `POST /forms/tokens/{token}/validate`
- `GET /submissions/{submissionId}/ai-result`
- `GET /supervisor/queue`
- `GET /analytics/kpis` (summary chips in workflow)
- `POST /forms/instances/{instanceId}/send`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`

## Slices
1. **A1 Shell and stage navigation**
   - Topbar, user context, pipeline stage legend, section anchors.
   - Static role login state integration from backend `x-demo-user`.
   - Implement text and labels with parity to mockup, except rename all `Action Items` labels to `Next Steps`.
2. **A2 Case and milestone data rendering**
   - Intake/investigation/placement/legal/closure sections.
   - Timeline event feed wired to backend audit/timeline payload.
   - Preserve mockup spacing, typography hierarchy, card structure, and section ordering in code.
3. **A3 Dynamic trigger actions**
   - Replace preview actions with `Send Survey` buttons.
   - `Send Survey` calls backend send endpoint and opens a textfield containing the generated custom survey link.
   - Trigger buttons also support token validation and fetch form instance schema.
   - Overlay form renderer supports question types from template schema.
4. **A4 Submission + AI feedback loop**
   - Submit answers, poll/retrieve AI result, render urgency/routing summary.
   - Show graceful error/retry behavior for inference timeouts.
5. **A5 Queue awareness**
   - Show queue status badges and supervisor signal indicators in context.
   - Surface unresolved high-urgency cards in placement/legal sections.

## Acceptance criteria
- Frontend code mirrors mockup look/feel and structure while keeping the source mockup file unchanged.
- All preview buttons are replaced by `Send Survey` buttons in frontend implementation.
- Clicking `Send Survey` reveals a textfield containing the corresponding custom survey URL.
- Legacy wording `Action Items` is fully replaced with `Next Steps`.
- Every trigger type in mockup opens backend-driven form schema.
- Duplicate submit attempts are blocked and handled in UI.
- AI result summary reflects backend provider outputs.
- Timeline and status badges reflect live backend states.

## Test evidence
- Component tests for section rendering and overlay transitions.
- Integration tests for token->fetch->submit->result flow.
- Integration test for send-survey->custom-link-textfield behavior.
- Manual walkthrough capture of all six trigger paths (MR, VOL, ATT, FP, closure FP, closure ATT).
