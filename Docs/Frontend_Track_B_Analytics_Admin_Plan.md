# Frontend Track B Plan: Analytics and Admin Panel

## Goal
Build the dedicated feedback analytics and admin control plane from the mockup admin panel behavior.
Add platform entry experience with authentication and landing switch between iFamilyNet and Admin analytics applications.

## Dependency on backend
- `GET /analytics/kpis`
- `GET /analytics/trends`
- `GET /analytics/anomalies`
- `GET /supervisor/queue`
- `POST /supervisor/queue/{queueItemId}/assign`
- `POST /supervisor/queue/{queueItemId}/status`
- `GET /forms/templates`
- `POST /forms/templates`
- `PUT /forms/templates/{templateId}`
- `GET /admin/config`
- `PUT /admin/config`
- `POST /exports`
- `GET /exports/{exportId}`
- `GET /audit/logs`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`

## Slices
1. **B1 Dashboard foundations**
   - KPI cards and trend/anomaly charts with Chart.js.
   - Global filter bar (date range, role, office, priority).
   - Integrate with shared app shell reached from landing page switcher.
2. **B2 Queue operations console**
   - Queue table with assignment/status transitions and SLA indicators.
   - Drill-down panel to submission context and AI rationale.
3. **B3 Form configurator**
   - Template list and edit form (metadata, steps, questions, toggles).
   - Version-aware save/update path and publish confirmation.
4. **B4 Admin runtime settings**
   - Trigger windows, reminder cadence, urgency threshold, AI disclosure controls.
   - Change history references via audit log fetch.
5. **B5 Exports and governance**
   - CSV/PDF export request flow and status tracking.
   - Audit log explorer with actor/action/entity filters.
6. **B6 Platform entry and auth shell**
   - Login page with static credentials and role-aware redirects.
   - Landing page that offers two choices: `iFamilyNet Platform` and `Administrative Platform`.
   - Logout action available from both platforms and enforced session clear.

## Acceptance criteria
- Dashboard charts render from backend aggregates without local mock transforms.
- Queue updates mutate backend status and refresh in UI.
- Template configuration persists via backend and rehydrates editor correctly.
- Runtime config and export actions are role-protected.
- Audit view shows admin and queue lifecycle actions.
- Landing page correctly switches between iFamilyNet and Administrative platforms.
- Login/logout flow is functional and route guards block unauthenticated access.

## Test evidence
- Chart data contract tests against backend response shape.
- Integration tests for queue assign/status operations.
- Form configurator tests for add/edit/delete question workflow.
- End-to-end test for export creation and completion polling.
- End-to-end auth test for login -> landing switch -> platform route -> logout.
